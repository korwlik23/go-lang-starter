[CmdletBinding()]
param(
    [ValidateSet('postgres', 'mariadb')]
    [string]$Profile = 'mariadb',

    [string]$BootstrapEmail = 'owner@example.com',

    # Keep this empty by default so the password is either read from the
    # ignored .env.bootstrap file or entered through a secure prompt.
    [string]$BootstrapPassword = '',

    [string]$AccountSlug = 'personal',

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
try {
    $upArguments = @('--profile', $Profile, 'up')
    if (-not $NoBuild) {
        $upArguments += '--build'
    }
    $upArguments += '-d'

    Write-Host "Starting personal starter with $Profile..."
    Invoke-Compose -Arguments $upArguments

    if (-not $SkipBootstrap) {
        $bootstrapFile = Join-Path $root '.env.bootstrap'
        $useBootstrapFile = [string]::IsNullOrWhiteSpace($BootstrapPassword) -and (Test-Path -LiteralPath $bootstrapFile)

        if ($useBootstrapFile) {
            $bootstrapPasswordLine = Get-Content -LiteralPath $bootstrapFile | Where-Object { $_ -match '^BOOTSTRAP_PASSWORD=' } | Select-Object -First 1
            if ([string]::IsNullOrWhiteSpace($bootstrapPasswordLine) -or $bootstrapPasswordLine -match 'replace-with|password-manager-generated') {
                throw "The password in $bootstrapFile is still a placeholder. Replace it with a value of at least 12 characters."
            }

            Write-Host 'Running idempotent foundation bootstrap from .env.bootstrap...'
            Invoke-Compose -Arguments @(
                '--profile', $Profile,
                'run', '--rm', '--no-deps',
                '--env-from-file', $bootstrapFile,
                '--entrypoint', '/app/bootstrap',
                $apiService
            )
        }
        else {
            if ([string]::IsNullOrWhiteSpace($BootstrapPassword)) {
                $securePassword = Read-Host 'Bootstrap password (minimum 12 characters)' -AsSecureString
                $BootstrapPassword = ConvertFrom-SecurePassword -SecurePassword $securePassword
            }

            if ($BootstrapPassword.Length -lt 12) {
                throw 'Bootstrap password must contain at least 12 characters.'
            }

            Write-Host "Running idempotent foundation bootstrap for $BootstrapEmail..."
            Invoke-Compose -Arguments @(
                '--profile', $Profile,
                'run', '--rm', '--no-deps',
                '--env', "BOOTSTRAP_EMAIL=$BootstrapEmail",
                '--env', "BOOTSTRAP_PASSWORD=$BootstrapPassword",
                '--env', "BOOTSTRAP_ACCOUNT_SLUG=$AccountSlug",
                '--env', 'BOOTSTRAP_ACCOUNT_ROLE_NAME=Account Manager',
                '--env', 'BOOTSTRAP_SYSTEM_ROLE_NAME=System Manager',
                '--entrypoint', '/app/bootstrap',
                $apiService
            )
        }
    }
    else {
        Write-Host 'Skipping foundation bootstrap by request.'
    }

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
    Pop-Location
}
