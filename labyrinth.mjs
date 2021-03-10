class LabyrinthSettings {
    constructor(width, height) {
        this.width = width ?? 30;
        this.height = height ?? 20;
        this.normalProbability = 0.6;
        this.minNormalFieldCount = this.width * this.height * 0.4;
        this.middlePos = {
            x: Math.floor(this.height / 2),
            y: Math.floor(this.width / 2)
        };
        this.ghostColors = [
            [1, 0, 0],
            [0, 1, 1],
            [1, 0, 1],
            [1, 0.4, 0.2]
        ];
    }
}

class Labyrinth {
    constructor(settings = new LabyrinthSettings) {
        this.settings = { ...settings };
        this.width = this.settings.width;
        this.height = this.settings.height;
        // brute force algorithm to get a random labyrinth matching the criteria
        // this can later be replaced with something building nice labyrinths with 1 field wide corridors...
        let iterations = 0;
        do {
            this.fields = Array.from({ length: this.width * this.height }, (_, fieldNum) => {
                const { x, y } = this.toCoord(fieldNum);
                if (x === 0 || x === this.width - 1 || y === 0 || y === this.height - 1) {
                    // outer border
                    return Labyrinth.FieldType.Unreachable;
                }
                return Math.random() < settings.normalProbability ? Labyrinth.FieldType.Untested : Labyrinth.FieldType.Unreachable;
            });
            this.fields[this.settings.middlePos] = Labyrinth.FieldType.Untested; // some better luck for the start
            if (iterations++ > 10000) {
                throw "did not find a good labyrinth";
            }
        } while (this.floodFill() < settings.minNormalFieldCount);
        this.pathFinderGetNext = (from, to) => null;
        this.pathFinderGetFar = (pos) => null;
        this.calculatePathFinder();
    }

    getInitialData() {
        return {
            settings: this.settings,
            fields: this.fields
        };
    }

    isNormal(pos) {
        return pos !== null && this.fields[this.fromCoord(pos)] === Labyrinth.FieldType.Normal;
    }
    isBorder(pos) {
        return pos !== null && this.fields[this.fromCoord(pos)] === Labyrinth.FieldType.Border;
    }

    // some helper functions for coordinates
    toCoord(fieldNum) {
        return {
            x: fieldNum % this.width,
            y: Math.floor(fieldNum / this.width)
        };
    }
    fromCoord({ x, y }) {
        return this.fromCoordXY(x, y);
    }
    fromCoordXY(x, y) {
        if (x < 0 || x > this.width || y < 0 || y > this.height) {
            return null;
        }
        return y * this.width + x;
    }

    getRelativeField({ x, y }, direction) {
        switch (direction) {
            case Labyrinth.Direction.RIGHT:
                return { x: x + 1, y };
            case Labyrinth.Direction.UP:
                return { x, y: y + 1 };
            case Labyrinth.Direction.LEFT:
                return { x: x - 1, y };
            case Labyrinth.Direction.DOWN:
                return { x, y: y - 1 };
            default:
                throw "invalid direction";
        }
    }
    getDirectionToNeighbor(from, to) {
        if (from === null || to === null) {
            return null;
        }
        const diffX = to.x - from.x;
        const diffY = to.y - from.y;
        if (diffX === 1 && diffY === 0) {
            return Labyrinth.Direction.RIGHT;
        } else if (diffX === 0 && diffY === 1) {
            return Labyrinth.Direction.UP;
        } else if (diffX === -1 && diffY === 0) {
            return Labyrinth.Direction.LEFT;
        } else if (diffX === 0 && diffY === -1) {
            return Labyrinth.Direction.DOWN;
        } else {
            return null;
        }
    }

    getReachableNeighbors(pos) {
        if (!this.isNormal(pos)) {
            return [];
        }
        return Labyrinth.AllDirections
            .map(dir => this.getRelativeField(pos, dir))
            .filter(nPos => this.isNormal(nPos));
    }

    // tests reachability, updates fields and
    //   returns number of normal fields
    // works recursively
    floodFill(pos = this.settings.middlePos) {
        if (pos === null) {
            // out of bounds
            return 0;
        }
        const fieldNum = this.fromCoord(pos);
        switch (this.fields[fieldNum]) {
            case Labyrinth.FieldType.Normal:
            case Labyrinth.FieldType.Border:
                // already visited
                return 0;
            case Labyrinth.FieldType.Unreachable:
                // unreachable next to reachable becomes border
                this.fields[fieldNum] = Labyrinth.FieldType.Border;
                return 0;

            case Labyrinth.FieldType.Untested:
                this.fields[fieldNum] = Labyrinth.FieldType.Normal;
                return Labyrinth.AllDirections.reduce(
                    (a, dir) => a + this.floodFill(this.getRelativeField(pos, dir)),
                    1);

            default:
                throw "Labyrinth generation error";
        }
    }

    calculatePathFinder() {
        const MAX_UINT16 = 65535;
        const MAX_UINT32 = 4294967295;
        const count = this.fields.length;

        // Floyd-Warshall algorithm O(n^3)
        //   implementation of pseudocode from
        //   https://en.wikipedia.org/wiki/Floyd%E2%80%93Warshall_algorithm
        let dist = new Uint32Array(count * count);
        const next = new Uint16Array(count * count);
        const index = (from, to) => from * count + to;
        dist.fill(MAX_UINT32);
        next.fill(MAX_UINT16);
        for (let v = 0; v < count; v++) {
            dist[index(v, v)] = 0;
            next[index(v, v)] = v;
            this.getReachableNeighbors(this.toCoord(v)).forEach(nPos => {
                const n = this.fromCoord(nPos);
                dist[index(v, n)] = 1;
                next[index(v, n)] = n;
            });
        }
        for (let k = 0; k < count; k++) {
            for (let i = 0; i < count; i++) {
                for (let j = 0; j < count; j++) {
                    if (dist[index(i, j)] > dist[index(i, k)] + dist[index(k, j)]) {
                        dist[index(i, j)] = dist[index(i, k)] + dist[index(k, j)];
                        next[index(i, j)] = next[index(i, k)];
                    }
                }
            }
        }

        // get the most distant field for every field (to run away)
        let mostDist = new Uint32Array(count);
        mostDist.fill(0);
        const mostDistNode = new Uint16Array(count);
        mostDistNode.fill(MAX_UINT16);
        for (let i = 0; i < count; i++) {
            for (let j = 0; j < count; j++) {
                const d = dist[index(i, j)];
                if (d !== MAX_UINT32 && mostDist[i] < d) {
                    mostDist[i] = d;
                    mostDistNode[i] = j;
                }
            }
        }
        dist = null;
        mostDist = null;
        this.pathFinderGetNext = (from, to) => {
            const nextField = next[index(this.fromCoord(from), this.fromCoord(to))];
            return nextField === MAX_UINT16 ? null : this.toCoord(nextField);
        };
        this.pathFinderGetFar = pos => {
            const farField = mostDistNode[this.fromCoord(pos)];
            return farField === MAX_UINT16 ? null : this.toCoord(farField);
        };
    }
}

Labyrinth.FieldType = {
    Normal: 0,
    Border: 1,
    Unreachable: 2,
    Untested: 3
}

Labyrinth.Direction = { RIGHT: 0, UP: 1, LEFT: 2, DOWN: 3 };
Labyrinth.AllDirections = [
    Labyrinth.Direction.RIGHT,
    Labyrinth.Direction.UP,
    Labyrinth.Direction.LEFT,
    Labyrinth.Direction.DOWN
];

export { LabyrinthSettings, Labyrinth };
