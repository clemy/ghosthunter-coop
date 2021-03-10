/* Scene: describes a scene containing a tree of objects with Shape and one Camera
    The shader and scene definitions are also located here at the moment.
*/

import { Color } from "./color.js";
import { Labyrinth } from "./labyrinth.js";
import { Matrix4, Transformation, Vector3 } from "./matrix.js";
import { Ghost, GhostHunter } from "./object.js";
import { ShaderProgram } from "./shader.js";
import { MultiShape } from "./shape.js";
import { showStatus } from "./menu.js";

const ShaderDescriptionCommon = {
    attributes: {
        aPointPos: { type: ShaderProgram.VariableTypes.t3fv },
        aNormal: { type: ShaderProgram.VariableTypes.t3fv },
        aPointOffset: { type: ShaderProgram.VariableTypes.t2f }
    },
    uniforms: {
        uLightPosInView: { type: ShaderProgram.VariableTypes.t3fv },
        uProjectionMatrix: { type: ShaderProgram.VariableTypes.tm4fv },
        uViewMatrix: { type: ShaderProgram.VariableTypes.tm4fv },
        uWorldMatrix: { type: ShaderProgram.VariableTypes.tm4fv },
        uNormalsMatrix: { type: ShaderProgram.VariableTypes.tm4fv },
        uColor: { type: ShaderProgram.VariableTypes.t3fv },
        uLightDirectionInView: { type: ShaderProgram.VariableTypes.t3fv },
        uLightLimitInner: { type: ShaderProgram.VariableTypes.t1f },
        uLightLimitOuter: { type: ShaderProgram.VariableTypes.t1f },
        uLightPowerAmbient: { type: ShaderProgram.VariableTypes.t3f },
        uLightPowerDiffuse: { type: ShaderProgram.VariableTypes.t3f },
        uLightPowerSpecular: { type: ShaderProgram.VariableTypes.t3f }
    }
};
const ShaderDescriptions = {
    p: {
        name: "Phong/Specular",
        vertexShaderURL: "shaders/light.vert",
        fragmentShaderURL: "shaders/light.frag",
        ...JSON.parse(JSON.stringify(ShaderDescriptionCommon))
    },
    u: {
        name: "Gouraud/Diffuse",
        vertexShaderURL: "shaders/light-gd.vert",
        fragmentShaderURL: "shaders/light-gd.frag",
        ...JSON.parse(JSON.stringify(ShaderDescriptionCommon))
    }
};
const InitialShader = "p";

const ShadowShaderDescription = {
    vertexShaderURL: "shaders/shadow.vert",
    fragmentShaderURL: "shaders/shadow.frag",
    attributes: {
        aPointPos: { type: ShaderProgram.VariableTypes.t3fv },
        aPointOffset: { type: ShaderProgram.VariableTypes.t2f }
    },
    uniforms: {
        uProjectionViewShadowMatrix: { type: ShaderProgram.VariableTypes.tm4fv },
        uWorldMatrix: { type: ShaderProgram.VariableTypes.tm4fv }
    }
};

const ShapeObjs = {
    box: "objs/box.obj",
    torus: "objs/torus.obj",
    sphere: "objs/sphere-small.obj",
    dome: "objs/halfdome.obj",
    ghost: "objs/ghost.obj"
};

class Camera {
    // some good start values for fov, near and far
    // can be changed for every redraw
    constructor(position) {
        this.transformation = new Transformation;
        this.transformation.translation = position.clone();
        this.fov = Math.PI / 2;
        this.near = 1;
        this.far = 100;
    }
    wcs2vcsMatrix() {
        return this.transformation.invmatrix();
    }
    wcs2vcsNormalsMatrix() {
        return this.transformation.invnormalsmatrix();
    }
    projectionMatrix(aspectRatio) {
        const cabinet = Matrix4.cabinet(15, aspectRatio, Math.atan(2), this.near, this.far);
        return cabinet;
    }
}

// TODO: add light (and camera) as Node to the scene tree
//   a recursive function could collect all lights with correct transformations
//   this would allow to mount lights on objects in the scene
// Decision: light rotation origin is center of light, as with all other objects
//   even if it does not make that much sense for point lights
//   but for spot lights
class Light {
    constructor(position) {
        this.transformation = new Transformation;
        this.transformation.translation = position.clone();
        this.lightDirection = Vector3.fromXYZ(0, -1, 0);
        this.isSpot = false;
    }
    position() {
        return this.transformation.translation; // same as multiply with origin
    }
    direction() {
        return this.transformation.matrix().mulV3(this.lightDirection);
    }
    innerLimit() {
        return this.isSpot ? Math.cos(Math.PI / 20) : -0.99999;
    }
    outerLimit() {
        return this.isSpot ? Math.cos(Math.PI / 18) : -1;
    }
}

