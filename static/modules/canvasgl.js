/* CanvasGL: adds a canvas element to the provided DOM element
    and activates a webgl context in it.
    Be aware: it can through exceptions

    Use the factory methods below to get other objects with correct gl reference.

    Use fixSize() in the draw loop to adapt to screen/element size changes.
*/

import { DrawLoop } from "./drawloop.js";
import { showStatus } from "./menu.js";
import { Scene } from "./scene.js";
import { ShaderProgram } from "./shader.js";
import { Plane, Shape } from "./shape.js";

class CanvasGL {
    constructor(parent) {
        this.parent = parent;
        this.canvas = document.createElement("canvas");
        if (this.canvas == null) {
            throw "Your browser does not support the canvas element";
        }
        parent.appendChild(this.canvas);
        const gl = this.gl = this.canvas.getContext("webgl", { stencil: true });
        if (gl === null) {
            parent.removeChild(this.canvas);
            throw "Your browser does not support WebGL";
        }
        if (typeof WebGLDebugUtils !== "undefined") {
            gl = WebGLDebugUtils.makeDebugContext(gl);
        }
        this.extInstancedArrays = gl.getExtension("ANGLE_instanced_arrays");
        //showStatus((this.extInstancedArrays ? "" : "NOT ") + "using ANGLE_instanced_arrays");
        gl.enable(this.gl.DEPTH_TEST);
        this.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    }

    fixSize() {
        const devicePixelRatio = 1.0; //window.devicePixelRatio; // disabled due to performance reasons
        const newWidth = Math.floor(this.canvas.clientWidth * devicePixelRatio);
        const newHeight = Math.floor(this.canvas.clientHeight * devicePixelRatio);
        if (this.canvas.width !== newWidth || this.canvas.height !== newHeight) {
            this.canvas.width = newWidth;
            this.canvas.height = newHeight;
            this.gl.viewport(0, 0, this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
            this.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
            //showStatus(`Resized to ${newWidth} x ${newHeight}px (pixelsize=${devicePixelRatio})`);
        }
    }

    aspectRatio() {
        return this.aspect;
    }

    setBackground(color) {
        this.gl.clearColor(color.red, color.green, color.blue, color.alpha);
    }

    clear() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT | this.gl.STENCIL_BUFFER_BIT);
    }

    newShaderProgram(...args) {
        return new ShaderProgram(this, ...args);
    }

    newShape(...args) {
        return new Shape(this, ...args);
    }

    newPlane(...args) {
        return new Plane(this, ...args);
    }

    newScene(...args) {
        return new Scene(this, ...args);
    }

    newDrawLoop(...args) {
        return new DrawLoop(this, ...args);
    }

    dispose() {
        this.gl = null;
        this.parent.removeChild(this.canvas);
        this.canvas = null;
    }
}

export { CanvasGL };
