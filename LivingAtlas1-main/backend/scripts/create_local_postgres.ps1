param(
    [int]$Port = 5433
)

$ErrorActionPreference = 'Stop'
$backend = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$project = (Resolve-Path (Join-Path $backend '..')).Path
$pgBin = 'C:\Program Files\PostgreSQL\17\bin'
$dataDir = Join-Path $backend '.local-postgres\data'
$logFile = Join-Path $backend '.local-postgres\server.log'
$secretFile = Join-Path $backend '.local-postgres\init-password.txt'
$envFile = Join-Path $backend '.env.local'
$clientEnvFile = Join-Path $project 'client\.env.development.local'

if (-not (Test-Path (Join-Path $pgBin 'initdb.exe'))) {
    throw 'PostgreSQL 17 binaries are missing.'
}
if (Test-Path $envFile) {
    throw 'backend/.env.local already exists. Refusing to replace existing database settings.'
}
if (Test-Path $dataDir) {
    throw 'Local PostgreSQL data directory already exists. Refusing to replace it.'
}
if (Test-Path $clientEnvFile) {
    throw 'client/.env.development.local already exists. Refusing to replace it.'
}

$password = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
$localRoot = Join-Path $backend '.local-postgres'
New-Item -ItemType Directory -Path $localRoot -Force | Out-Null
try {
    [IO.File]::WriteAllText($secretFile, $password)
    & (Join-Path $pgBin 'initdb.exe') -D $dataDir -U postgres --pwfile=$secretFile -A scram-sha-256 --encoding=UTF8
    if ($LASTEXITCODE -ne 0) { throw 'initdb failed' }
} finally {
    Remove-Item -LiteralPath $secretFile -ErrorAction SilentlyContinue
}

& (Join-Path $pgBin 'pg_ctl.exe') -D $dataDir -l $logFile -o "-p $Port -h 127.0.0.1" -w start
if ($LASTEXITCODE -ne 0) { throw 'Local PostgreSQL failed to start' }

$env:PGPASSWORD = $password
try {
    $psql = Join-Path $pgBin 'psql.exe'
    & $psql -h 127.0.0.1 -p $Port -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE livingatlas_test'
    if ($LASTEXITCODE -ne 0) { throw 'Creating livingatlas_test failed' }

    $schemaFiles = @(
        (Join-Path $project 'database\database_schema\livingAtlasTables.sql'),
        (Join-Path $PSScriptRoot 'local_test_schema.sql'),
        (Join-Path $project 'database\migrations\001_create_card_images_table.sql'),
        (Join-Path $project 'database\migrations\002_create_user_layer_selections.sql'),
        (Join-Path $backend 'create_arcgis_services_table.sql')
    )
    foreach ($schemaFile in $schemaFiles) {
        & $psql -h 127.0.0.1 -p $Port -U postgres -d livingatlas_test -v ON_ERROR_STOP=1 -f $schemaFile | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Schema initialization failed: $schemaFile" }
    }

    @"
LOCAL_TEST_MODE=1
DB_HOST=127.0.0.1
DB_PORT=$Port
DB_NAME=livingatlas_test
DB_USER=postgres
DB_PASSWORD=$password
DB_SSLMODE=disable
"@ | Set-Content -LiteralPath $envFile -Encoding utf8
    'REACT_APP_API_URL=http://localhost:8000' | Set-Content -LiteralPath $clientEnvFile -Encoding utf8
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host 'Local PostgreSQL, test database, and frontend/backend environment files are ready.'
