/* Shape: Represents a shape loaded on the graphics card for drawing.
    It loads the shapes from a WaveFront OBJ file.
*/

class Shape {
    constructor(canvasgl, objURL) {
        this.canvasgl = canvasgl;
        const gl = this.gl = canvasgl.gl;
        this.objURL = objURL;
        this.verticesBuffer = gl.createBuffer();
        this.pointCount = 0;
    }

    async load() {
        const response = await fetch(this.objURL);
        if (!response.ok) {
            throw `Failed to load object "${this.objURL}": ${response.statusText}`;
        }
        const objData = await response.text();
        const objTokens = objData.split("\n").map(l => l.split(" "));
        const vertices = objTokens.filter(line => line[0] == "v").map(line => line.slice(1).map(token => parseFloat(token)));
        const normals = objTokens.filter(line => line[0] == "vn").map(line => line.slice(1).map(token => parseFloat(token)));
        const points = objTokens.filter(line => line[0] == "f")
            .flatMap(line => line.slice(1)
                .flatMap(token => {
                    const [vertex, texture, normal] = token.split("/");
                    return [...vertices[vertex - 1], ...normals[normal - 1]];
                })
            );

        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.verticesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(points), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        this.pointCount = points.length / 6;
    }

    draw(shader) {
        const gl = this.gl;
        shader.setAttributes({
            aPointPos: { buffer: this.verticesBuffer, stride: 2, offset: 0 },
            aNormal: { buffer: this.verticesBuffer, stride: 2, offset: 1 },
            aPointOffset: { constantValue: [0, 0] }
        });
        gl.drawArrays(gl.TRIANGLES, 0, this.pointCount);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    dispose() {
        this.gl.deleteBuffer(this.verticesBuffer);
        this.gl = null;
    }
}

class MultiShape {
    constructor(shape, maxInstances) {
        this.shape = shape;
        const gl = this.gl = shape.gl;
        this.extInstancedArrays = shape.canvasgl.extInstancedArrays;

        if (this.extInstancedArrays) {
            this.offsetsBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.offsetsBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, maxInstances * 2 * 4, gl.DYNAMIC_DRAW);
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
        } else {
            this.offsets = [];
        }
        this.instancesCount = 0;
    }

    setOffsets(offsets) {
        const gl = this.gl;
        if (this.extInstancedArrays) {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.offsetsBuffer);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, Float32Array.from(offsets));
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
        } else {
            this.offsets = offsets;
        }
        this.instancesCount = offsets.length / 2;
    }

    draw(shader) {
        shader.setAttributes({
            aPointPos: { buffer: this.shape.verticesBuffer, stride: 2, offset: 0 },
            aNormal: { buffer: this.shape.verticesBuffer, stride: 2, offset: 1 }
        });
        if (this.extInstancedArrays) {
            this.drawInstanced(shader);
        } else {
            this.drawWithoutInstanced(shader);
        }
    }

    drawWithoutInstanced(shader) {
        const gl = this.gl;
        for (let i = 0; i < this.instancesCount; i++) {
            shader.setAttributes({
                aPointOffset: { constantValue: [this.offsets[i * 2], this.offsets[i * 2 + 1]] }
            });
            gl.drawArrays(gl.TRIANGLES, 0, this.shape.pointCount);
        }
    }

    drawInstanced(shader) {
        const gl = this.gl;
        shader.setAttributes({
            aPointOffset: { buffer: this.offsetsBuffer, instancesDivisor: 1 }
        });
        this.extInstancedArrays.drawArraysInstancedANGLE(gl.TRIANGLES, 0, this.shape.pointCount, this.instancesCount);
    }

    dispose() {
        this.shape = null;
        this.gl = null;
    }
}

class Plane {
    constructor(canvasgl, steps = 5) {
        const planeVerticesTemplates = [
            [0, 0, 1],
            [1, 0, 0],
            [0, 0, 0],
            [0, 0, 1],
            [1, 0, 1],
            [1, 0, 0]
        ];
        const planeNormal = [0, 1, 0];
        const planeVertices = [...Array(steps).keys()]
            .flatMap(row => [...Array(steps).keys()]
                .flatMap(col => planeVerticesTemplates.flatMap(v =>
                    [(v[0] + col) / steps * 2 - 1, v[1], (v[2] + row) / steps * 2 - 1, ...planeNormal])));
        const gl = this.gl = canvasgl.gl;
        this.verticesBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.verticesBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(planeVertices), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        this.pointCount = planeVertices.length / 6;
    }

    draw(shader) {
        const gl = this.gl;
        shader.setAttributes({
            aPointPos: { buffer: this.verticesBuffer, stride: 2, offset: 0 },
            aNormal: { buffer: this.verticesBuffer, stride: 2, offset: 1 },
            aPointOffset: { constantValue: [0, 0] }
        });
        gl.drawArrays(gl.TRIANGLES, 0, this.pointCount);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    dispose() {
        this.gl.deleteBuffer(this.verticesBuffer);
        this.gl = null;
    }
}

export { Shape, MultiShape, Plane };
