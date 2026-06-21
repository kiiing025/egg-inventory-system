$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$vendor = Join-Path $root 'vendor'

New-Item -ItemType Directory -Force -Path $vendor | Out-Null
Copy-Item (Join-Path $root 'node_modules\alpinejs\dist\cdn.min.js') (Join-Path $vendor 'alpine.min.js') -Force
Copy-Item (Join-Path $root 'node_modules\lucide\dist\umd\lucide.min.js') (Join-Path $vendor 'lucide.min.js') -Force
Copy-Item (Join-Path $root 'node_modules\@supabase\supabase-js\dist\umd\supabase.js') (Join-Path $vendor 'supabase.js') -Force

$sheetJs = Join-Path $vendor 'xlsx.full.min.js'
if (-not (Test-Path $sheetJs)) {
    throw 'vendor\xlsx.full.min.js is missing. Restore the committed SheetJS 0.20.3 browser build.'
}
