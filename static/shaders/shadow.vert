// Shadow Vertex Shader
precision mediump float;

attribute vec4 aPointPos;
attribute vec2 aPointOffset;

uniform mat4 uProjectionViewShadowMatrix;
uniform mat4 uWorldMatrix;

varying vec3 vPointInWorld;

void main(void) {
    // get the vertex in world space
    vec4 pointInWorld4 = uWorldMatrix * aPointPos;
    pointInWorld4 += vec4(aPointOffset.x, 0.0, aPointOffset.y, 0.0);
    
    vPointInWorld = vec3(pointInWorld4) / pointInWorld4.w;
    
    // calculate vertex on the ground plane and then on the screen via the projection matrix
    gl_Position = uProjectionViewShadowMatrix * pointInWorld4;
}
