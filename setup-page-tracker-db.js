import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function setupDatabase() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables')
    process.exit(1)
  }

  console.log('Connecting to Supabase...')
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // Read SQL file
    const sqlPath = join(__dirname, 'page-tracker-schema.sql')
    const sql = readFileSync(sqlPath, 'utf-8')

    console.log('Executing schema...')
    console.log('SQL:\n', sql)

    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const statement of statements) {
      if (statement.trim()) {
        console.log('\nExecuting:', statement.substring(0, 50) + '...')
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement })

        if (error) {
          console.error('Error executing statement:', error)
          // Continue with next statement
        } else {
          console.log('✓ Success')
        }
      }
    }

    console.log('\n✅ Database setup completed!')

  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

setupDatabase()
