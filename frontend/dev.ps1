param([Parameter(ValueFromRemainingArguments = $true)][string[]]$ViteArguments)
$ErrorActionPreference = 'Stop'
$localRuntime = Get-ChildItem -Path (Join-Path $PSScriptRoot '../.tools') -Directory -Filter 'node-v22.*-win-x64' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
if ($localRuntime) {
    $nodeExecutable = Join-Path $localRuntime.FullName 'node.exe'
} else {
    $nodeExecutable = (Get-Command node -ErrorAction Stop).Source
}
$runtimeVersion = [version]((& $nodeExecutable --version).TrimStart('v'))
if ($runtimeVersion -lt [version]'22.12.0') { throw 'Node.js 22.12+ is required. Install it or provide a project-local Node 22 runtime in .tools.' }
Push-Location $PSScriptRoot
try {
    & $nodeExecutable (Join-Path $PSScriptRoot 'node_modules/vite/bin/vite.js') --host 127.0.0.1 @ViteArguments
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
