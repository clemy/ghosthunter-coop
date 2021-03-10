import { performance } from "perf_hooks";

class GameLoop {
    constructor(delay, gameState) {
        this.delay = delay;
        this.gameState = gameState;

        this.callbackHandle = 0;
        this.lastFrame = null;
    }

    start(once = false) {
        this.once = once;
        this.redraw();
    }

    redraw() {
        const fpsHistory = [];
        let fpsOutputCounter = 0;
        const draw = () => {
            if (this.callbackHandle == 0) {
                // just in case the cancel did not work
                return;
            }
            const timestamp = performance.now();
            const timeDelta = (timestamp - (this.lastFrame ?? timestamp)) / 1000;
            this.lastFrame = timestamp;
            const fps = 1 / timeDelta;
            fpsHistory.length >= 30 && fpsHistory.shift();
            isFinite(fps) && fpsHistory.push(fps);
            if (++fpsOutputCounter > 300) {
                const fpsMean = (fpsHistory.reduce((a, v) => a + v, 0) / fpsHistory.length).toFixed(1);
                const fpsMin = Math.min(...fpsHistory).toFixed(1);
                const fpsMax = Math.max(...fpsHistory).toFixed(1);
                console.log(`FPS Mean: ${fpsMean} Min: ${fpsMin} Max: ${fpsMax}`);
                fpsOutputCounter = 0;
            }
            this.callbackHandle = 0;
            this.gameState.update(timeDelta);
            if (!this.once && this.gameState.playerCount() > 0) {
                this.callbackHandle = setTimeout(draw, this.delay * 1000);
            } else {
                console.log("Gameloop stopped");
            }
        }
        if (this.gameState != null && this.callbackHandle == 0) {
            this.callbackHandle = setTimeout(draw, this.delay * 1000);
            console.log("Gameloop started");
        }
    }

    stop() {
        if (this.callbackHandle != 0) {
            window.clearTimeout(this.callbackHandle);
        }
        this.callbackHandle = 0;
    }

    dispose() {
        stop();
        this.gameState = null;
    }
}

GameLoop.prototype.start.ONCE = true;

export { GameLoop };
