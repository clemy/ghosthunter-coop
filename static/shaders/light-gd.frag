// Gouraud/Diffuse Fragment Shader
precision mediump float;

varying vec3 vColor;

void main() {
    // use the color (interpolated) from the vertex shader
    gl_FragColor = vec4(vColor, 1.0);
}
