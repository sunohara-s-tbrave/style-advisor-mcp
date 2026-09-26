@echo off
rem Double-click launcher for Style Advisor (Windows).
rem Thin wrapper: the real logic lives in launcher.ps1 (PowerShell gives us
rem reliable JSON parsing and process cleanup that plain batch cannot).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher.ps1"
