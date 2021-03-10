import { Labyrinth } from "./labyrinth.js";
import { showStatus, showStatusWithColor } from "./menu.js";
import { Audio } from "./audio.js";

const JUMP_LENGTH = 1;
const INVULNERABLE_TIME = 1.5;
const GHOST_HUNTING_TIME = 7;
const LOST_WAIT_TIME = 3;
const GHOST_CAPTURED_TIME = 6;
const GHOSTS_COUNT_FOR_EXTRA_LIFE = 3;

class GameState {
    constructor(socket) {
        this.socket = socket;
        this.version = 0;
        this.running = false;
        this.id = null;
        socket.on("connect", () => this.id = socket.id);
        socket.on("sInitialData", data => this.setup(data));
        socket.on("sGhostUpdate", (id, data) => this.ghostUpdate(id, data));
        socket.on("sPlayerUpdate", (id, data, dots) => {
            this.playerUpdate(id, data);
            if (dots) {
                this.dotsUpdate(dots);
            }
        });
        socket.on("sPlayerJump", id => this.playerJump(id));
        socket.on("sGhostFollows", (ghost, player) =>
            showStatusWithColor("Ghost", ghost.color,
                ` is now haunting ${player.id === this.id ? "you" : player.name}..`)
        );
        socket.on("sWon", () => {
            this.running = false;
            Audio.playWon();
        });
        socket.on("disconnect", () => this.disconnected());
    }

    setup(initialData) {
        this.labyrinth = new Labyrinth(initialData.labyrinth);
        this.playerX = this.labyrinth.settings.startX;
        this.playerY = this.labyrinth.settings.startY;
        this.useTorus = initialData.useTorus;

        this.dots = new Set(initialData.state.dots);
        this.bigDots = new Set(initialData.state.bigDots);

        this.players = new Map(initialData.state.players);
        this.player = this.players.get(this.id);
        this.player.me = true;
        this.player.jumpPosition = 0;
        this.player.jumpHeight = 0;
        this.ghosts = initialData.state.ghosts;
        this.ghostHuntingTimer = initialData.state.ghostHuntingTimer;
        this.ghostsCaptured = 0;

        this.lostTimer = 0;

        this.updateDotsDisplay();
        this.updateLivesDisplay();

        this.running = true;
        this.version++;
    }

    disconnected() {
        showStatus("Disconnected!", showStatus.Severity.ERROR);
        showStatus("Trying to reconnect..");
        this.running = false;
    }

    ghostUpdate(id, data) {
        const ghost = this.ghosts[id];
        ghost.pos = data.pos;
        ghost.dir = data.dir;
        ghost.capturedTimer = data.capturedTimer;
    }

    playerUpdate(id, data) {
        if (data === null) {
            this.players.delete(id);
            return;
        }
        const player = this.players.get(id);
        if (player === undefined) {
            this.players.set(id, data);
            return;
        }
        if (!player.me) {
            player.pos = data.pos;
            player.dir = data.dir;
            player.lives = data.lives;
            player.invulnerableTimer = data.invulnerableTimer;
        }
    }

    dotsUpdate(data) {
        this.dots = new Set(data.dots);
        this.bigDots = new Set(data.bigDots);
        this.ghostHuntingTimer = data.ghostHuntingTimer;
        this.updateDotsDisplay();
    }

    playerJump(id) {
        const player = this.players.get(id);
        if (player !== undefined && !player.me) {
            player.jumpPosition = 1;
        }
    }

    updateLivesDisplay() {
        document.getElementById("lives").textContent = this.player.lives > 0 ? "\u2665".repeat(this.player.lives) : "";
    }
    updateDotsDisplay() {
        document.getElementById("dots").textContent = this.dots.size;
    }

    getDotsArray() {
        return [...this.dots].flatMap(d => ([
            d % this.labyrinth.settings.width,
            -Math.floor(d / this.labyrinth.settings.width)
        ]));
    }

    getBigDotsArray() {
        return [...this.bigDots].flatMap(d => ([
            d % this.labyrinth.settings.width,
            -Math.floor(d / this.labyrinth.settings.width)
        ]));
    }

    requestDirection(direction) {
        if (this.player.lives <= 0) {
            return;
        }
        this.player.requestedDir = direction;
        this.socket.emit("cRequestDir", direction);
    }

