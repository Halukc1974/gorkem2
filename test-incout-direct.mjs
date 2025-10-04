#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ymivsbikxiosrdtnnuax.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltaXZzYmlreGlvc3JkdG5udWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczMTc2MDksImV4cCI6MjA3Mjg5MzYwOX0.4Gc2saAw27WX8w78lu8LYr_ad6pRZWTrmC_zBxZGhWE';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testIncOutField() {
  console.log('🔍 Testing inc_out field access...\n');

  try {
    // Test 1: Count total documents
    console.log('📊 Test 1: Counting total documents...');
    const { count: totalCount, error: totalError } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });

    if (totalError) {
      console.error('❌ Error:', totalError);
      return;
    }
    console.log(`✅ Total documents: ${totalCount}\n`);

    // Test 2: Try to get inc_out field (without filter)
    console.log('📊 Test 2: Fetching inc_out field (all records)...');
    const { data: allIncOut, error: allError, count: allCount } = await supabase
      .from('documents')
      .select('inc_out', { count: 'exact' })
      .limit(10);

    if (allError) {
      console.error('❌ Error fetching inc_out:', {
        message: allError.message,
        details: allError.details,
        hint: allError.hint,
        code: allError.code
      });
    } else {
      console.log(`✅ Successfully fetched ${allIncOut?.length} records`);
      console.log('Sample data:', allIncOut);
      console.log(`Total count: ${allCount}\n`);
    }

    // Test 3: Get inc_out with other fields
    console.log('📊 Test 3: Fetching inc_out with id...');
    const { data: withId, error: withIdError } = await supabase
      .from('documents')
      .select('id, inc_out')
      .limit(10);

    if (withIdError) {
      console.error('❌ Error:', withIdError);
    } else {
      console.log(`✅ Successfully fetched ${withId?.length} records with id`);
      console.log('Sample data:', withId);
      console.log('\n');
    }

    // Test 4: Count by inc_out values
    console.log('📊 Test 4: Aggregating inc_out values...');
    const { data: allData, error: aggError } = await supabase
      .from('documents')
      .select('inc_out');

    if (aggError) {
      console.error('❌ Error:', aggError);
    } else {
      const stats = allData?.reduce((acc, item) => {
        const direction = item.inc_out;
        if (direction && direction.trim() !== '') {
          acc[direction] = (acc[direction] || 0) + 1;
        }
        return acc;
      }, {});

      console.log('✅ Incoming/Outgoing breakdown:');
      console.log(JSON.stringify(stats, null, 2));
      
      const total = Object.values(stats || {}).reduce((a, b) => a + b, 0);
      console.log(`\n📈 Total non-null inc_out records: ${total}`);
      console.log(`📈 Total fetched: ${allData?.length}`);
      console.log(`📈 Null/empty count: ${(allData?.length || 0) - total}`);
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

testIncOutField();
