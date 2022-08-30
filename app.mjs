import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import { uniqueNamesGenerator, adjectives, animals } from "unique-names-generator";
import { GameState } from "./gamestate.mjs";
import { GameLoop } from "./gameloop.mjs";

const LOOP_DELAY = 1 / 50;

const app = express();
const http = createServer(app);
const io = new Server(http);

const randomName = uniqueNamesGenerator.bind(null, {
    dictionaries: [adjectives, animals],
    style: "capital",
    separator: ""
});

console.log("GhostHunt Coop Server");
console.log("  Version 1.0.0");

const gameState = new GameState(io);
gameState.setup();
const gameLoop = new GameLoop(LOOP_DELAY, gameState);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(join(__dirname, "static")));

io.on("connect", (socket) => {
    const username = randomName();
    console.log(username, "connected as", socket.id);

    socket.on("cMsg", text => {
        socket.broadcast.emit("sMsg", `${username}: ${text}`);
        console.log(`${username}: ${text}`);
    });

    socket.on('disconnect', (reason) => {
        console.log(username, "disconnected as", socket.id);
        socket.broadcast.emit("sMsg", `${username} left`);
    });

    socket.broadcast.emit("sMsg", `${username} joined`);
    socket.emit("sMsg", `Hi ${username}`);
    gameState.newPlayer(socket, username);
    gameLoop.start();
});

http.listen(8080, function () {
    console.log();
    console.log("Start your browser and go to http://localhost:8080/");
});
