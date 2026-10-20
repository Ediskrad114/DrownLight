# Build Drownlight.exe  (run: powershell -ExecutionPolicy Bypass -File build\build.ps1)
# Uses the .NET Framework 4.8 compiler bundled with Windows. No extra installs needed.
$ErrorActionPreference = 'Stop'
$root  = Split-Path -Parent $PSScriptRoot
$build = Join-Path $root 'build'
$refs  = Join-Path $build 'refs'
$csc   = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$out   = Join-Path $root ([char]0x5149 + [char]0x6EBA + '.exe')

if (-not (Test-Path $csc)) { throw "csc.exe not found: $csc" }
foreach ($f in @('WebView2.Core.dll','WebView2.WinForms.dll','WebView2Loader.dll')) {
  if (-not (Test-Path (Join-Path $refs $f))) { throw "missing $f in build\refs" }
}
foreach ($f in @('icon.ico','app.manifest')) {
  if (-not (Test-Path (Join-Path $build $f))) { throw "missing build\$f  (run: python build\make_icon.py)" }
}

$res = @(
  @{ f = 'index.html';      n = 'res/index.html' },
  @{ f = 'css\style.css';   n = 'res/css/style.css' },
  @{ f = 'js\data.js';      n = 'res/js/data.js' },
  @{ f = 'js\core.js';      n = 'res/js/core.js' },
  @{ f = 'js\audio.js';     n = 'res/js/audio.js' },
  @{ f = 'js\entities.js';  n = 'res/js/entities.js' },
  @{ f = 'js\systems.js';   n = 'res/js/systems.js' },
  @{ f = 'js\render.js';    n = 'res/js/render.js' },
  @{ f = 'js\ui.js';        n = 'res/js/ui.js' },
  @{ f = 'js\console.js';   n = 'res/js/console.js' },
  @{ f = 'js\main.js';      n = 'res/js/main.js' }
)

$cargs = @(
  '/nologo','/target:winexe','/platform:x64','/optimize+','/codepage:65001',
  "/out:$out",
  "/win32icon:$build\icon.ico",
  "/win32manifest:$build\app.manifest",
  '/r:System.dll','/r:System.Drawing.dll','/r:System.Windows.Forms.dll',
  "/r:$refs\WebView2.Core.dll",
  "/r:$refs\WebView2.WinForms.dll",
  "/resource:$refs\WebView2Loader.dll,WebView2Loader.dll",
  "/resource:$refs\WebView2.Core.dll,lib.WebView2.Core.dll",
  "/resource:$refs\WebView2.WinForms.dll,lib.WebView2.WinForms.dll",
  "/resource:$build\icon.ico,app.ico"
)
foreach ($r in $res) { $cargs += "/resource:$root\$($r.f),$($r.n)" }
$cargs += "$build\Drownlight.cs"

if (Test-Path $out) { Remove-Item $out -Force }
& $csc $cargs
if ($LASTEXITCODE -ne 0) { throw "compile failed" }

$kb = [math]::Round((Get-Item $out).Length / 1KB)
Write-Host "BUILD OK -> $out ($kb KB)"
