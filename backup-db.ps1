$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupPath = "D:\brand-mosaic-map-main\DB_local_backups\backup_$timestamp.sql"

docker exec brand-pg pg_dump -U postgres supabase_local > $backupPath

Write-Host "Backup criado em: $backupPath"