class Node {
    constructor() {
        this.transformation = new Transformation;
        this.children = [];
        this.objects = [];
        this.enabled = true;
    }

    newChild() {
        const child = new Node();
        this.children.push(child);
        return child;
    }

    addObject(shape, color) {
        this.objects.push({ shape, color });
    }

    draw(shader, worldMatrix, normalsMatrix) {
        if (!this.enabled) {
            return;
        }
        worldMatrix = worldMatrix.mul4(this.transformation.matrix());
        normalsMatrix = normalsMatrix?.mul4(this.transformation.normalsmatrix());

        // draw all child nodes
        this.children.forEach(childNode => childNode.draw(shader, worldMatrix, normalsMatrix));

        if (this.objects.length > 0) {
            shader.setUniforms({
                uWorldMatrix: [worldMatrix.data],
                uNormalsMatrix: [normalsMatrix?.data]
            });

            // draw this nodes objects
            this.objects.forEach(object => {
                shader.setUniforms(
                    { uColor: [object.color] }
                );
                object.shape.draw(shader);
            });
        }
    }
}

class Scene {
    constructor(canvasgl, gameState) {
        this.canvasgl = canvasgl;
        this.gameState = gameState;
        this.camera = new Camera(Vector3.fromXYZ(24, 1, -10));
        this.light = null;
        this.shapes = {}; // this is a Shape cache
        this.world = null;
        this.shader = null;
        this.shaders = {};
        this.shadowShader = null;
        this.drawShadows = true;
        this.ground = null;
        this.version = 0;
    }

    // be aware it is async and can throw exceptions (reject promises)
    // as this loads shaders and objects from the server
    async load() {
        const shaders = Object.entries(ShaderDescriptions)
            .map(([name, desc]) => [name, this.canvasgl.newShaderProgram(desc)]);
        this.shaders = Object.fromEntries(shaders);
        this.shader = this.shaders[InitialShader];

        this.shadowShader = this.canvasgl.newShaderProgram(ShadowShaderDescription);

        // load shaders and objects in parallel
        await Promise.all([
            ...shaders.map(async ([, shader]) => shader.load()),
            this.shadowShader.load(),
            ...Object.entries(ShapeObjs).map(async ([, objFileName]) => this.loadShape(objFileName))
        ]);
    }

    // Shape Cache
    // be aware: if you call this "in parallel" you must wait till all promises
    // are fulfilled, as only the first one will really wait for the load
    async loadShape(objURL) {
        // shape cache
        let shape = this.shapes[objURL];
        if (!shape) {
            this.shapes[objURL] = shape = this.canvasgl.newShape(objURL);
            await shape.load();
        }
        return shape;
    }

    getShape(objURL) {
        return this.shapes[objURL];
    }

