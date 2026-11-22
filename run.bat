@echo off
SETLOCAL EnableDelayedExpansion

echo ==========================================================
echo  Fake News Detection (Ganache GUI + NLP) - Quick Launcher
echo ==========================================================
echo.
echo  * Note: Please make sure Ganache GUI is running!
echo.
echo Select an option:
echo [A] Launch Services (Python NLP Microservice + React Web App in separate windows)
echo [1] Compile and Deploy Smart Contracts to Ganache GUI (Truffle Migrate)
echo [2] Start Python NLP Backend Server (Port 5000)
echo [3] Start React Frontend Web Application (Port 3000)
echo [4] Install React Frontend Dependencies (app/npm install)
echo [5] Open HOW_TO_RUN.md Documentation
echo [6] Exit
echo.

set /p choice="Enter choice (A or 1-6): "

if /i "%choice%"=="A" (
    echo.
    echo [1/2] Starting Python NLP Microservice on port 5000 in new window...
    start "1. Python NLP & Extraction Service (5000)" cmd /k "python nlp_server.py"

    echo [2/2] Starting React Web App on port 3000 in new window...
    start "2. React Web Application (3000)" cmd /k "cd app && set NODE_OPTIONS=--openssl-legacy-provider && npm start"

    echo.
    echo Services launched! (Make sure Ganache GUI is running)
    pause
    goto end
)

if "%choice%"=="1" (
    echo.
    echo Compiling and migrating smart contracts to Ganache GUI...
    set "APPDATA=%CD%\.truffle_data"
    call truffle compile && call truffle migrate --reset
    node -e "const fs = require('fs'); ['./app/src/contracts/newsDetection.json', './app/src/contracts/Migrations.json'].forEach(f => { const d = JSON.parse(fs.readFileSync(f)); if (d.networks) { const id = Object.keys(d.networks)[0]; if (id) { d.networks['5777'] = d.networks[id]; d.networks['1337'] = d.networks[id]; fs.writeFileSync(f, JSON.stringify(d, null, 2)); } } });"
    echo.
    echo Contracts deployed successfully with dual chain ID support (5777 / 1337).
    pause
    goto end
)

if "%choice%"=="2" (
    echo.
    echo Starting Python NLP Microservice on http://127.0.0.1:5000...
    python nlp_server.py
    pause
    goto end
)

if "%choice%"=="3" (
    echo.
    echo Starting React development server on http://localhost:3000...
    set NODE_OPTIONS=--openssl-legacy-provider
    cd app
    npm start
    goto end
)

if "%choice%"=="4" (
    echo.
    echo Installing React dependencies in /app...
    cd app
    npm install --legacy-peer-deps
    cd ..
    pause
    goto end
)

if "%choice%"=="5" (
    start notepad HOW_TO_RUN.md
    goto end
)

:end
ENDLOCAL
