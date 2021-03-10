#!/bin/bash
pm2 start app.mjs --time # --watch --ignore-watch=".git node_modules static"

