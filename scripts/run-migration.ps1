# PowerShell helper: backup DB and run migration runner
# Usage: .\scripts\run-migration.ps1
# Reads .env file if present in repo root. Prompts before destructive steps.

param()

function Read-EnvFile($path) {
    if (-not (Test-Path $path)) { return @{} }
    $lines = Get-Content $path | Where-Object { $_ -match '=' -and -not ($_ -match '^#') }
    $obj = @{}
    foreach ($l in $lines) {
        $parts = $l -split '=', 2
        $k = $parts[0].Trim()
        $v = $parts[1].Trim()
        $obj[$k] = $v
    }
    return $obj
}

$envFile = Join-Path -Path (Get-Location) -ChildPath '.env'
$envVars = Read-EnvFile $envFile

$DB_HOST = $envVars['DB_HOST'] ?: Read-Host 'DB_HOST (e.g. 127.0.0.1)'
$DB_PORT = $envVars['DB_PORT'] ?: Read-Host 'DB_PORT (e.g. 3306)'
$DB_USER = $envVars['DB_USER'] ?: Read-Host 'DB_USER (e.g. root)'
$DB_PASS = $envVars['DB_PASS'] ?: Read-Host -AsSecureString 'DB_PASS (will be masked)'
$DB_NAME = $envVars['DB_NAME'] ?: Read-Host 'DB_NAME (e.g. smartcity)'

if (-not $DB_PASS -is [string]) {
    # convert secure string to plain for this script runtime only
    $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($DB_PASS)
    $DB_PASS_PLAIN = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
} else {
    $DB_PASS_PLAIN = $DB_PASS
}

Write-Host "About to backup DB $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
$confirm = Read-Host 'Type YES to continue or anything else to abort'
if ($confirm -ne 'YES') { Write-Host 'Aborted'; exit 1 }

$timestamp = (Get-Date).ToString('yyyyMMdd_HHmmss')
$dumpFile = Join-Path -Path (Get-Location) -ChildPath "migrations\backup_before_remap_$timestamp.sql"

$env:MYSQL_PWD = $DB_PASS_PLAIN
$mysqldumpCmd = "mysqldump --host=$DB_HOST --port=$DB_PORT --user=$DB_USER --routines --triggers --events $DB_NAME > `"$dumpFile`""
Write-Host "Running: $mysqldumpCmd"
Invoke-Expression $mysqldumpCmd
if ($LASTEXITCODE -ne 0) { Write-Host 'mysqldump failed with exit code' $LASTEXITCODE; Remove-Item Env:\MYSQL_PWD; exit $LASTEXITCODE }
Remove-Item Env:\MYSQL_PWD
Write-Host "Backup written to $dumpFile"

# Run the Node interactive runner
Write-Host 'Now running npm run run-migration (interactive)'
npm run run-migration

Write-Host 'Done.'
