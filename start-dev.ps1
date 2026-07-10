$ErrorActionPreference = "Stop"
Set-Location "C:\Users\Admin\Documents\_Codex App building\Projects\ai-subprise-main"
& "C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" ".\node_modules\next\dist\bin\next" dev --turbopack
