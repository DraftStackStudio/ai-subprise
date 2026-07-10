$project = "C:\Users\Admin\Documents\_Codex App building\Projects\ai-subprise-main"
$node = "C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$next = "C:\Users\Admin\Documents\_Codex App building\Projects\ai-subprise-main\node_modules\next\dist\bin\next"

Set-Location -LiteralPath $project
while ($true) {
  Start-Sleep -Seconds 3600
} | & $node $next dev *>> "$project\.next-detached-out.log"
