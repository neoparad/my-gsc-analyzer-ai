@echo off
echo Starting development servers...
echo.
echo Starting Express API Server on port 3000...
start cmd /k "npm run dev:api"
timeout /t 3 /nobreak >nul
echo.
echo Starting Vite Dev Server (Frontend) on port 5173...
start cmd /k "npm run dev"
echo.
echo Both servers are starting...
echo Frontend: http://localhost:5173
echo API: http://localhost:3000
echo.
pause
