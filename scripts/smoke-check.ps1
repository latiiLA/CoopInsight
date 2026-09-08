# Smoke-check Switch Hub API.
# Usage: powershell -File scripts/smoke-check.ps1 [-Login]
param(
    [switch]$Login,
    [string]$ApiBase = $(if ($env:SMOKE_API_BASE) { $env:SMOKE_API_BASE } else { "https://127.0.0.1:8088" })
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

function Invoke-CurlJson {
    param([string[]]$CurlArgs)
    $outFile = [System.IO.Path]::GetTempFileName()
    try {
        $args = @("-skS", "-o", $outFile, "-w", "%{http_code}") + $CurlArgs
        $code = & curl.exe @args
        if ($LASTEXITCODE -ne 0) {
            throw "curl failed (exit $LASTEXITCODE) talking to API. Is it listening on $ApiBase ?"
        }
        $body = Get-Content -Raw $outFile
        return @{ Code = $code; Body = $body }
    } finally {
        Remove-Item -Force $outFile -ErrorAction SilentlyContinue
    }
}

Write-Host "-> GET $ApiBase/api/health"
$health = Invoke-CurlJson -CurlArgs @("$ApiBase/api/health")
if ($health.Code -ne "200") {
    throw "health HTTP $($health.Code): $($health.Body)"
}
if ($health.Body -notmatch '"status"\s*:\s*"ok"') {
    throw "health status not ok: $($health.Body)"
}
Write-Host "OK health"

if ($Login) {
    $user = "systemadmin"
    $pass = $null
    $envPath = Join-Path $Root "backend\.env"
    if (Test-Path $envPath) {
        Get-Content $envPath | ForEach-Object {
            if ($_ -match '^\s*BOOTSTRAP_ADMIN_USERNAME=(.*)$') { $user = $Matches[1].Trim().Trim('"') }
            if ($_ -match '^\s*BOOTSTRAP_ADMIN_PASSWORD=(.*)$') { $pass = $Matches[1].Trim().Trim('"') }
        }
    }
    if (-not $pass) {
        if ($env:BOOTSTRAP_ADMIN_PASSWORD) { $pass = $env:BOOTSTRAP_ADMIN_PASSWORD }
        if ($env:BOOTSTRAP_ADMIN_USERNAME) { $user = $env:BOOTSTRAP_ADMIN_USERNAME }
    }
    if (-not $pass) {
        throw "BOOTSTRAP_ADMIN_PASSWORD not set; cannot run -Login"
    }

    Write-Host "-> POST $ApiBase/api/auth/login (user=$user)"
    $bodyFile = [System.IO.Path]::GetTempFileName()
    try {
        $json = @{ username = $user; password = $pass } | ConvertTo-Json -Compress
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($bodyFile, $json, $utf8NoBom)
        $loginResult = Invoke-CurlJson -CurlArgs @(
            "-H", "Content-Type: application/json",
            "--data-binary", "@$bodyFile",
            "$ApiBase/api/auth/login"
        )
    } finally {
        Remove-Item -Force $bodyFile -ErrorAction SilentlyContinue
    }
    if ($loginResult.Code -ne "200") {
        throw "login failed HTTP $($loginResult.Code)"
    }
    Write-Host "OK login"
}

Write-Host "smoke-check passed"
