#!/bin/bash

# Karar Destek Sistemi Migration Script
# Bu script karar destek sistemi için gerekli veritabanı yapısını oluşturur

echo "🔄 Karar Destek Sistemi veritabanı migration'ı başlatılıyor..."

# Supabase connection details - environment variables'dan al
SUPABASE_URL=${SUPABASE_URL:-"your-supabase-url"}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:-"your-anon-key"}

# Migration dosyasının yolu
MIGRATION_FILE="/workspaces/gorkem2/db/decision-support-migration.sql"

# Migration dosyasının varlığını kontrol et
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration dosyası bulunamadı: $MIGRATION_FILE"
    exit 1
fi

# psql komutunu kullanarak migration'ı çalıştır
echo "📊 Migration dosyası uygulanıyor..."
psql "$SUPABASE_URL" \
     -f "$MIGRATION_FILE" \
     -v ON_ERROR_STOP=1 \
     --single-transaction

if [ $? -eq 0 ]; then
    echo "✅ Karar Destek Sistemi migration'ı başarıyla tamamlandı!"
    echo "📋 Oluşturulan tablolar:"
    echo "   - correspondence_metadata"
    echo "📊 Örnek veriler eklendi"
else
    echo "❌ Migration başarısız oldu!"
    exit 1
fi

echo "🎯 Karar Destek Sistemi kullanıma hazır!"