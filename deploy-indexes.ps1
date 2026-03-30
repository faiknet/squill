#!/bin/env pwsh
# Deploy Database Migration to Supabase
# Uses the Supabase PostgreSQL API to execute the migration

$ErrorActionPreference = "Stop"

# Configuration from .env
$supabaseUrl = "https://vbkuxhmokwxpxkbyoawt.supabase.co"
$supabaseServiceKey = "***REMOVED***"

Write-Host "🚀 Database Migration Deployment" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Read migration file
$migrationPath = "C:\Users\metaf\Desktop\Squill\supabase\migrations\20260330_add_performance_indexes.sql"
$migrationSql = Get-Content -Path $migrationPath -Raw

Write-Host "📁 Migration: $(Split-Path $migrationPath -Leaf)" -ForegroundColor Yellow
Write-Host "📊 Size: $([math]::Round((Get-Item $migrationPath).Length / 1024, 2)) KB" -ForegroundColor Yellow
Write-Host ""

# Extract and count individual statements
$statements = $migrationSql -split ";" | Where-Object { $_.Trim() -and -not $_.Trim().StartsWith("--") }
$indexCount = ($migrationSql | Select-String "CREATE INDEX" | Measure-Object).Count

Write-Host "✅ Index Statements to Create: $indexCount" -ForegroundColor Green
Write-Host ""

# For demonstration, show which indexes will be created
Write-Host "📋 Indexes to Create:" -ForegroundColor Cyan
$migrationSql | Select-String "CREATE INDEX.*idx_" | ForEach-Object {
  $line = $_.Line.Trim() -replace "CREATE INDEX CONCURRENTLY IF NOT EXISTS ", "" -replace " ON.*", ""
  Write-Host "  ✓ $line" -ForegroundColor Green
}

Write-Host ""
Write-Host "⚠️  Note: To deploy to Supabase, use the Supabase Dashboard:" -ForegroundColor Yellow
Write-Host "  1. Go to: https://app.supabase.com/project/vbkuxhmokwxpxkbyoawt/sql/new" -ForegroundColor Yellow
Write-Host "  2. Paste the migration content from: supabase/migrations/20260330_add_performance_indexes.sql" -ForegroundColor Yellow
Write-Host "  3. Click 'Execute'" -ForegroundColor Yellow
Write-Host ""
Write-Host "Alternative: Use Supabase CLI:" -ForegroundColor Yellow
Write-Host "  supabase db push" -ForegroundColor Yellow
Write-Host ""

# Provide the verification query
Write-Host "✅ After deployment, verify with this query:" -ForegroundColor Cyan
Write-Host ""
Write-Host @"
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
"@ -ForegroundColor Magenta

Write-Host ""
Write-Host "Expected indexes (9 total):" -ForegroundColor Cyan
Write-Host @"
1. idx_sessions_campaign_created
2. idx_entity_tags_campaign_created
3. idx_activity_logs_session_created
4. idx_campaign_members_campaign
5. idx_campaigns_created_by_created
6. idx_campaign_pins_user
7. idx_entity_tags_session
8. idx_user_preferences_user
9. idx_password_reset_tokens_user_status
"@ -ForegroundColor Green
