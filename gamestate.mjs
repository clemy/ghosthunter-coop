import { Labyrinth, LabyrinthSettings } from "./labyrinth.mjs";

const WIDTH = 20;
const HEIGHT = 15;
const BIG_DOTS = 10;
const PLAYER_SPEED = [2.5, 2.9, 2.5, 2.9];
const GHOST_SPEED = [2.3, 2.7, 2.3, 2.7];
const GHOST_HUNTING_TIME = 7;
const INITIAL_LIVES = 5;
const GHOST_ISFOLLOWING_CHANGE_TIME = 10;
const WON_WAIT_TIME = 2;
const GHOST_CAPTURED_TIME = 6;
const INVULNERABLE_TIME = 1.5;

class GameState {
    constructor(io) {
        this.io = io;
        this.players = new Map;
        this.running = false;
    }

    setup() {
        this.labyrinth = new Labyrinth(new LabyrinthSettings(WIDTH, HEIGHT));
        this.width = this.labyrinth.width;
        this.height = this.labyrinth.height;
        this.dots = new Set;
        this.labyrinth.fields.forEach((fieldType, fieldNum) => {
            if (fieldType === Labyrinth.FieldType.Normal) {
                this.dots.add(fieldNum);
            }
        });
        this.bigDots = new Set;
        do {
            this.bigDots.add([...this.dots][Math.floor(Math.random() * this.dots.size)]);
        } while (this.bigDots.size < BIG_DOTS);

        this.ghosts = this.labyrinth.settings.ghostColors.map((color, ix) =>
            ({
                id: ix,
                color,
                speed: GHOST_SPEED,
                capturedTimer: 0,
                follows: null
            }));
        this.ghosts.forEach(ghost => this.initializeCharacter(ghost));
        this.ghostHuntingTimer = 0;
        this.ghostIsFollowingChangeTimer = GHOST_ISFOLLOWING_CHANGE_TIME;

        // TODO: check for collisions with ghosts
        this.players.forEach(player => this.resetPlayer(player));

        this.useTorus = Math.random() < 0.65;
        console.log("New " + (this.useTorus ? "Torus" : "Box") + " level created");
        this.io.emit("sInitialData", this.getInitialData());

        this.wonTimer = 0;
        this.running = true;
    }

    newPlayer(socket, name) {
        const id = socket.id;
        const player = {
            id,
            name
        };
        this.resetPlayer(player);
        this.players.set(id, player);

        socket.on("cPlayerPos", data =>
            this.receivedPlayerUpdate(player, socket, data));
        socket.on("cPlayerLives", data =>
            this.receivedPlayerLivesUpdate(player, socket, data));
        socket.on("cRequestDir", dir => {
            if (Labyrinth.AllDirections.includes(dir)) {
                player.requestedDir = dir;
            }
        });
        socket.on("cRequestJump", () => {
            socket.broadcast.emit("sPlayerJump", player.id);
        });
        socket.on("cRequestRestart", () => {
            this.resetPlayer(player);
            socket.emit("sInitialData", this.getInitialData());
        });
        socket.on("cGhostCaptured", ghostId =>
            this.receivedGhostCaptured(player, socket, ghostId));
        socket.on('disconnect', (reason) => this.deletePlayer(player));

        socket.emit("sInitialData", this.getInitialData());
    }

    deletePlayer(player) {
        player.lives = 0;
        this.players.delete(player.id);
        this.io.emit("sPlayerUpdate", player.id, null);
    }

    playerCount() {
        return this.players.size;
    }

    initializeCharacter(character) {
        character.pos = this.randomStartPos();
        character.dir = this.randomStartDirection(character.pos);
    }
    resetPlayer(player) {
        player.requestedDir = null;
        player.invulnerableTimer = INVULNERABLE_TIME;
        player.lives = INITIAL_LIVES;
        player.speed = PLAYER_SPEED;
        player.getsFollowed = false;
        this.initializeCharacter(player);
    }

    randomStartPos() {
        do {
            var pos = {
                x: Math.floor(Math.random() * this.width),
                y: Math.floor(Math.random() * this.height)
            };
        } while (!this.labyrinth.isNormal(pos) /*|| TODO: checkForOther*/);
        return pos;
    }
    randomStartDirection(pos) {
        const neighbor = getRandomFromArray(this.labyrinth.getReachableNeighbors(pos));
        if (neighbor === null) {
            throw "could not find a start direction - this should not happen";
        }
        return this.labyrinth.getDirectionToNeighbor(pos, neighbor);
    }

    getInitialData() {
        return {
            ...this.getMapData(),
            state: this.getStateData()
        };
    }

