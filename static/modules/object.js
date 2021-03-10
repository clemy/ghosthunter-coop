import { Vector3 } from "./matrix.js";

const CHARACTER_SPEED_ROTATE = 1;
const GHOSTHUNTER_SPEED_MOUTH = 1;

class RotateHelper {
    constructor(rotateSpeed, initialDirection = 0) {
        this.rotateSpeed = rotateSpeed;
        // direction is 0 right, 1 up, 2 left, 3 down and all intermediates
        this.faceDirection = initialDirection;
    }

    update(deltaTime, faceDirectionTarget) {
        if (this.faceDirection != faceDirectionTarget) {
            let faceDeltaRemaining = faceDirectionTarget - this.faceDirection;
            let faceDeltaRotation = deltaTime * 4 * this.rotateSpeed;
            if (Math.abs(faceDeltaRemaining) > 2) {
                faceDeltaRemaining = (0 - faceDeltaRemaining) % 4;
            }
            if (Math.abs(faceDeltaRemaining) < faceDeltaRotation) {
                this.faceDirection = faceDirectionTarget;
            } else {
                this.faceDirection = (this.faceDirection + Math.sign(faceDeltaRemaining) * faceDeltaRotation) % 4;
            }
        }
    }
}

class GhostHunter {
    constructor(node, gameState, playerState, halfDomeObj) {
        this.gameState = gameState;
        this.playerState = playerState;
        this.mouthPosition = 0;
        this.rotateHelper = new RotateHelper(CHARACTER_SPEED_ROTATE, playerState.dir);

        this.origColor = this.playerState.me ? [1, 1, 0] : [0.96, 0.63, 0.78];
        this.color = [...this.origColor];
        this.dimmedColor = this.color.map(v => v / 2);
        this.ghosthunterNode = node.newChild();
        this.ghosthunterNode.transformation.scale = Vector3.fromXYZ(0.4, 0.4, 0.4);
        //this.ghosthunterNode.transformation.translation = Vector3.fromXYZ(24, 0.5, -10);
        this.ghosthunterUpperHalfNode = this.ghosthunterNode.newChild();
        this.ghosthunterUpperHalfNode.transformation.scale = Vector3.fromXYZ(0.99, 0.99, 0.99);
        this.ghosthunterUpperHalfNode.addObject(halfDomeObj, this.color);
        const leftEyeNode = this.ghosthunterUpperHalfNode.newChild();
        leftEyeNode.transformation.rotation = Vector3.fromXYZ(0, Math.PI / 4, 0);
        const leftEyeNodeSub = leftEyeNode.newChild();
        leftEyeNodeSub.transformation.rotation = Vector3.fromXYZ(0, 0, -Math.PI / 4);
        leftEyeNodeSub.transformation.translation = Vector3.fromXYZ(0.63, 0.63, 0.0);
        leftEyeNodeSub.transformation.scale = Vector3.fromXYZ(0.2, 0.2, 0.2);
        leftEyeNodeSub.addObject(halfDomeObj, [1, 1, 1]);
        const rightEyeNode = this.ghosthunterUpperHalfNode.newChild();
        rightEyeNode.transformation.rotation = Vector3.fromXYZ(0, -Math.PI / 4, 0);
        const rightEyeNodeSub = rightEyeNode.newChild();
        rightEyeNodeSub.transformation.rotation = Vector3.fromXYZ(0, 0, -Math.PI / 4);
        rightEyeNodeSub.transformation.translation = Vector3.fromXYZ(0.63, 0.63, 0.0);
        rightEyeNodeSub.transformation.scale = Vector3.fromXYZ(0.2, 0.2, 0.2);
        rightEyeNodeSub.addObject(halfDomeObj, [1, 1, 1]);
        const ghosthunterLowerHalfNode = this.ghosthunterNode.newChild();
        ghosthunterLowerHalfNode.transformation.scale = Vector3.fromXYZ(1, -1, 1);
        ghosthunterLowerHalfNode.addObject(halfDomeObj, this.color);
    }

