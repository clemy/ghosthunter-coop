// Gouraud/Diffuse Vertex Shader
precision mediump float;

attribute vec4 aPointPos;
attribute vec3 aNormal;
attribute vec2 aPointOffset;

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uWorldMatrix;
uniform mat4 uNormalsMatrix;
uniform vec3 uLightPosInView;
uniform vec3 uLightDirectionInView;
uniform float uLightLimitInner;
uniform float uLightLimitOuter;
uniform vec3 uLightPowerDiffuse;
uniform vec3 uColor;

varying vec3 vColor;

void main(void) {
    // get the normals in view space
    vec3 normalInView = normalize(mat3(uNormalsMatrix) * aNormal);
    
    vec4 pointInWorld4 = uWorldMatrix * aPointPos;
    pointInWorld4 += vec4(aPointOffset.x, 0.0, aPointOffset.y, 0.0);
    
    // get the vertex in view space
    vec4 pointInView4 = uViewMatrix * pointInWorld4;
    vec3 pointInView = vec3(pointInView4) / pointInView4.w;
    
    // calculate light
    vec3 pointToLight = normalize(uLightPosInView - pointInView);
    float spotLightFactor = smoothstep(uLightLimitOuter, uLightLimitInner, dot(-pointToLight, normalize(uLightDirectionInView)));
    vColor = spotLightFactor * max(dot(pointToLight, normalInView), 0.0) * uColor * uLightPowerDiffuse;
    
    // calculate vertex on the screen
    gl_Position = uProjectionMatrix * pointInView4;
}
