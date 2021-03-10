/* ShaderProgram: loads and compile shader code
    loads vertex and fragment shaders from the server
    compiles them and provides access to the attributes
    and uniforms all according a shader description object.

    For an example shader description object
    check out the scene.js code.

    use(uniforms) must be called before drawing after setting up
    draw buffers. It enables the attributes and sets the uniforms.
    uniforms is a key, value map. value must be an array, also
    for single values.
*/

class Shader {
    constructor(gl, type, shaderURL) {
        this.gl = gl;
        this.type = type;
        this.shaderURL = shaderURL;
        this.shader = null;
    }

    async load() {
        const response = await fetch(this.shaderURL);
        if (!response.ok) {
            throw `Failed to load shader "${this.shaderURL}": ${response.statusText}`;
        }
        const shaderCode = await response.text();
        this.shader = this.gl.createShader(this.type);
        this.gl.shaderSource(this.shader, shaderCode);
        this.gl.compileShader(this.shader);
        if (!this.gl.getShaderParameter(this.shader, this.gl.COMPILE_STATUS)) {
            const error = `Failed to compile shader "${this.shaderURL}": ${this.gl.getShaderInfoLog(this.shader)}`;
            this.dispose();
            throw error;
        }
    }

    dispose() {
        if (this.shader !== null) {
            this.gl.deleteShader(this.shader);
        }
        this.shader = null;
    }
}

class ShaderProgram {
    constructor(canvasgl, shaderDescription) {
        this.canvasgl = canvasgl;
        const gl = this.gl = canvasgl.gl;
        this.shaderProgram = null;
        this.shaders = [
            new Shader(gl, gl.VERTEX_SHADER, shaderDescription.vertexShaderURL),
            new Shader(gl, gl.FRAGMENT_SHADER, shaderDescription.fragmentShaderURL)
        ];
        this.attributes = shaderDescription.attributes;
        this.uniforms = shaderDescription.uniforms;
        this.name = shaderDescription.name;
    }

    async load() {
        await Promise.all(this.shaders.map(shader => shader.load()));
        this.shaderProgram = this.gl.createProgram();
        this.shaders.forEach(shader => this.gl.attachShader(this.shaderProgram, shader.shader));
        this.gl.linkProgram(this.shaderProgram);
        if (!this.gl.getProgramParameter(this.shaderProgram, this.gl.LINK_STATUS)) {
            const error = "Failed to link shader program: " + this.gl.getProgramInfoLog(this.shaderProgram);
            this.dispose();
            throw error;
        }
        Object.entries(this.attributes).forEach(([key, value]) => {
            this.attributes[key].handle = this.gl.getAttribLocation(this.shaderProgram, key);
            this.attributes[key].vertexFunc = this.gl[value.type.vertexFuncName].bind(this.gl, this.attributes[key].handle);
        });
        Object.entries(this.uniforms).forEach(([key, value]) => {
            this.uniforms[key].handle = this.gl.getUniformLocation(this.shaderProgram, key);
            if (value.type.matrix) {
                this.uniforms[key].func = this.gl[value.type.uniformFuncName].bind(this.gl, this.uniforms[key].handle, false);
            } else {
                this.uniforms[key].func = this.gl[value.type.uniformFuncName].bind(this.gl, this.uniforms[key].handle);
            }
        });
    }

    use() {
        const gl = this.gl;
        gl.useProgram(this.shaderProgram);
    }

    setUniforms(uniformValues) {
        const gl = this.gl;
        Object.entries(uniformValues).forEach(([key, value]) => this.uniforms[key]?.func.apply(gl, value));
    }

    setAttributes(attributeBuffers) {
        const gl = this.gl;
        Object.entries(attributeBuffers).forEach(([key, value]) => {
            if (this.attributes[key]) {
                if (value.buffer) {
                    gl.enableVertexAttribArray(this.attributes[key].handle);
                    gl.bindBuffer(gl.ARRAY_BUFFER, value.buffer);
                    gl.vertexAttribPointer(
                        this.attributes[key].handle,
                        this.attributes[key].type.size,
                        gl[this.attributes[key].type.attribType],
                        false,
                        (value.stride ?? 0) * this.attributes[key].type.size * 4,
                        (value.offset ?? 0) * this.attributes[key].type.size * 4
                    );
                    if (this.canvasgl.extInstancedArrays) {
                        this.canvasgl.extInstancedArrays.vertexAttribDivisorANGLE(
                            this.attributes[key].handle,
                            value.instancesDivisor ?? 0);
                    }
                } else {
                    gl.disableVertexAttribArray(this.attributes[key].handle);
                    this.attributes[key].vertexFunc.apply(gl, value.constantValue);
                }
            }
        });
    }

    dispose() {
        if (this.shaderProgram !== null) {
            this.gl.deleteProgram(this.shaderProgram);
        }
        this.shaderProgram = null;
        this.shaders.forEach(shader => shader.dispose());
        this.shaders = [];
    }
}

ShaderProgram.VariableTypes = {
    t1i: { uniformFuncName: "uniform1i", matrix: false },
    t1f: { uniformFuncName: "uniform1f", matrix: false, vertexFuncName: "vertexAttrib1f", attribType: "FLOAT", size: 1 },
    t2f: { uniformFuncName: "uniform2f", matrix: false, vertexFuncName: "vertexAttrib2f", attribType: "FLOAT", size: 2 },
    t3f: { uniformFuncName: "uniform3f", matrix: false, vertexFuncName: "vertexAttrib3f", attribType: "FLOAT", size: 3 },
    t4f: { uniformFuncName: "uniform4f", matrix: false, vertexFuncName: "vertexAttrib4f", attribType: "FLOAT", size: 4 },
    t1iv: { uniformFuncName: "uniform1iv", matrix: false },
    t1fv: { uniformFuncName: "uniform1fv", matrix: false, vertexFuncName: "vertexAttrib1fv", attribType: "FLOAT", size: 1 },
    t2fv: { uniformFuncName: "uniform2fv", matrix: false, vertexFuncName: "vertexAttrib2fv", attribType: "FLOAT", size: 2 },
    t3fv: { uniformFuncName: "uniform3fv", matrix: false, vertexFuncName: "vertexAttrib3fv", attribType: "FLOAT", size: 3 },
    t4fv: { uniformFuncName: "uniform4fv", matrix: false, vertexFuncName: "vertexAttrib4fv", attribType: "FLOAT", size: 4 },
    tm4fv: { uniformFuncName: "uniformMatrix4fv", matrix: true }
};

export { ShaderProgram };
