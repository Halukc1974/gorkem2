import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ymivsbikxiosrdtnnuax.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltaXZzYmlreGlvc3JkdG5udWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMTc2MDksImV4cCI6MjA3Mjg5MzYwOX0.4Gc2saAw27WX8w78lu8LYr_ad6pRZWTrmC_zBxZGhWE'

async function testConnection() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Test keywords table
    const { data: keywords, error: keywordsError } = await supabase
      .from('keywords')
      .select('*')
      .limit(5)
    
    if (keywordsError) {
      console.error('Keywords error:', keywordsError)
    } else {
      console.log('Keywords connection successful:', keywords.length, 'records found')
    }
    
    // Test correspondence_types table
    const { data: types, error: typesError } = await supabase
      .from('correspondence_types')
      .select('*')
      .limit(5)
    
    if (typesError) {
      console.error('Correspondence types error:', typesError)
    } else {
      console.log('Correspondence types connection successful:', types.length, 'records found')
    }
    
  } catch (error) {
    console.error('Connection error:', error)
  }
}

testConnection()