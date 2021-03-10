/* DrawLoop: central location for handling timing of redraws.
    Can run once or continously. Can be stopped.
    redraw() ensures that there is only one redraw done at the next
    animation frame, regardless how often it is called.

    calls scene.draw()
*/

class DrawLoop {
    constructor(canvasgl, scene) {
        this.canvasgl = canvasgl;
        this.scene = scene;
        this.callbackHandle = 0;
        this.lastFrame = null;
    }

    start(once = false) {
        this.once = once;
        this.redraw();
    }

    redraw() {
        const fpsHistory = [];
        const draw = (timestamp) => {
            if (this.callbackHandle == 0) {
                // just in case the cancel did not work
                return;
            }
            const timeDelta = (timestamp - (this.lastFrame ?? timestamp)) / 1000;
            this.lastFrame = timestamp;
            const fps = 1 / timeDelta;
            fpsHistory.length >= 30 && fpsHistory.shift();
            isFinite(fps) && fpsHistory.push(fps);
            document.getElementById("fps").textContent = (fpsHistory.reduce((a, v) => a + v, 0) / fpsHistory.length).toFixed(1);
            document.getElementById("fps-min").textContent = Math.min(...fpsHistory).toFixed(1);
            document.getElementById("fps-max").textContent = Math.max(...fpsHistory).toFixed(1);
            this.callbackHandle = 0;
            this.canvasgl.fixSize();
            this.scene.draw(timeDelta);
            if (!this.once)
                this.callbackHandle = window.requestAnimationFrame(draw);
        }
        if (this.canvasgl != null && this.callbackHandle == 0) {
            this.callbackHandle = window.requestAnimationFrame(draw);
        }
    }

    stop() {
        if (this.callbackHandle != 0) {
            window.cancelAnimationFrame(this.callbackHandle);
        }
        this.callbackHandle = 0;
    }

    dispose() {
        stop();
        this.scene = null;
        this.canvasgl = null;
    }
}

DrawLoop.prototype.start.ONCE = true;

export { DrawLoop };
