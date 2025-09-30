const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ymivsbikxiosrdtnnuax.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltaXZzYmlreGlvc3JkdG5udWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMTc2MDksImV4cCI6MjA3Mjg5MzYwOX0.4Gc2saAw27WX8w78lu8LYr_ad6pRZWTrmC_zBxZGhWE');

(async () => {
  const { data, error } = await supabase
    .from('documents')
    .select('id, short_desc, embedding')
    .limit(5);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Sample documents:');
    data.forEach((doc, i) => {
      console.log(`${i+1}. ID: ${doc.id}, Title: ${doc.short_desc}, Has embedding: ${!!doc.embedding}`);
    });
  }
})();