    update(deltaTime) {
        if (this.gameState.running && this.playerState.lives > 0) {
            this.mouthPosition = (this.mouthPosition + deltaTime * GHOSTHUNTER_SPEED_MOUTH) % 1;
            this.ghosthunterUpperHalfNode.transformation.rotation.z = Math.PI / 4 * Math.abs((this.mouthPosition * 2) - 1);

            this.rotateHelper.update(deltaTime, this.playerState.dir);
        }
        if (this.playerState.lives <= 0 || ((this.playerState.invulnerableTimer % 1) * 10) % 2 > 1) {
            this.color.splice(0, 3, ...this.dimmedColor);
        } else {
            this.color.splice(0, 3, ...this.origColor);
        }
        this.ghosthunterNode.transformation.rotation.y = this.rotateHelper.faceDirection * Math.PI / 2;

        const pos = this.playerState.pos;
        this.ghosthunterNode.transformation.translation = Vector3.fromXYZ(
            pos.x,
            (this.playerState.jumpHeight ?? 0) * 1 + 0.5,
            -pos.y);
    }
}

class Ghost {
    constructor(node, gameState, ghostState, ghostObj, halfDomeObj) {
        this.gameState = gameState;
        this.ghostState = ghostState;
        this.rotateHelper = new RotateHelper(CHARACTER_SPEED_ROTATE, ghostState.dir);

        this.color = [...this.ghostState.color];
        this.dimmedColor = this.color.map(v => v / 2);
        this.ghostNode = node.newChild();
        this.ghostNode.transformation.scale = Vector3.fromXYZ(0.4, 0.4, 0.4);
        this.ghostNode.addObject(ghostObj, this.color);
        const leftEyeNode = this.ghostNode.newChild();
        leftEyeNode.transformation.rotation = Vector3.fromXYZ(0, Math.PI / 4, 0);
        const leftEyeNodeSub = leftEyeNode.newChild();
        leftEyeNodeSub.transformation.rotation = Vector3.fromXYZ(0, 0, -Math.PI / 4);
        leftEyeNodeSub.transformation.translation = Vector3.fromXYZ(0.63, 0.63, 0.0);
        leftEyeNodeSub.transformation.scale = Vector3.fromXYZ(0.2, 0.2, 0.2);
        leftEyeNodeSub.addObject(halfDomeObj, [1, 1, 1]);
        const rightEyeNode = this.ghostNode.newChild();
        rightEyeNode.transformation.rotation = Vector3.fromXYZ(0, -Math.PI / 4, 0);
        const rightEyeNodeSub = rightEyeNode.newChild();
        rightEyeNodeSub.transformation.rotation = Vector3.fromXYZ(0, 0, -Math.PI / 4);
        rightEyeNodeSub.transformation.translation = Vector3.fromXYZ(0.63, 0.63, 0.0);
        rightEyeNodeSub.transformation.scale = Vector3.fromXYZ(0.2, 0.2, 0.2);
        rightEyeNodeSub.addObject(halfDomeObj, [1, 1, 1]);
    }

    update(deltaTime) {
        if (this.gameState.running) {
            this.rotateHelper.update(deltaTime, this.ghostState.dir);
        }
        const blinkFactor = this.gameState.ghostHuntingTimer < 1 ? 16 : 4;
        if (((this.gameState.ghostHuntingTimer % 1) * blinkFactor) % 2 > 1) {
            this.color.splice(0, 3, ...this.dimmedColor);
        } else {
            this.color.splice(0, 3, ...this.ghostState.color);
        }
        this.ghostNode.enabled = this.ghostState.capturedTimer <= 0;
        this.ghostNode.transformation.rotation.y = this.rotateHelper.faceDirection * Math.PI / 2;

        const pos = this.ghostState.pos;
        this.ghostNode.transformation.translation = Vector3.fromXYZ(
            pos.x,
            0.5,
            -pos.y);
    }
}

export { GhostHunter, Ghost };