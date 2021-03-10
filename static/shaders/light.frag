// Phong/Specular Fragment Shader
precision mediump float;

uniform vec3 uColor;
uniform vec3 uLightPosInView;
uniform vec3 uLightDirectionInView;
uniform float uLightLimitInner;
uniform float uLightLimitOuter;
uniform vec3 uLightPowerAmbient;
uniform vec3 uLightPowerDiffuse;
uniform vec3 uLightPowerSpecular;

varying vec3 vPointInView;
varying vec3 vNormalInView;

void main() {
    // material constants (later via uniforms)
    const float uMaterialKAmbient = 0.3;
    const float uMaterialKDiffuse = 0.7;
    const float uMaterialKSpecular = 1.0;
    const float uMaterialExpSpecular = 40.0;
    
    float pColor = vPointInView.x - floor(vPointInView.x);
    pColor = 1.0;
    
    // calculate and normalize vectors from interpolated values
    vec3 pointToLight = normalize(uLightPosInView - vPointInView);
    float spotLightFactor = smoothstep(uLightLimitOuter, uLightLimitInner, dot(-pointToLight, normalize(uLightDirectionInView)));
    vec3 pointToViewer = normalize(-vPointInView); // viewer is in origin
    vec3 normalInView = normalize(vNormalInView);
    //vec3 lightReflectionVector = 2.0 * dot(pointToLight, normalInView) * normalInView - pointToLight;
    vec3 lightReflectionVector = reflect(-pointToLight, normalInView);
    
    // calculate light radiation
    vec3 ambient = uColor * pColor * uMaterialKAmbient * uLightPowerAmbient;
    vec3 diffuse = spotLightFactor * max(dot(pointToLight, normalInView), 0.0)
    * uColor * pColor * uMaterialKDiffuse * uLightPowerDiffuse;
    vec3 specular = spotLightFactor * pow(max(dot(pointToViewer, lightReflectionVector), 0.0), uMaterialExpSpecular)
    * uMaterialKSpecular * uLightPowerSpecular;
    
    // sum up light radiation
    gl_FragColor = vec4(ambient + diffuse + specular, 1.0);
}
