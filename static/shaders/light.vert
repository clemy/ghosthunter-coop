// Phong/Specular Vertex Shader
precision mediump float;

attribute vec4 aPointPos;
attribute vec3 aNormal;
attribute vec2 aPointOffset;

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uWorldMatrix;
uniform mat4 uNormalsMatrix;

varying vec3 vPointInView;
varying vec3 vNormalInView;

void main(void) {
    // get the normals in view space
    vNormalInView = mat3(uNormalsMatrix) * aNormal;
    
    vec4 pointInWorld4 = uWorldMatrix * aPointPos;
    pointInWorld4 += vec4(aPointOffset.x, 0.0, aPointOffset.y, 0.0);
    
    // get the vertex in view space
    vec4 pointInView4 = uViewMatrix * pointInWorld4;
    vPointInView = vec3(pointInView4) / pointInView4.w;
    
    // calculate vertex on the screen
    gl_Position = uProjectionMatrix * pointInView4;
}
