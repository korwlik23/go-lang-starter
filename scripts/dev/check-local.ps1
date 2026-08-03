[CmdletBinding()]
param(
    [ValidateSet('postgres', 'mariadb')]
    [string]$Profile = 'mariadb'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$composeFile = Join-Path $root 'compose.dev.yml'
$projectName = 'go-lang-starter'

function Test-HttpEndpoint {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [string]$Uri
    )

    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -TimeoutSec 5
        if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 400) {
            throw "HTTP $($response.StatusCode)"
        }
        Write-Host "PASS  $Name ($($response.StatusCode))"
    }
    catch {
        throw "FAIL  $Name ($Uri): $($_.Exception.Message)"
    }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker CLI was not found on PATH.'
}

& docker info *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker Engine is not reachable.'
}

$running = @(
    & docker compose --project-name $projectName --file $composeFile --profile $Profile `
        ps --status running --services 2>$null
)
$requiredServices = @("$Profile", "api-$Profile", 'admin', 'site')
$missingServices = @($requiredServices | Where-Object { $running -notcontains $_ })
if ($missingServices.Count -gt 0) {
    throw "Missing running services for '$Profile': $($missingServices -join ', ')."
}

Write-Host "PASS  Docker services ($($requiredServices -join ', '))"
Test-HttpEndpoint -Name 'API liveness' -Uri 'http://127.0.0.1:8080/livez'
Test-HttpEndpoint -Name 'API readiness' -Uri 'http://127.0.0.1:8080/readyz'
Test-HttpEndpoint -Name 'Vue Admin login' -Uri 'http://127.0.0.1:5173/login'
Test-HttpEndpoint -Name 'Astro Public Site /th/' -Uri 'http://127.0.0.1:4321/th/'

Write-Host 'Local starter checks passed.'