    getMapData() {
        return {
            labyrinth: this.labyrinth.getInitialData(),
            useTorus: this.useTorus
        };
    }

    getStateData() {
        return {
            dots: [...this.dots],
            bigDots: [...this.bigDots],
            players: [...this.players],
            ghosts: this.ghosts,
            ghostHuntingTimer: this.ghostHuntingTimer
        };
    }

    getDotsStateData() {
        return {
            dots: [...this.dots],
            bigDots: [...this.bigDots],
            ghostHuntingTimer: this.ghostHuntingTimer
        };
    }

    receivedPlayerUpdate(player, socket, data) {
        if (data.pos.x < 0 || data.pos.x > this.width - 1 ||
            data.pos.y < 0 || data.pos.y > this.height - 1 ||
            !Labyrinth.AllDirections.includes(data.dir)) {
            console.log("invalid update from", player.id, player.name);
            return;
        }
        player.pos = data.pos;
        player.dir = data.dir;
        var dotsState = null;
        if (data.dotEaten) {
            const fieldNum = this.labyrinth.fromCoord(player.pos);
            if (this.dots.delete(fieldNum)) {
                if (this.dots.size <= 0) {
                    this.running = false;
                    // TODO: WON! restart!
                    this.io.emit("sMsg", `WON! ${player.name} catched the last dot!`);
                    socket.broadcast.emit("sWon");
                    this.wonTimer = WON_WAIT_TIME;
                }
            }
            if (this.bigDots.delete(fieldNum)) {
                // big dot eaten
                this.ghostHuntingTimer = GHOST_HUNTING_TIME;
                this.io.emit("sMsg", `${player.name} catched a big ball.`);
            }
            dotsState = this.getDotsStateData();
        }
        if (dotsState !== null) {
            this.io.emit("sPlayerUpdate", player.id, player, dotsState);
        } else {
            socket.broadcast.emit("sPlayerUpdate", player.id, player, dotsState);
        }
    }

    receivedPlayerLivesUpdate(player, socket, data) {
        player.lives = data.lives;
        player.invulnerableTimer = data.invulnerableTimer;
        if (player.lives <= 0) {
            this.io.emit("sMsg", `${player.name} died.`);
        }
        socket.broadcast.emit("sPlayerUpdate", player.id, player, null);
    }

    receivedGhostCaptured(player, socket, ghostId) {
        const ghost = this.ghosts[ghostId];
        if (ghost) {
            ghost.capturedTimer = GHOST_CAPTURED_TIME;
            socket.broadcast.emit("sGhostUpdate", ghost.id, ghost);
        }
    }

    update(deltaTime) {
        if (this.wonTimer > 0) {
            this.wonTimer -= deltaTime;
            if (this.wonTimer <= 0) {
                this.setup();
                return;
            }
        }
        if (!this.running) {
            return;
        }
        if (this.ghostIsFollowingChangeTimer > 0) {
            this.ghostIsFollowingChangeTimer -= deltaTime;
        }
        if (this.ghostHuntingTimer > 0) {
            this.ghostHuntingTimer -= deltaTime;
        } else {
            if (this.ghostIsFollowingChangeTimer <= 0) {
                this.ghostIsFollowingChangeTimer = GHOST_ISFOLLOWING_CHANGE_TIME;
                this.ghosts.forEach(ghost => this.changeFollowedPlayer(ghost));
            }
        }

        this.ghosts.forEach(ghost => {
            if (ghost.capturedTimer > 0) {
                ghost.capturedTimer -= deltaTime;
                if (ghost.capturedTimer <= 0) {
                    ghost.capturedTimer = 0;
                    this.initializeCharacter(ghost);
                    this.io.emit("sGhostUpdate", ghost.id, ghost);
                }
            } else {
                this.updateCharacter(deltaTime, ghost, (character, justReached) => this.ghostOnField(character, justReached));
            }
        });
        this.players.forEach(player => {
            if (player.lives > 0) {
                if (player.invulnerableTimer > 0) {
                    player.invulnerableTimer -= deltaTime;
                }
                this.updateCharacter(deltaTime, player, (character, justReached) => this.playerOnField(character, justReached));
            }
        });
    }

