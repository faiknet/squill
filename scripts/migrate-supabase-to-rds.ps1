$ErrorActionPreference = 'Stop'

param(
  [string]$SupabaseDbUrl = $env:SUPABASE_DB_URL,
  [string]$RdsDbUrl = $env:RDS_DB_URL,
  [string]$SchemaPath = $(Join-Path $PSScriptRoot '..\aws\rds\schema.sql'),
  [string]$PostImportPath = $(Join-Path $PSScriptRoot '..\aws\rds\post_import.sql')
)

if (-not $SupabaseDbUrl) {
  throw 'SUPABASE_DB_URL is required.'
}

if (-not $RdsDbUrl) {
  throw 'RDS_DB_URL is required.'
}

foreach ($tool in @('pg_dump', 'pg_restore', 'psql')) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
    throw "Missing required tool: $tool"
  }
}

if (-not (Test-Path $SchemaPath)) {
  throw "Schema file not found: $SchemaPath"
}

if (-not (Test-Path $PostImportPath)) {
  throw "Post-import file not found: $PostImportPath"
}

$tables = @(
  'public.profiles',
  'public.campaigns',
  'public.campaign_members',
  'public.campaign_pins',
  'public.sessions',
  'public.session_notes',
  'public.entity_tags',
  'public.session_activity_logs',
  'public.user_preferences',
  'public.password_reset_tokens',
  'public.password_change_audit'
)

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) 'squill-rds-migration'
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
$dumpFile = Join-Path $tempDir 'supabase-data.dump'

$tableArgs = $tables | ForEach-Object { "--table=$_" }

Write-Host 'Exporting Supabase data...'
& pg_dump $SupabaseDbUrl --data-only --format=custom --no-owner --no-acl @tableArgs -f $dumpFile
if ($LASTEXITCODE -ne 0) {
  throw 'pg_dump failed.'
}

Write-Host 'Applying RDS schema...'
& psql $RdsDbUrl -f $SchemaPath
if ($LASTEXITCODE -ne 0) {
  throw 'psql schema apply failed.'
}

Write-Host 'Importing data into RDS...'
& pg_restore --data-only --no-owner --no-acl -d $RdsDbUrl $dumpFile
if ($LASTEXITCODE -ne 0) {
  throw 'pg_restore failed.'
}

Write-Host 'Running post-import backfills...'
& psql $RdsDbUrl -f $PostImportPath
if ($LASTEXITCODE -ne 0) {
  throw 'psql post-import failed.'
}

Write-Host 'Migration complete.'
