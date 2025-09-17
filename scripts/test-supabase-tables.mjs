import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ymivsbikxiosrdtnnuax.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltaXZzYmlreGlvc3JkdG5udWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMTc2MDksImV4cCI6MjA3Mjg5MzYwOX0.4Gc2saAw27WX8w78lu8LYr_ad6pRZWTrmC_zBxZGhWE'

async function testTables() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Test each table
    const tables = ['sheets', 'sheet_records', 'users', 'sessions']
    
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1)
      
      console.log(`\nTesting table: ${table}`)
      if (error) {
        console.error('Error:', error)
      } else {
        console.log('Success:', data.length > 0 ? 'Records found' : 'Table exists but empty')
      }
    }

  } catch (error) {
    console.error('Connection error:', error)
  }
}

testTables()