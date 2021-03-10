/* Input: Handles the keyboard input and changes the application state accordingly
    Triggers a manual redraw after a state change
*/

import { showStatus } from "./menu.js";
import { Labyrinth } from "./labyrinth.js";
import { Audio } from "./audio.js";

const TOUCH_TAP_UPPER_LIMIT = 10;
const TOUCH_SWIPE_LOWER_LIMIT = 30;

class Input {
    constructor(gameState, scene, socket) {
        var touchStart = null;
        document.getElementById("chat-form").onsubmit = (ev) => {
            const msg = document.getElementById("chat-msg").value;
            document.getElementById("chat-msg").value = "";
            document.getElementById("visualization").focus();
            socket.emit("cMsg", msg);
            showStatus(`Me: ${msg}`);
            ev.stopPropagation();
            ev.preventDefault();
        };
        document.getElementById("visualization").addEventListener("keydown", (ev) => {
            switch (ev.key) {
                case "ArrowDown":
                    gameState.requestDirection(Labyrinth.Direction.DOWN);
                    break;
                case "ArrowUp":
                    gameState.requestDirection(Labyrinth.Direction.UP);
                    break;
                case "ArrowLeft":
                    gameState.requestDirection(Labyrinth.Direction.LEFT);
                    break;
                case "ArrowRight":
                    gameState.requestDirection(Labyrinth.Direction.RIGHT);
                    break;

                case " ":
                    gameState.requestJump();
                    break;

                case "u":
                //case "i":
                //case "o":
                case "p":
                    scene.shader = scene.shaders[ev.key];
                    showStatus(`Enabled ${scene.shader.name}`);
                    break;

                case "t":
                    scene.light.isSpot = !scene.light.isSpot;
                    showStatus(`Spotlight ${scene.light.isSpot ? 'en' : 'dis'}abled`);
                    break;

                case "h":
                    scene.drawShadows = !scene.drawShadows;
                    showStatus(`Shadows ${scene.drawShadows ? 'en' : 'dis'}abled`);
                    break;

                default:
                    return;
            }
            Audio.start(); // this needs interactivity by the user due to browser restrictions
            ev.stopPropagation();
            ev.preventDefault();
        });

        document.addEventListener("touchstart", (ev) => {
            touchStart = { x: ev.changedTouches[0].screenX, y: ev.changedTouches[0].screenY };
        });
        document.addEventListener("touchend", (ev) => {
            Audio.start(); // this needs interactivity by the user due to browser restrictions
            const touchEnd = { x: ev.changedTouches[0].screenX, y: ev.changedTouches[0].screenY };
            if (!touchStart) {
                return;
            }
            const d = { x: touchEnd.x - touchStart.x, y: touchEnd.y - touchStart.y };
            const dAbs = { x: Math.abs(d.x), y: Math.abs(d.y) };
            if (dAbs.x < TOUCH_TAP_UPPER_LIMIT && dAbs.y < TOUCH_TAP_UPPER_LIMIT) {
                // tapped the screen
                gameState.requestJump();
            } else if (dAbs.x > dAbs.y && dAbs.x > TOUCH_SWIPE_LOWER_LIMIT) {
                // swiped horizontally
                gameState.requestDirection(d.x < 0 ? Labyrinth.Direction.LEFT : Labyrinth.Direction.RIGHT);
            } else if (dAbs.y > dAbs.x && dAbs.y > TOUCH_SWIPE_LOWER_LIMIT) {
                // swiped vertically
                gameState.requestDirection(d.y < 0 ? Labyrinth.Direction.UP : Labyrinth.Direction.DOWN);
            }
            touchStart = null;
        });
    }
}

export { Input };
