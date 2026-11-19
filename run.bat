@echo off
SETLOCAL EnableDelayedExpansion

echo ==========================================================
echo  Fake News Detection (Blockchain + NLP) - Quick Launcher
echo ==========================================================
echo.
echo Select an option:
echo [1] Start Local Ganache Blockchain (Port 8545)
echo [2] Compile and Deploy Smart Contracts (Truffle Migrate)
echo [3] Install React Frontend Dependencies (app/npm install)
echo [4] Start React Frontend Web Application (app/npm start)
echo [5] Open HOW_TO_RUN.md Documentation
echo [6] Exit
echo.

set /p choice="Enter choice (1-6): "

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
    truffle compile && truffle migrate --reset
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
    start notepad HOW_TO_RUN.md
    goto end
)

:end
ENDLOCAL
