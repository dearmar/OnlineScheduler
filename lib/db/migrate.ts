// Database migration script for Neon PostgreSQL
// Run with: npm run db:migrate

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.log('\nTo run migrations:');
    console.log('1. Create a .env.local file with your DATABASE_URL');
    console.log('2. Run: npx dotenv -e .env.local -- npm run db:migrate');
    process.exit(1);
  }

  console.log('🔄 Starting database migration...\n');

  const sql = neon(databaseUrl);
  
  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    // Split by semicolons but handle functions properly
    const statements = splitSqlStatements(schema);
    
    let successCount = 0;
    let skipCount = 0;
    
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed) continue;
      
      try {
        await sql(trimmed);
        successCount++;
        
        // Log what we're creating
        if (trimmed.startsWith('CREATE TABLE')) {
          const match = trimmed.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
          if (match) console.log(`  ✓ Table: ${match[1]}`);
        } else if (trimmed.startsWith('CREATE INDEX')) {
          const match = trimmed.match(/CREATE INDEX IF NOT EXISTS (\w+)/i);
          if (match) console.log(`  ✓ Index: ${match[1]}`);
        } else if (trimmed.startsWith('CREATE EXTENSION')) {
          console.log(`  ✓ Extension enabled`);
        } else if (trimmed.startsWith('CREATE OR REPLACE FUNCTION')) {
          const match = trimmed.match(/CREATE OR REPLACE FUNCTION (\w+)/i);
          if (match) console.log(`  ✓ Function: ${match[1]}`);
        } else if (trimmed.startsWith('CREATE TRIGGER')) {
          const match = trimmed.match(/CREATE TRIGGER (\w+)/i);
          if (match) console.log(`  ✓ Trigger: ${match[1]}`);
        }
      } catch (error: any) {
        // Ignore "already exists" errors
        if (error.message?.includes('already exists')) {
          skipCount++;
        } else {
          throw error;
        }
      }
    }
    
    console.log(`\n✅ Migration completed successfully!`);
    console.log(`   ${successCount} statements executed, ${skipCount} skipped (already exist)`);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Helper to split SQL while preserving function bodies
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inFunction = false;
  
  const lines = sql.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip comments
    if (trimmedLine.startsWith('--')) continue;
    
    // Track function blocks
    if (trimmedLine.includes('$$')) {
      inFunction = !inFunction;
    }
    
    current += line + '\n';
    
    // End of statement (outside function body)
    if (trimmedLine.endsWith(';') && !inFunction) {
      statements.push(current.trim());
      current = '';
    }
  }
  
  // Add any remaining statement
  if (current.trim()) {
    statements.push(current.trim());
  }
  
  return statements;
}

migrate();
