import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ymivsbikxiosrdtnnuax.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltaXZzYmlreGlvc3JkdG5udWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMTc2MDksImV4cCI6MjA3Mjg5MzYwOX0.4Gc2saAw27WX8w78lu8LYr_ad6pRZWTrmC_zBxZGhWE';

async function run() {
  try {
    console.log('🔄 Supabase bağlantısı test ediliyor...');
    console.log('URL:', SUPABASE_URL);

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });

    // 1. Documents tablosunu kontrol et
    console.log('\n1️⃣ Documents tablosu kontrol ediliyor...');
    console.log('SELECT * FROM documents LIMIT 5 çalıştırılıyor...');
    
    const { data: docs, error: docsError } = await supabase
      .from('documents')
      .select('id, internal_no, letter_no, letter_date, ref_letters')
      .limit(5);

    if (docsError) {
      console.error('❌ Documents tablosu hatası:', docsError);
      process.exit(1);
    }

    console.log('✅ Documents tablosu erişilebilir');
    console.log('📋 İlk 5 belge:', JSON.stringify(docs, null, 2));

    // 2. Spesifik belge araması
    const testIds = ['IC-AD-366', 'RE 34/84-25'];
    console.log(`\n2️⃣ Test belgeleri aranıyor: ${testIds.join(', ')}`);

    for (const testId of testIds) {
      console.log(`\n🔍 "${testId}" aranıyor...`);
      
      // internal_no ile ara
      console.log(`SELECT * FROM documents WHERE internal_no = '${testId}' LIMIT 1`);
      const { data: docByInternalNo, error: internalNoError } = await supabase
        .from('documents')
        .select('*')
        .eq('internal_no', testId)
        .limit(1);

      if (internalNoError) {
        console.error(`❌ Internal no araması hatası (${testId}):`, internalNoError);
      } else if (docByInternalNo?.length > 0) {
        console.log('✅ Belge internal_no ile bulundu:', JSON.stringify(docByInternalNo[0], null, 2));
      } else {
        console.log('⚠️ Belge internal_no ile bulunamadı');

        // letter_no ile dene
        console.log(`SELECT * FROM documents WHERE letter_no = '${testId}' LIMIT 1`);
        const { data: docByLetterNo, error: letterNoError } = await supabase
          .from('documents')
          .select('*')
          .eq('letter_no', testId)
          .limit(1);

        if (letterNoError) {
          console.error(`❌ Letter no araması hatası (${testId}):`, letterNoError);
        } else if (docByLetterNo?.length > 0) {
          console.log('✅ Belge letter_no ile bulundu:', JSON.stringify(docByLetterNo[0], null, 2));
        } else {
          console.log('⚠️ Belge letter_no ile de bulunamadı');
        }
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Genel hata:', err);
    process.exit(1);
  }
}

run();
