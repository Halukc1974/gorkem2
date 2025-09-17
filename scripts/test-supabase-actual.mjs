import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ymivsbikxiosrdtnnuax.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltaXZzYmlreGlvc3JkdG5udWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMTc2MDksImV4cCI6MjA3Mjg5MzYwOX0.4Gc2saAw27WX8w78lu8LYr_ad6pRZWTrmC_zBxZGhWE'

async function testActualTables() {
  try {
    console.log('Creating Supabase client...')
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Test documents table
    console.log('\nTesting documents table...')
    const { data: docs, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .limit(2)
    
    if (docsError) {
      console.error('Documents error:', docsError)
    } else {
      console.log('Documents success:', docs.length, 'records found')
      if (docs.length > 0) {
        console.log('Sample document fields:', Object.keys(docs[0]))
      }
    }

    // Test user_settings table
    console.log('\nTesting user_settings table...')
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('*')
      .limit(2)
    
    if (settingsError) {
      console.error('User settings error:', settingsError)
    } else {
      console.log('User settings success:', settings.length, 'records found')
      if (settings.length > 0) {
        console.log('Sample settings fields:', Object.keys(settings[0]))
      }
    }

  } catch (error) {
    console.error('Connection error:', error)
  }
}

testActualTables()