    setup() {
        this.canvasgl.setBackground(Color.BLACK);

        this.world = new Node();

        const borders = [];
        const unreachables = [];
        this.gameState.labyrinth.fields.forEach((fieldType, fieldNum) => {
            if (fieldType !== Labyrinth.FieldType.Normal) {
                const isBorder = fieldType == Labyrinth.FieldType.Border;
                const { x, y } = this.gameState.labyrinth.toCoord(fieldNum);
                if (isBorder) {
                    borders.push(x, -y);
                } else {
                    unreachables.push(x, -y);
                }
            }
        });

        const torusObj = this.getShape(ShapeObjs.torus);
        const boxObj = this.getShape(ShapeObjs.box);
        const useTorus = this.gameState.useTorus;
        showStatus("Playing the " + (useTorus ? "Torus" : "Box") + " level");
        const multiBordersObj = new MultiShape(useTorus ? torusObj : boxObj, borders.length);
        const bordersNode = this.world.newChild();
        bordersNode.transformation.translation = Vector3.fromXYZ(0, 0.3, 0);
        bordersNode.transformation.scale = useTorus ?
            Vector3.fromXYZ(0.4, 0.4, 0.4) :
            Vector3.fromXYZ(0.5, 0.3, 0.5);
        bordersNode.addObject(multiBordersObj, [0, 0, 0.7]);
        multiBordersObj.setOffsets(borders);

        const multiUnreachablesObj = new MultiShape(boxObj, unreachables.length);
        const unreachablesNode = this.world.newChild();
        unreachablesNode.transformation.translation = Vector3.fromXYZ(0, 0.01, 0);
        unreachablesNode.transformation.scale = Vector3.fromXYZ(0.5, 0.01, 0.5);
        unreachablesNode.addObject(multiUnreachablesObj, [0, 0.5, 0]);
        multiUnreachablesObj.setOffsets(unreachables);

        const fieldCount = this.gameState.labyrinth.fields.length;
        this.dotsCount = this.gameState.dots.size;
        this.multiDotsObj = new MultiShape(this.getShape(ShapeObjs.sphere), fieldCount);
        const dotsNode = this.world.newChild();
        dotsNode.transformation.translation = Vector3.fromXYZ(0, 0.5, 0);
        dotsNode.transformation.scale = Vector3.fromXYZ(0.1, 0.1, 0.1);
        dotsNode.addObject(this.multiDotsObj, [1, 1, 0]);
        this.multiDotsObj.setOffsets(this.gameState.getDotsArray());

        this.bigDotsCount = this.gameState.bigDots.size;
        this.multiBigDotsObj = new MultiShape(this.getShape(ShapeObjs.sphere), fieldCount);
        const bigDotsNode = this.world.newChild();
        bigDotsNode.transformation.translation = Vector3.fromXYZ(0, 0.5, 0);
        bigDotsNode.transformation.scale = Vector3.fromXYZ(0.2, 0.2, 0.2);
        bigDotsNode.addObject(this.multiBigDotsObj, [1, 1, 0]);
        this.multiBigDotsObj.setOffsets(this.gameState.getBigDotsArray());

        this.playersNode = this.world.newChild();
        this.playerNode = null;

        this.ghosts = this.gameState.ghosts.map(ghostState =>
            new Ghost(this.world, this.gameState, ghostState, this.getShape(ShapeObjs.ghost), this.getShape(ShapeObjs.dome)));

        const width = this.gameState.labyrinth.settings.width;
        const height = this.gameState.labyrinth.settings.height;

        this.ground = new Node();
        this.ground.addObject(this.canvasgl.newPlane(), [1.0, 1.0, 1.0]);
        this.ground.transformation.translation = Vector3.fromXYZ((width - 1) / 2, 0, -(height - 1) / 2);
        this.ground.transformation.scale = Vector3.fromXYZ(width / 2, 1, height / 2);

        const middleX = this.gameState.labyrinth.settings.middlePos.x;
        this.light = new Light(Vector3.fromXYZ(middleX + 10, 15, 10));

        this.version = this.gameState.version;
    }

    updatePlayers(deltaTime) {
        const players = this.gameState.players;
        // delete nodes of non existing players
        this.playersNode.children = this.playersNode.children.filter(
            node => players.has(node.playerId)
        );

        if (players.size != this.playersNode.children.length) {
            // add new players
            const newPlayers = new Map(players);
            this.playersNode.children.forEach(node => newPlayers.delete(node.playerId));

            newPlayers.forEach(player => {
                const ghostHunter = new GhostHunter(this.playersNode, this.gameState, player, this.getShape(ShapeObjs.dome));
                ghostHunter.ghosthunterNode.playerId = player.id;
                ghostHunter.ghosthunterNode.playerObj = ghostHunter; // TODO: check if this circular reference is a memory leak problem
                if (player.me) {
                    this.playerNode = ghostHunter.ghosthunterNode;
                }
            });
        }

        this.playersNode.children.forEach(node => node.playerObj.update(deltaTime));
    }

