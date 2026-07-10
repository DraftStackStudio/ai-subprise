$ErrorActionPreference = "Stop"

$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = "C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$next = Join-Path $project "node_modules\next\dist\bin\next"
$out = Join-Path $project ".next-dev-output.log"
$err = Join-Path $project ".next-dev-error.log"

Set-Location -LiteralPath $project

& $node $next dev *> $out
