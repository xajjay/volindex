@echo off
cd /d "%~dp0.."
set "PYEXE="
for /d %%D in ("%LocalAppData%\Programs\Python\Python3*") do if exist "%%D\python.exe" set "PYEXE=%%D\python.exe"
if not defined PYEXE for /d %%D in ("%ProgramFiles%\Python3*") do if exist "%%D\python.exe" set "PYEXE=%%D\python.exe"
if defined PYEXE goto run
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 tools\update_data.py
  goto done
)
echo.
echo Python is not installed on this PC yet.
echo Install it from https://www.python.org/downloads/  - tick "Add python.exe to PATH" on the first screen.
echo Then double-click this file again.
echo.
goto done
:run
"%PYEXE%" tools\update_data.py
:done
pause