    requestJump() {
        if (this.player.lives <= 0) {
            return;
        }
        if ((this.player.jumpPosition ?? 0) == 0) {
            this.player.jumpPosition = 1;
            this.socket.emit("cRequestJump");
            Audio.playJump();
        }
    }

    update(deltaTime) {
        if (!this.running) {
            return;
        }

        if (this.lostTimer > 0) {
            this.lostTimer -= deltaTime;
            if (this.lostTimer <= 0) {
                this.socket.emit("cRequestRestart");
            }
        }

        if (this.ghostHuntingTimer > 0) {
            this.ghostHuntingTimer -= deltaTime;
        }
        this.ghosts.forEach(character => this.updateCharacter(deltaTime, character));
        this.players.forEach(character => this.updateCharacter(deltaTime, character, (character, justReached) => this.playerOnField(character, justReached)));

        if (this.player.lives > 0 && this.player.jumpHeight < 0.5) {
            this.ghosts.forEach(ghost => this.checkCollision(ghost));
        }
    }

    playerOnField(player, justReached) {
        if (player.me) {
            const fieldNum = this.labyrinth.fromCoord(this.player.pos);
            let dotEaten = false;
            if (player.jumpHeight < 0.2 && this.dots.delete(fieldNum)) {
                // dot eaten -> play ding sound :)
                this.updateDotsDisplay();
                if (this.dots.size <= 0) {
                    showStatus("You catched the last dot! WON!");
                    Audio.playWon();
                    this.running = false;
                } else {
                    Audio.playDing(1);
                }
                dotEaten = true;
            }
            if (player.jumpHeight < 0.2 && this.bigDots.delete(fieldNum)) {
                // big dot eaten
                Audio.playDing(0.7, 1.5);
                this.ghostHuntingTimer = GHOST_HUNTING_TIME;
                //showStatus("Ghosts are running away..");
                dotEaten = true;
            }

            var justTurned = false;
            if (player.requestedDir !== null) {
                if (this.labyrinth.isNormal(this.labyrinth.getRelativeField(player.pos, player.requestedDir))) {
                    player.dir = player.requestedDir;
                    player.requestedDir = null;
                    justTurned = true;
                }
            }
            if (justReached || justTurned || dotEaten) {
                this.socket.emit("cPlayerPos", {
                    pos: player.pos,
                    dir: player.dir,
                    dotEaten
                });
            }
        }
    }

    updateCharacter(deltaTime, character, onfield = (character, justReached) => null) {
        if (character.lives !== undefined && character.lives <= 0) {
            return;
        }
        if ((character.jumpPosition ?? 0) > 0) {
            character.jumpPosition = Math.max(0, character.jumpPosition - deltaTime / JUMP_LENGTH);
            character.jumpHeight = Math.sin(character.jumpPosition * Math.PI);
        }
        if ((character.invulnerableTimer ?? 0) > 0) {
            character.invulnerableTimer -= deltaTime;
        }
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

    checkCollision(ghost) {
        if (Math.abs(ghost.pos.x - this.player.pos.x) < 0.5 && Math.abs(ghost.pos.y - this.player.pos.y) < 0.5) {
            if (ghost.capturedTimer > 0) {
                return;
            }
            if (this.ghostHuntingTimer > 0) {
                ghost.capturedTimer = GHOST_CAPTURED_TIME;
                if (++this.ghostsCaptured >= GHOSTS_COUNT_FOR_EXTRA_LIFE) {
                    this.player.lives++;
                    this.updateLivesDisplay();
                    showStatus("You earned 1 life.");
                    this.ghostsCaptured = 0;
                    this.socket.emit("cPlayerLives", {
                        lives: this.player.lives,
                        invulnerableTimer: this.player.invulnerableTimer
                    });
                }
                this.socket.emit("cGhostCaptured", ghost.id);
                Audio.playDing(1.3, 2.0);
                return;
            }
            if (this.player.invulnerableTimer <= 0) {
                if (--this.player.lives <= 0) {
                    showStatus("You died!");
                    Audio.playLost();
                    this.lostTimer = LOST_WAIT_TIME;
                } else {
                    Audio.playBad(0.5, 2);
                    showStatus("You lost 1 life.");
                    this.player.invulnerableTimer = INVULNERABLE_TIME;
                }
                this.socket.emit("cPlayerLives", {
                    lives: this.player.lives,
                    invulnerableTimer: this.player.invulnerableTimer
                });
                this.updateLivesDisplay();
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

export { GameState };