    ghostOnField(ghost) {
        let bestDirection = null;
        if (this.ghostHuntingTimer <= 0) {
            if ((ghost.follows?.lives ?? 0) > 0) {
                const playerPos = this.roundToNextField(ghost.follows.pos, ghost.follows.dir);
                if (ghost.pos.x === playerPos.x && ghost.pos.y === playerPos.y) {
                    // stop following if reached
                    ghost.follows.getsFollowed = false;
                    ghost.follows = null;
                } else {
                    bestDirection = this.labyrinth.getDirectionToNeighbor(
                        ghost.pos,
                        this.labyrinth.pathFinderGetNext(ghost.pos, playerPos)
                    );
                }
            }
        } else {
            // run away, but where, when there are multiple players?
            //const far = this.labyrinth.pathFinderGetFar(Math.round(this.playerX), Math.round(this.playerY));
            //if (far !== null) {
            //    bestDirection = this.getBestDirection(object.x, object.y, ...far);
            //}
        }
        if (bestDirection !== null) {
            ghost.dir = bestDirection;
        } else if (Math.random() < 0.3) {
            // sometimes turn 90 degree
            ghost.dir = (4 + ghost.dir + Math.floor(Math.random() * 2) * 2 - 1) % 4;
        }
        do {
            if (this.labyrinth.isNormal(this.labyrinth.getRelativeField(ghost.pos, ghost.dir))) {
                break;
            }
            ghost.dir = (4 + ghost.dir + Math.floor(Math.random() * 2) * 2 - 1) % 4;
        } while (true);
        this.io.emit("sGhostUpdate", ghost.id, ghost);
    }

    playerOnField(player, justReached) {
        var justTurned = false;
        if (player.requestedDir !== null) {
            if (this.labyrinth.isNormal(this.labyrinth.getRelativeField(player.pos, player.requestedDir))) {
                player.dir = player.requestedDir;
                player.requestedDir = null;
                justTurned = true;
            }
        }
        if (justReached || justTurned) {
            this.io.emit("sPlayerUpdate", player.id, player);
        }
    }

    updateCharacter(deltaTime, character, onfield = (character, justReached) => null) {
        let moveDelta = (character.speed[character.dir] * deltaTime) % 1;
        let remainingDeltaToNextField = this.distanceToNextField(character.pos, character.dir);

        let justReached = false;
        if (remainingDeltaToNextField > 0 && remainingDeltaToNextField <= moveDelta) {
            // we are crossing a field, so calculate until this field
            character.pos = this.roundToNextField(character.pos, character.dir);
            moveDelta -= remainingDeltaToNextField;
            remainingDeltaToNextField = 0;
            justReached = true;
        }

        if (remainingDeltaToNextField == 0) {
            // we are on a field
            onfield(character, justReached);
            if (!this.labyrinth.isNormal(this.labyrinth.getRelativeField(character.pos, character.dir))) {
                return;
            }
        }
        character.pos = this.moveToNextField(character.pos, character.dir, moveDelta);
    }

    changeFollowedPlayer(ghost) {
        const prevFollowed = ghost.follows;
        if (ghost.follows !== null) {
            ghost.follows.getsFollowed = false;
        }
        ghost.follows = null;
        if (ghost.capturedTimer > 0 || Math.random() < 0.5) {
            return;
        }
        const newFollowed = getRandomFromArray([...this.players.values()]);
        if (newFollowed !== null && !newFollowed.getsFollowed) {
            ghost.follows = newFollowed;
            ghost.follows.getsFollowed = true;
            if (ghost.follows !== prevFollowed) {
                this.io.emit("sGhostFollows",
                    { color: ghost.color },
                    { id: ghost.follows.id, name: ghost.follows.name }
                );
            }
        }
    }

    roundToNextField({ x, y }, dir) {
        switch (dir) {
            case Labyrinth.Direction.RIGHT:
                return { x: Math.ceil(x), y };
            case Labyrinth.Direction.UP:
                return { x, y: Math.ceil(y) };
            case Labyrinth.Direction.LEFT:
                return { x: Math.floor(x), y };
            case Labyrinth.Direction.DOWN:
                return { x, y: Math.floor(y) };
        }
    }

    moveToNextField({ x, y }, dir, offset) {
        switch (dir) {
            case Labyrinth.Direction.RIGHT:
                return { x: x + offset, y };
            case Labyrinth.Direction.UP:
                return { x, y: y + offset };
            case Labyrinth.Direction.LEFT:
                return { x: x - offset, y };
            case Labyrinth.Direction.DOWN:
                return { x, y: y - offset };
        }
    }

    distanceToNextField({ x, y }, dir) {
        switch (dir) {
            case Labyrinth.Direction.RIGHT:
                return Math.ceil(x) - x;
            case Labyrinth.Direction.UP:
                return Math.ceil(y) - y;
            case Labyrinth.Direction.LEFT:
                return x - Math.floor(x);
            case Labyrinth.Direction.DOWN:
                return y - Math.floor(y);
        }
    }
}

function getRandomFromArray(array) {
    if (array.length <= 0)
        return null;
    return array[Math.floor(Math.random() * array.length)];
}

export { GameState };
