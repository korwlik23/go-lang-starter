[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidateSet('postgres', 'mariadb')]
    [string]$Profile = 'mariadb',

    [string]$OutputDirectory = 'tmp/backups'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$composeFile = Join-Path $root 'compose.dev.yml'
$projectName = 'go-lang-starter'
$databaseService = $Profile

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
if ($running -notcontains $databaseService) {
    throw "Database service '$databaseService' is not running. Start it with setup-local.ps1 first."
}

$outputPath = [IO.Path]::GetFullPath((Join-Path $root $OutputDirectory))
New-Item -ItemType Directory -Force -Path $outputPath | Out-Null
$stamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss')
$dumpPath = Join-Path $outputPath "go-lang-starter-$Profile-$stamp.sql"
$metadataPath = [IO.Path]::ChangeExtension($dumpPath, '.json')

if ($Profile -eq 'postgres') {
    $dumpArguments = 'pg_dump --no-owner --no-privileges --username=go_lang_starter --dbname=go_lang_starter_dev'
    $restoreCommand = "Get-Content '$([IO.Path]::GetFileName($dumpPath))' | docker compose --profile postgres -f compose.dev.yml exec -T postgres psql --username=go_lang_starter --dbname=go_lang_starter_dev"
}
else {
    $dumpArguments = 'mariadb-dump --single-transaction --quick --routines --events --user=go_lang_starter --password=development-only-database-password go_lang_starter_dev'
    $restoreCommand = "Get-Content '$([IO.Path]::GetFileName($dumpPath))' | docker compose --profile mariadb -f compose.dev.yml exec -T mariadb mariadb --user=go_lang_starter --password=development-only-database-password go_lang_starter_dev"
}

if ($PSCmdlet.ShouldProcess($dumpPath, "create $Profile SQL backup")) {
    $startInfo = [Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = 'docker'
    $startInfo.Arguments = "compose --project-name $projectName --file `"$composeFile`" exec -T $databaseService $dumpArguments"
    $startInfo.WorkingDirectory = $root
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true

    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    if (-not $process.Start()) {
        throw 'Failed to start docker backup process.'
    }

    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    $stdout = $stdoutTask.Result
    $stderr = $stderrTask.Result
    $exitCode = $process.ExitCode
    $process.Dispose()

    if ($exitCode -ne 0) {
        Remove-Item -LiteralPath $dumpPath -Force -ErrorAction SilentlyContinue
        throw "Database backup failed: $($stderr.Trim())"
    }

    [IO.File]::WriteAllText($dumpPath, $stdout, [Text.UTF8Encoding]::new($false))
    $metadata = [ordered]@{
        profile = $Profile
        created_at = [DateTime]::UtcNow.ToString('o')
        file = [IO.Path]::GetFileName($dumpPath)
        size_bytes = (Get-Item -LiteralPath $dumpPath).Length
        format = 'plain-sql'
        restore_command = $restoreCommand
        warning = 'Contains application data. Keep outside Git and protect access.'
    }
    $metadata | ConvertTo-Json | Set-Content -LiteralPath $metadataPath -Encoding utf8

    Write-Host "Backup created: $dumpPath"
    Write-Host "Metadata created: $metadataPath"
}
else {
    Write-Host "WhatIf: would create $dumpPath and $metadataPath"
}
