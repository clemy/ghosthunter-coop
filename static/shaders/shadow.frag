// Shadow Fragment Shader
precision mediump float;

varying vec3 vPointInWorld;

void main() {
    // as we are working in world space, we can easily compare with the ground plane height
    if (vPointInWorld.y <= 0.0) {
        discard;
    }
    // we do not really draw this, as drawing to backbuffer is disabled
    // we just update the stencil buffer
    // RED for debugging
    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
}
