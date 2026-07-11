@echo off
set "PATH=C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin;%PATH%"
cd /d "C:\Users\Admin\Documents\_Codex App building\Projects\ai-subprise-main"
"C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd" run dev
