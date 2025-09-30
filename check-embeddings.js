const { supabaseService } = require('./client/src/services/supabase.ts');
const { DEV_SUPABASE_CONFIG } = require('./client/src/dev-supabase-config.ts');

async function checkEmbeddings() {
  try {
    supabaseService.configure(DEV_SUPABASE_CONFIG);
    const client = supabaseService.getClient();

    // Önce toplam kayıt sayısını kontrol et
    const { count: totalCount } = await client
      .from('documents')
      .select('*', { count: 'exact', head: true });

    console.log('Total documents:', totalCount);

    // Embedding'li kayıtları kontrol et
    const { data, error } = await client
      .from('documents')
      .select('id, short_desc, embedding')
      .not('embedding', 'is', null)
      .limit(10);

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('Found', data?.length || 0, 'documents with embeddings');

    if (data && data.length > 0) {
      console.log('Sample embedding data:');
      data.forEach((doc, i) => {
        console.log(`${i+1}. ID: ${doc.id}, Desc: ${doc.short_desc}`);
        console.log(`   Embedding type: ${typeof doc.embedding}`);
        if (Array.isArray(doc.embedding)) {
          console.log(`   Embedding length: ${doc.embedding.length}`);
          console.log(`   First 5 values: [${doc.embedding.slice(0, 5).join(', ')}]`);
        } else {
          console.log(`   Embedding value: ${JSON.stringify(doc.embedding).substring(0, 100)}...`);
        }
        console.log('');
      });
    } else {
      console.log('No documents with embeddings found!');
    }

    // "ITALIAN MARBLE" içeren kayıtları kontrol et
    const { data: marbleData, error: marbleError } = await client
      .from('documents')
      .select('id, short_desc, content, keywords')
      .or('short_desc.ilike.%ITALIAN MARBLE%,content.ilike.%ITALIAN MARBLE%,keywords.ilike.%ITALIAN MARBLE%')
      .limit(5);

    if (marbleError) {
      console.error('Marble search error:', marbleError);
    } else {
      console.log('Found', marbleData?.length || 0, 'documents containing "ITALIAN MARBLE"');
      if (marbleData && marbleData.length > 0) {
        marbleData.forEach((doc, i) => {
          console.log(`${i+1}. ${doc.short_desc} (ID: ${doc.id})`);
        });
      }
    }

  } catch (err) {
    console.error('Check failed:', err);
  }
}

checkEmbeddings();