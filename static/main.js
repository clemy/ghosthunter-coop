/* main: sets everything up so that the games can begin
*/

import { CanvasGL } from "./modules/canvasgl.js";
import { showStatus, hideWait } from "./modules/menu.js";
import { Input } from "./modules/input.js";
import { GameState } from "./modules/gamestate.js";

(async function () {
    try {
        const canvasgl = new CanvasGL(document.getElementById("visualization"));

        const socket = io();
        socket.on("sMsg", text => showStatus(text));

        const gameState = new GameState(socket);

        const scene = canvasgl.newScene(gameState);
        await scene.load();

        const drawloop = canvasgl.newDrawLoop(scene);

        const input = new Input(gameState, scene, socket);
        document.getElementById("visualization").focus();

        drawloop.start();
        showStatus("Waiting for game..")
        hideWait();

    } catch (error) {
        showStatus(error, showStatus.Severity.ERROR);
        hideWait();
    }
})();
