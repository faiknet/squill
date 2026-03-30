import fs from 'fs';
import path from 'path';

// Simple SQL executor via Supabase REST API (PostgREST doesn't support DDL)
// This script will output instructions to apply via dashboard

const migrationFile = path.join(process.cwd(), 'supabase', 'migrations', '20260327_final_rls_fix.sql');
const sql = fs.readFileSync(migrationFile, 'utf8');

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║     CRITICAL FIX: RLS Recursion Error                        ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

console.log('Your database has infinite recursion in RLS policies.\n');
console.log('To fix this, follow these steps:\n');

console.log('1. Open Supabase SQL Editor:');
console.log('   https://supabase.com/dashboard/project/vbkuxhmokwxpxkbyoawt/sql/new\n');

console.log('2. Copy the SQL below (between the lines):\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(sql);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('3. Paste into SQL Editor and click RUN\n');
console.log('4. Refresh your browser - campaigns should load!\n');

console.log('Or simply run this in the SQL Editor:');
console.log(`   Copy all content from: ${migrationFile}\n`);

// Copy to clipboard if possible
console.log('The SQL has been displayed above.');
console.log('Opening the migration file for you...\n');

// Show file path for easy access
console.log(`File location: ${migrationFile}`);
