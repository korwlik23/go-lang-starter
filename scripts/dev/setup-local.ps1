[CmdletBinding()]
param(
    [ValidateSet('postgres', 'mariadb')]
    [string]$Profile = 'mariadb',

    [string]$BootstrapEmail = 'owner@example.com',

    # Keep this empty by default so the password is either read from the
    # ignored .env.bootstrap file or entered through a secure prompt.
    [string]$BootstrapPassword = '',

    [string]$AccountSlug = 'personal',

    [ValidateSet('foundation', 'permission-matrix', 'demo-cms', 'full-local')]
    [string]$SeedProfile = 'full-local',

    [switch]$SkipBootstrap,

    [switch]$NoBuild,

    [switch]$SkipHealthCheck
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$composeFile = Join-Path $root 'compose.dev.yml'
$projectName = 'go-lang-starter'
$apiService = "api-$Profile"

function Invoke-Compose {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & docker compose --project-name $projectName --file $composeFile @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose failed for profile '$Profile'."
    }
}

function ConvertFrom-SecurePassword {
    param(
        [Parameter(Mandatory = $true)]
        [securestring]$SecurePassword
    )

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function Wait-HttpEndpoint {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Uri,

        [int]$Attempts = 30
    )

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                return
            }
        }
        catch {
            # Services may still be building or waiting for migration.
        }

        Start-Sleep -Seconds 2
    }

    throw "Timed out waiting for $Uri."
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker CLI was not found on PATH. Start Docker Desktop and retry.'
}

if (-not (Test-Path -LiteralPath $composeFile)) {
    throw "Compose file was not found: $composeFile"
}

& docker info *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker Engine is not reachable. Start Docker Desktop and retry.'
}

$otherProfile = if ($Profile -eq 'postgres') { 'mariadb' } else { 'postgres' }
$otherApiService = "api-$otherProfile"
$otherRunning = @(
    & docker compose --project-name $projectName --file $composeFile --profile $otherProfile `
        ps --status running --services 2>$null
)
if ($otherRunning -contains $otherApiService) {
    throw "The '$otherProfile' profile is already running. Stop it before starting '$Profile' because both use port 8080."
}

Push-Location $root
$previousSeedProfile = [Environment]::GetEnvironmentVariable('SEED_PROFILE', 'Process')
$previousBootstrapPassword = [Environment]::GetEnvironmentVariable('BOOTSTRAP_PASSWORD', 'Process')
$previousBootstrapEmail = [Environment]::GetEnvironmentVariable('BOOTSTRAP_EMAIL', 'Process')
$previousBootstrapSlug = [Environment]::GetEnvironmentVariable('BOOTSTRAP_ACCOUNT_SLUG', 'Process')
try {
    $bootstrapFile = Join-Path $root '.env.bootstrap'
    if ([string]::IsNullOrWhiteSpace($BootstrapPassword) -and (Test-Path -LiteralPath $bootstrapFile)) {
        $bootstrapValues = @{}
        foreach ($line in Get-Content -LiteralPath $bootstrapFile) {
            $parts = $line -split '=', 2
            if ($parts.Count -eq 2 -and -not $parts[0].Trim().StartsWith('#')) {
                $bootstrapValues[$parts[0].Trim()] = $parts[1].Trim()
            }
        }
        if ($bootstrapValues.ContainsKey('BOOTSTRAP_PASSWORD')) {
            $BootstrapPassword = $bootstrapValues['BOOTSTRAP_PASSWORD']
        }
        if ($bootstrapValues.ContainsKey('BOOTSTRAP_EMAIL')) {
            $BootstrapEmail = $bootstrapValues['BOOTSTRAP_EMAIL']
        }
        if ($bootstrapValues.ContainsKey('BOOTSTRAP_ACCOUNT_SLUG')) {
            $AccountSlug = $bootstrapValues['BOOTSTRAP_ACCOUNT_SLUG']
        }
    }
    if ([string]::IsNullOrWhiteSpace($BootstrapPassword)) {
        $securePassword = Read-Host 'Local seed password (minimum 12 characters)' -AsSecureString
        $BootstrapPassword = ConvertFrom-SecurePassword -SecurePassword $securePassword
    }
    if ($BootstrapPassword.Length -lt 12) {
        throw 'Seed password must contain at least 12 characters.'
    }
    if ($SkipBootstrap) {
        Write-Warning 'SkipBootstrap is deprecated because the Compose API waits for seed. Using the foundation profile.'
        $SeedProfile = 'foundation'
    }

    # Compose interpolates these process values only into the local seed
    # service. They are restored below and are never written to the repo.
    [Environment]::SetEnvironmentVariable('SEED_PROFILE', $SeedProfile, 'Process')
    [Environment]::SetEnvironmentVariable('BOOTSTRAP_PASSWORD', $BootstrapPassword, 'Process')
    [Environment]::SetEnvironmentVariable('BOOTSTRAP_EMAIL', $BootstrapEmail, 'Process')
    [Environment]::SetEnvironmentVariable('BOOTSTRAP_ACCOUNT_SLUG', $AccountSlug, 'Process')

    $upArguments = @('--profile', $Profile, 'up')
    if (-not $NoBuild) {
        $upArguments += '--build'
    }
    $upArguments += '-d'

    Write-Host "Starting personal starter with $Profile and seed profile $SeedProfile..."
    Invoke-Compose -Arguments $upArguments

    if (-not $SkipHealthCheck) {
        Write-Host 'Waiting for API, Admin and Public Site health endpoints...'
        Wait-HttpEndpoint -Uri 'http://127.0.0.1:8080/livez'
        Wait-HttpEndpoint -Uri 'http://127.0.0.1:8080/readyz'
        Wait-HttpEndpoint -Uri 'http://127.0.0.1:5173/login'
        Wait-HttpEndpoint -Uri 'http://127.0.0.1:4321/th/'
        Write-Host 'Local starter is ready.'
    }
}
finally {
    [Environment]::SetEnvironmentVariable('SEED_PROFILE', $previousSeedProfile, 'Process')
    [Environment]::SetEnvironmentVariable('BOOTSTRAP_PASSWORD', $previousBootstrapPassword, 'Process')
    [Environment]::SetEnvironmentVariable('BOOTSTRAP_EMAIL', $previousBootstrapEmail, 'Process')
    [Environment]::SetEnvironmentVariable('BOOTSTRAP_ACCOUNT_SLUG', $previousBootstrapSlug, 'Process')
    Pop-Location
}
