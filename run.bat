@echo off
SETLOCAL EnableDelayedExpansion

echo ==========================================================
echo  Fake News Detection (Blockchain + NLP) - Quick Launcher
echo ==========================================================
echo.
echo Select an option:
echo [A] Launch ALL Services (Ganache + NLP Server + React App in separate windows)
echo [1] Start Local Ganache Blockchain (Port 8545)
echo [2] Compile and Deploy Smart Contracts (Truffle Migrate)
echo [3] Install React Frontend Dependencies (app/npm install)
echo [4] Start React Frontend Web Application (app/npm start)
echo [5] Start Python NLP Backend Server (Port 5000)
echo [6] Open HOW_TO_RUN.md Documentation
echo [7] Exit
echo.

set /p choice="Enter choice (A or 1-7): "

if /i "%choice%"=="A" (
    echo.
    echo [1/3] Starting Ganache on port 8545 in new window...
    start "1. Ganache Local Blockchain (8545)" cmd /k "npx ganache --port 8545 --chain.networkId 5777"

    echo [2/3] Starting Python NLP Microservice on port 5000 in new window...
    start "2. Python NLP & Extraction Service (5000)" cmd /k "python nlp_server.py"

    echo [3/3] Starting React Web App on port 3000 in new window...
    start "3. React Web Application (3000)" cmd /k "cd app && set NODE_OPTIONS=--openssl-legacy-provider && npm start"

    echo.
    echo All services launched!
    pause
    goto end
)

if "%choice%"=="1" (
    echo.
    echo Starting Ganache on port 8545...
    npx ganache --port 8545 --chain.networkId 5777
    pause
    goto end
)

if "%choice%"=="2" (
    echo.
    echo Compiling and migrating smart contracts...
    set "APPDATA=%CD%\.truffle_data"
    call truffle compile && call truffle migrate --reset
    pause
    goto end
)

if "%choice%"=="3" (
    echo.
    echo Installing React dependencies in /app...
    cd app
    npm install --legacy-peer-deps
    cd ..
    pause
    goto end
)

if "%choice%"=="4" (
    echo.
    echo Starting React development server...
    set NODE_OPTIONS=--openssl-legacy-provider
    cd app
    npm start
    goto end
)

if "%choice%"=="5" (
    echo.
    echo Starting Python NLP Microservice on http://127.0.0.1:5000...
    python nlp_server.py
    pause
    goto end
)

if "%choice%"=="6" (
    start notepad HOW_TO_RUN.md
    goto end
)

:end
ENDLOCAL
