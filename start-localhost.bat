@echo off
cd /d "%~dp0"
"C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" ".\node_modules\next\dist\bin\next" dev > ".next-dev-output.log" 2>&1
