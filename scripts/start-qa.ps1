$ErrorActionPreference = 'Stop'
$frontendRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path (Split-Path -Parent $frontendRoot) 'backend_marketplace_moda'
$pythonPath = Join-Path $backendRoot '.venv/Scripts/python.exe'
if (!(Test-Path -LiteralPath $pythonPath)) { throw 'Falta el entorno virtual del backend. Revisá README.md.' }
foreach ($testPort in @(8011,4201)) {
  $listener = Get-NetTCPConnection -LocalPort $testPort -State Listen -ErrorAction SilentlyContinue
  if ($listener) { throw "El puerto $testPort ya está ocupado. Cerrá el entorno anterior antes de iniciar otro." }
}
$qaProcess = Start-Process -FilePath $pythonPath -ArgumentList 'scripts/qa_backend.py' -WorkingDirectory $frontendRoot -WindowStyle Hidden -PassThru
try {
  Write-Host 'FashionStore QA: http://127.0.0.1:4201'
  Write-Host 'Admin temporal: qa-admin@example.com / PruebaCicloUno!2026'
  Write-Host 'Cliente temporal: qa-client@example.com / PruebaCicloUno!2026'
  Write-Host 'Base temporal en memoria. No modifica tu base real ni envía correos.'
  Push-Location $frontendRoot
  & npm.cmd start -- --configuration qa --host 127.0.0.1 --port 4201 --proxy-config proxy.qa.conf.json
} finally {
  Pop-Location
  if (!$qaProcess.HasExited) { Stop-Process -Id $qaProcess.Id }
}
