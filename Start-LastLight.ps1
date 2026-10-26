param([switch]$Production)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCommand) { throw 'Install Node.js 24 LTS, reopen PowerShell, and try again.' }
if (-not (Test-Path -LiteralPath 'node_modules')) { throw 'Install dependencies first with: corepack pnpm install --frozen-lockfile' }
if ($Production) {
    if (-not (Test-Path -LiteralPath 'dist/server/index.js')) { throw 'Build the project first with: corepack pnpm build' }
    & $nodeCommand.Source 'dist/server/index.js' --production
} else {
    & $nodeCommand.Source 'node_modules/tsx/dist/cli.mjs' watch 'src/server/index.ts'
}
