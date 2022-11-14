/* Vector3, Matrix4, Transformation: all the matrix math needed
    plus transformation and projection matrix calculation.
    And a utility class for describing object transformations.

    TODO: provide more data types and math operations if needed
*/

class Vector3 {
    constructor(v = [0, 0, 0]) {
        this.d = v;
    }

    get data() {
        return this.d;
    }
    get x() {
        return this.d[0];
    }
    get y() {
        return this.d[1];
    }
    get z() {
        return this.d[2];
    }
    set x(x) {
        this.d[0] = x;
    }
    set y(y) {
        this.d[1] = y;
    }
    set z(z) {
        this.d[2] = z;
    }

    clone() {
        return new Vector3([...this.d]);
    }

    // add vector
    add3(v) {
        return new Vector3(this.d.map((x, i) => x + v.d[i]));
    }
    // subtract vector
    sub3(v) {
        return new Vector3(this.d.map((x, i) => x - v.d[i]));
    }
    // multiply with scalar
    mul1(s) {
        return new Vector3(this.d.map((x) => x * s));
    }
    // component inverse
    invC() {
        return new Vector3(this.d.map((x) => 1 / x));
    }
}

Vector3.fromXYZ = function (x, y, z) {
    return new Vector3([x, y, z]);
};

class Matrix4 {
    constructor(m = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]) {
        this.d = m;
    }

    get data() {
        return this.d;
    }

    clone() {
        return new Matrix4([...this.d]);
    }

    mulV(v) {
        const w = v.x * this.d[3] + v.y * this.d[7] + v.z * this.d[11] + this.d[15];
        return Vector3.fromXYZ(
            (v.x * this.d[0] + v.y * this.d[4] + v.z * this.d[8] + this.d[12]) / w,
            (v.x * this.d[1] + v.y * this.d[5] + v.z * this.d[9] + this.d[13]) / w,
            (v.x * this.d[2] + v.y * this.d[6] + v.z * this.d[10] + this.d[14]) / w,
        );
    }

    // multiply without translation (only 3x3 matrix)
    mulV3(v) {
        return Vector3.fromXYZ(
            v.x * this.d[0] + v.y * this.d[4] + v.z * this.d[8],
            v.x * this.d[1] + v.y * this.d[5] + v.z * this.d[9],
            v.x * this.d[2] + v.y * this.d[6] + v.z * this.d[10]
        );
    }

    mul4(m) {
        let ret = new Matrix4;
        // let the JIT compiler optimize this for now..
        // can JS engines vectorize already like gcc?
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                let s = 0;
                for (let i = 0; i < 4; i++) {
                    s += this.d[r + i * 4] * m.d[i + c * 4];
                }
                ret.d[r + c * 4] = s;
            }
        }
        return ret;
    }
}

Matrix4.translate = function (x, y, z) {
    return new Matrix4([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        x, y, z, 1
    ]);
};
Matrix4.translateV = function (v) {
    return Matrix4.translate(v.x, v.y, v.z);
};

Matrix4.scale = function (x, y, z) {
    return new Matrix4([
        x, 0, 0, 0,
        0, y, 0, 0,
        0, 0, z, 0,
        0, 0, 0, 1
    ]);
};
Matrix4.scaleV = function (v) {
    return Matrix4.scale(v.x, v.y, v.z);
};

Matrix4.rotateX = function (angle) {
    const s = Math.sin(angle);
    const c = Math.cos(angle);
    return new Matrix4([
        1, 0, 0, 0,
        0, c, s, 0,
        0, -s, c, 0,
        0, 0, 0, 1
    ]);
};
Matrix4.rotateY = function (angle) {
    const s = Math.sin(angle);
    const c = Math.cos(angle);
    return new Matrix4([
        c, 0, -s, 0,
        0, 1, 0, 0,
        s, 0, c, 0,
        0, 0, 0, 1
    ]);
};
Matrix4.rotateZ = function (angle) {
    const s = Math.sin(angle);
    const c = Math.cos(angle);
    return new Matrix4([
        c, s, 0, 0,
        -s, c, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ]);
};

Matrix4.perspective = function (fov, aspect, near, far) {
    // from Mozilla WebGL documentation
    var f = 1.0 / Math.tan(fov / 2);
    var rangeInv = 1 / (near - far);

    return new Matrix4([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (near + far) * rangeInv, -1,
        0, 0, near * far * rangeInv * 2, 0
    ]);
};

// TODO: near/far not correctily handled. does it need to be fixed?
Matrix4.cabinet = function (width, aspect, angle, near, far) {
    const x = 2 / width;
    const y = x * aspect;
    const s = y * Math.sin(angle) / 2;
    const c = x * Math.cos(angle) / 2;
    return new Matrix4([
        x, 0, 0, 0,
        0, y, 0, 0,
        -c, -s, -2 / (far - near), 0,
        0, 0, 0, 1
    ]);
}

class Transformation {
    constructor() {
        this.rotation = new Vector3;
        this.scale = new Vector3([1, 1, 1]);
        this.translation = new Vector3;
    }
    matrix() {
        let m = Matrix4.scaleV(this.scale);
        m = Matrix4.rotateY(this.rotation.y).mul4(m);
        m = Matrix4.rotateZ(this.rotation.z).mul4(m);
        m = Matrix4.rotateX(this.rotation.x).mul4(m);
        return Matrix4.translateV(this.translation).mul4(m);
    }

    // this is a handy function for camera matrix calculation
    invmatrix() {
        // build inverse according: (A * B)^-1 = B^-1 * A^-1
        // and skip implementing the 4x4 matrix inverse for now..
        let m = Matrix4.translateV(this.translation.mul1(-1));
        m = Matrix4.rotateX(-this.rotation.x).mul4(m);
        m = Matrix4.rotateZ(-this.rotation.z).mul4(m);
        m = Matrix4.rotateY(-this.rotation.y).mul4(m);
        return Matrix4.scaleV(this.scale.invC()).mul4(m);
    }

    normalsmatrix() {
        // also skip building inverse
        // instead of transpose(inverse()) do this:
        let m = Matrix4.scaleV(this.scale.invC());
        m = Matrix4.rotateY(this.rotation.y).mul4(m);
        m = Matrix4.rotateZ(this.rotation.z).mul4(m);
        return Matrix4.rotateX(this.rotation.x).mul4(m);
    }

    invnormalsmatrix() {
        let m = Matrix4.rotateX(-this.rotation.x);
        m = Matrix4.rotateZ(-this.rotation.z).mul4(m);
        m = Matrix4.rotateY(-this.rotation.y).mul4(m);
        return Matrix4.scaleV(this.scale).mul4(m);
    }
}

export { Vector3, Matrix4, Transformation };
