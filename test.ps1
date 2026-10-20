# Drownlight acceptance test
#   powershell -ExecutionPolicy Bypass -File test.ps1
#   powershell -ExecutionPolicy Bypass -File test.ps1 -Dev      # read js\ from disk instead of the embedded snapshot
#   powershell -ExecutionPolicy Bypass -File test.ps1 -Frames 900
#
# Runs three headless checks and exits non-zero if any of them fails:
#   selftest  - clear reward / idempotency / audio scene / render scale
#   bosstest  - all 12 bosses for N frames + normal vs endless flow + roster reroll
#   bench     - worst-case frame cost
# Always uses a throwaway profile, so your real save is never touched.

param(
    [switch]$Dev,
    [int]$Frames = 300
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
# 光溺.exe  - keep this file ASCII-only, so build it from code points
$exe = Join-Path $root ([string][char]0x5149 + [char]0x6EBA + '.exe')

if (-not (Test-Path $exe)) {
    Write-Host "exe not found: $exe" -ForegroundColor Red
    Write-Host "run: powershell -ExecutionPolicy Bypass -File build\build.ps1" -ForegroundColor Yellow
    exit 1
}

$prof = Join-Path $env:TEMP ('drownlight-test-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force -Path $prof | Out-Null
$fail = 0

function Fail([string]$msg) {
    Write-Host ("  FAIL  " + $msg) -ForegroundColor Red
    $script:fail++
}
function Pass([string]$msg) {
    Write-Host ("  ok    " + $msg) -ForegroundColor Green
}

# NOTE: --probejs is split on spaces by the host, so the js must not contain any.
function Probe([string]$label, [string]$query, [string]$js, [int]$wait) {
    $out = Join-Path $prof ($label + '.json')
    if (Test-Path $out) { Remove-Item $out -Force }
    $a = @('--profile', $prof, '--probe', $out, '--probejs', $js, '--probewait', "$wait", '--query', $query)
    if ($Dev) { $a = @('--dev') + $a }
    Start-Process -FilePath $exe -ArgumentList $a -Wait -NoNewWindow | Out-Null
    if (-not (Test-Path $out)) { return $null }
    $raw = Get-Content $out -Raw
    if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
    try { return ($raw | ConvertFrom-Json) } catch { return $null }
}

Write-Host ""
Write-Host "Drownlight acceptance test" -ForegroundColor Cyan
Write-Host ("  exe     : " + $exe)
Write-Host ("  profile : " + $prof)
Write-Host ("  mode    : " + $(if ($Dev) { 'dev (js\ on disk)' } else { 'packaged' }))
Write-Host ""

# ---------------------------------------------------------------- selftest
Write-Host "[1/3] selftest" -ForegroundColor Cyan
$s = Probe 'self' '?selftest=1' 'document.body.getAttribute(''data-test'')' 4000
if ($null -eq $s) {
    Fail 'no output'
} else {
    $j = $s | ConvertFrom-Json
    if ($j.ok -eq $true) { Pass 'ran without exceptions' } else { Fail ('exception: ' + $j.err) }
    if ($j.clear.gain -gt 0) { Pass ('clear reward +' + $j.clear.gain) } else { Fail 'clear reward is 0' }
    if ($j.idempotent -eq $true) { Pass 'awardRun is idempotent' } else { Fail 'awardRun ran twice' }
    if ($j.scene -eq 'play') { Pass 'audio scene = play' } else { Fail ('audio scene = ' + $j.scene) }
    if ($j.scenePaused -eq 'menu') { Pass 'audio scene muted while paused' } else { Fail 'pause did not mute' }
}

# ---------------------------------------------------------------- bosstest
Write-Host ""
Write-Host ("[2/3] bosstest (" + $Frames + " frames x 12 bosses)") -ForegroundColor Cyan
$wait = 6000 + [int]($Frames * 6)
$b = Probe 'boss' ("?bosstest=1&frames=" + $Frames) 'document.body.getAttribute(''data-test'')' $wait
if ($null -eq $b) {
    Fail 'no output'
} else {
    $j = $b | ConvertFrom-Json
    if ($j.ok -eq $true) { Pass 'no exceptions' } else { Fail ('exception: ' + $j.err) }
    if ($j.pool -eq 12) { Pass 'boss pool = 12' } else { Fail ('boss pool = ' + $j.pool) }
    if ($j.sorted -eq $true) { Pass 'roster sorted by threat' } else { Fail 'roster is not sorted' }
    $bad = @($j.list | Where-Object { $_.err -ne $null })
    $n = @($j.list).Count
    if ($bad.Count -eq 0) { Pass ("all " + $n + " bosses ran") } else { Fail ($bad.Count.ToString() + ' boss(es) threw') }
    $maxEb = ($j.list | Measure-Object -Property eb -Maximum).Maximum
    if ($maxEb -lt 160) { Pass ('peak enemy bullets = ' + $maxEb) } else { Fail ('bullet count blew up: ' + $maxEb) }
    if ($j.flowNormal.screen -eq 'ending') { Pass 'normal run ends at layer 6' } else { Fail ('normal run screen = ' + $j.flowNormal.screen) }
    if ($j.flowNormal.cleared -eq $true) { Pass 'normal run counted as cleared' } else { Fail 'clear flag missing' }
    if ($j.flowEndless.layer -eq 7) { Pass 'endless continues past layer 6' } else { Fail ('endless layer = ' + $j.flowEndless.layer) }
    if ($j.endless.rerolled -eq $true) { Pass 'endless rerolls the boss roster' } else { Fail 'roster was not rerolled' }
}

# ---------------------------------------------------------------- bench
Write-Host ""
Write-Host "[3/3] bench" -ForegroundColor Cyan
$m = Probe 'bench' '?bench=1&frames=120' 'document.body.getAttribute(''data-bench'')' 5000
if ($null -eq $m) {
    Fail 'no output'
} else {
    $j = $m | ConvertFrom-Json
    Write-Host ("  info  " + $j.w + "x" + $j.h + " dpr " + $j.dpr + " scale " + $j.scale +
        "  enemies " + $j.en + "  ebullets " + $j.eb + "  particles " + $j.pt)
    if ($j.ms -lt 8) { Pass ('frame cost ' + $j.ms + ' ms') } else { Fail ('frame cost ' + $j.ms + ' ms (>8ms)') }
}

# ---------------------------------------------------------------- done
Write-Host ""
if ($fail -eq 0) {
    Write-Host "ALL PASS" -ForegroundColor Green
    Remove-Item $prof -Recurse -Force -ErrorAction SilentlyContinue
    exit 0
} else {
    Write-Host ($fail.ToString() + " CHECK(S) FAILED") -ForegroundColor Red
    Write-Host ("  probe output kept in: " + $prof) -ForegroundColor Yellow
    exit 1
}