    draw(deltaTime) {
        this.gameState.update(deltaTime);
        if (this.gameState.version == 0) {
            return;
        }
        if (this.gameState.version != this.version) {
            this.setup();
        }
        this.updatePlayers(deltaTime);
        this.ghosts.forEach(ghost => ghost.update(deltaTime));
        if (this.gameState.dots.size != this.dotsCount) {
            this.multiDotsObj.setOffsets(this.gameState.getDotsArray());
            this.dotsCount = this.gameState.dots.size;
        }
        if (this.gameState.bigDots.size != this.bigDotsCount) {
            this.multiBigDotsObj.setOffsets(this.gameState.getBigDotsArray());
            this.bigDotsCount = this.gameState.bigDots.size;
        }
        const playerPos = this.playerNode.transformation.translation;
        const canvasClientWidth = this.canvasgl.canvas.clientWidth;
        const menuWidthInWorldCoords = 400 / canvasClientWidth * 15;
        this.camera.transformation.translation = Vector3.fromXYZ(playerPos.x - menuWidthInWorldCoords / 2, 0.5, playerPos.z);
        //this.light.transformation.translation = this.ghostHunter.ghosthunterNode.transformation.translation.add3(Vector3.fromXYZ(13, 15, 13));
        this.light.lightDirection = playerPos.sub3(this.light.position());

        const gl = this.canvasgl.gl;
        this.canvasgl.clear();
        const viewMatrix = this.camera.wcs2vcsMatrix();
        const projectionMatrix = this.camera.projectionMatrix(this.canvasgl.aspectRatio());
        const normalsMatrix = this.camera.wcs2vcsNormalsMatrix();
        const lightPosInView = viewMatrix.mulV(this.light.position());
        const lightDirectionInView = viewMatrix.mulV3(this.light.direction());

        // draw the ground plane with ambient light (no shadows)
        this.shader.use();
        this.shader.setUniforms({
            uLightPosInView: [lightPosInView.data],
            uLightDirectionInView: [lightDirectionInView.data], // this is not normalized yet
            uLightLimitInner: [this.light.innerLimit()],
            uLightLimitOuter: [this.light.outerLimit()],
            uLightPowerAmbient: [1.0, 1.0, 1.0],
            uLightPowerDiffuse: [0.0, 0.0, 0.0],
            uLightPowerSpecular: [0.0, 0.0, 0.0],
            uProjectionMatrix: [projectionMatrix.data],
            uViewMatrix: [viewMatrix.data]
        });
        gl.enable(gl.STENCIL_TEST);
        gl.stencilFunc(gl.ALWAYS, 1, 1);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE); // ground plane will be marked with 1, rest is 0
        this.ground.draw(this.shader, new Matrix4(), normalsMatrix);

        gl.disable(gl.DEPTH_TEST); // shadow and light must update ground plane (no depth check and no depth change)
        if (this.drawShadows) {
            // shadow projection, see "shadow-projection-matrix.txt" for
            // the construction of this matrix 
            // this is transposed, because of WebGL column/row matrix mode
            // objects above light get clipped away by negative w
            // light position is in world space
            const [lx, ly, lz] = this.light.position().data;
            // project the shadow on the ground plane in world space, g = 0
            const shadowMatrix = new Matrix4([
                ly, 0, 0, 0,
                -lx, 0, -lz, -1,
                0, 0, ly, 0,
                0, 0, 0, ly
            ]);
            // project shadow to ground plane, transform to view space and then project onto screen
            const shadowProjectionMatrix = projectionMatrix.mul4(viewMatrix).mul4(shadowMatrix);
            this.shadowShader.use();
            this.shadowShader.setUniforms({
                uProjectionViewShadowMatrix: [shadowProjectionMatrix.data]
            });
            gl.stencilFunc(gl.EQUAL, 1, 1);
            gl.stencilOp(gl.KEEP, gl.KEEP, gl.DECR); // shadowed areas will become 0
            gl.colorMask(false, false, false, false); // just update the stencil buffer
            this.world.draw(this.shadowShader, new Matrix4(), null);
            gl.colorMask(true, true, true, true);
        }

        // draw the ground plane with diffuse light and add(blend) it to the screen
        this.shader.use();
        this.shader.setUniforms({
            uLightPosInView: [lightPosInView.data],
            uLightDirectionInView: [lightDirectionInView.data], // this is not normalized yet
            uLightLimitInner: [this.light.innerLimit()],
            uLightLimitOuter: [this.light.outerLimit()],
            uLightPowerAmbient: [0.0, 0.0, 0.0],
            uLightPowerDiffuse: [1.0, 1.0, 1.0],
            uLightPowerSpecular: [0.0, 0.0, 0.0],
            uProjectionMatrix: [projectionMatrix.data],
            uViewMatrix: [viewMatrix.data]
        });
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE); // add light
        gl.stencilFunc(gl.EQUAL, 1, 1); // just draw where a) there is ground plane and b) no shadow
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
        this.ground.draw(this.shader, new Matrix4(), normalsMatrix);
        gl.blendFunc(gl.ONE, gl.ZERO);
        gl.disable(gl.BLEND);
        gl.disable(gl.STENCIL_TEST);
        gl.enable(gl.DEPTH_TEST);

        // draw the objects with full light
        this.shader.use();
        this.shader.setUniforms({
            uLightPowerAmbient: [1.0, 1.0, 1.0],
            uLightPowerSpecular: [1.0, 1.0, 1.0],
        });
        this.world.draw(this.shader, new Matrix4(), normalsMatrix);
    }

    dispose() {
        this.world = null;
        Object.values(this.shapes).forEach(shape => shape.dispose());
        this.ground = null;
        this.shapes = {};
        this.shader = null;
        Object.values(this.shaders).forEach(shader => shader.dispose());
        this.shaders = {};
        this.shadowShader.dispose();
        this.shadowShader = null;
        this.canvasgl = null;
    }
}

export { Scene };
