class Labyrinth {
    constructor(initialData) {
        this.settings = initialData.settings;
        this.fields = initialData.fields;
        this.width = this.settings.width;
        this.height = this.settings.height;
    }

    isNormal(fieldNum) {
        return fieldNum !== null && this.fields[fieldNum] === Labyrinth.FieldType.Normal;
    }
    isBorder(fieldNum) {
        return fieldNum !== null && this.fields[fieldNum] === Labyrinth.FieldType.Border;
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

export { Labyrinth };
