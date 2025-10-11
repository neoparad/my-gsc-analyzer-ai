import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'

// 環境変数を読み込む
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function applySchema() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) are required')
    console.error('Run: vercel env pull .env.local')
    process.exit(1)
  }

  console.log('🔗 Connecting to Supabase...')
  const supabase = createClient(supabaseUrl, supabaseKey)

  // SQLファイルを読み込む
  const schemaPath = join(__dirname, 'supabase-schema.sql')
  const fullSchema = readFileSync(schemaPath, 'utf8')

  // Citation Analysis Tablesセクションのみを抽出
  const citationSchemaMatch = fullSchema.match(
    /-- ====================================\s*-- Citation Analysis Tables\s*-- ====================================([\s\S]*?)(?:-- ====================================|$)/
  )

  if (!citationSchemaMatch) {
    console.error('❌ Could not find Citation Analysis Tables section in supabase-schema.sql')
    process.exit(1)
  }

  const citationSchema = citationSchemaMatch[0]

  console.log('📝 Applying Citation Analysis schema...')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // SQLを個別のステートメントに分割して実行
  const statements = citationSchema
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]

    // ステートメントの種類を判定
    let type = 'OTHER'
    if (statement.includes('CREATE TABLE')) {
      const tableName = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1]
      type = `CREATE TABLE ${tableName}`
    } else if (statement.includes('CREATE INDEX')) {
      const indexName = statement.match(/CREATE INDEX IF NOT EXISTS (\w+)/)?.[1]
      type = `CREATE INDEX ${indexName}`
    } else if (statement.includes('CREATE TRIGGER')) {
      const triggerName = statement.match(/CREATE TRIGGER (\w+)/)?.[1]
      type = `CREATE TRIGGER ${triggerName}`
    } else if (statement.includes('ALTER TABLE')) {
      const tableName = statement.match(/ALTER TABLE (\w+)/)?.[1]
      if (statement.includes('ENABLE ROW LEVEL SECURITY')) {
        type = `ENABLE RLS ${tableName}`
      }
    } else if (statement.includes('CREATE POLICY')) {
      const policyMatch = statement.match(/CREATE POLICY "([^"]+)" ON (\w+)/)
      if (policyMatch) {
        type = `CREATE POLICY ${policyMatch[2]}`
      }
    }

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })

      if (error) {
        // rpc('exec_sql')が存在しない場合は、直接実行を試みる
        console.warn(`⚠️  Cannot execute via RPC: ${type}`)
        console.warn('   Please execute the SQL manually in Supabase SQL Editor')
      } else {
        console.log(`✅ ${type}`)
      }
    } catch (err) {
      console.warn(`⚠️  Error executing: ${type}`)
      console.warn(`   ${err.message}`)
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n⚠️  Note: Supabase Client cannot execute DDL statements directly.')
  console.log('Please execute the schema manually using one of these methods:\n')
  console.log('1. Supabase Dashboard SQL Editor')
  console.log('   → https://app.supabase.com/project/_/sql\n')
  console.log('2. Or use psql directly (see instructions below)')
  console.log('\n📋 SQL to execute:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(citationSchema)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

applySchema().catch(console.error)
