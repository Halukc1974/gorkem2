-- Karar Destek Sistemi - Correspondence Metadata Tablosu
-- Bu migration karar destek sistemi için gerekli veritabanı yapısını oluşturur

CREATE TABLE IF NOT EXISTS correspondence_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  letter_no TEXT NOT NULL,
  letter_date DATE NOT NULL,
  parties TEXT NOT NULL,
  subject TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('Bilgilendirme', 'İhtar', 'Cevap', 'Talep', 'Başvuru', 'Diğer')),
  project_name TEXT NOT NULL,
  criticality INTEGER NOT NULL CHECK (criticality >= 1 AND criticality <= 10),
  decision_made BOOLEAN NOT NULL DEFAULT FALSE,
  decision_date DATE,
  related_docs TEXT[] DEFAULT '{}',
  content TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('Düşük', 'Orta', 'Yüksek')),
  sentiment TEXT NOT NULL CHECK (sentiment IN ('Pozitif', 'Nötr', 'Negatif')),
  keywords TEXT[] DEFAULT '{}',
  ai_analysis JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_correspondence_metadata_letter_date ON correspondence_metadata(letter_date);
CREATE INDEX IF NOT EXISTS idx_correspondence_metadata_project_name ON correspondence_metadata(project_name);
CREATE INDEX IF NOT EXISTS idx_correspondence_metadata_content_type ON correspondence_metadata(content_type);
CREATE INDEX IF NOT EXISTS idx_correspondence_metadata_criticality ON correspondence_metadata(criticality);
CREATE INDEX IF NOT EXISTS idx_correspondence_metadata_risk_level ON correspondence_metadata(risk_level);
CREATE INDEX IF NOT EXISTS idx_correspondence_metadata_keywords ON correspondence_metadata USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_correspondence_metadata_ai_analysis ON correspondence_metadata USING GIN(ai_analysis);

-- Full text search index for content and subject
CREATE INDEX IF NOT EXISTS idx_correspondence_metadata_fts ON correspondence_metadata
USING GIN (to_tsvector('turkish', subject || ' ' || content));

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_correspondence_metadata_updated_at
    BEFORE UPDATE ON correspondence_metadata
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) - Enable RLS
ALTER TABLE correspondence_metadata ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see correspondence from their projects or public ones
-- This is a basic policy - adjust according to your authentication system
CREATE POLICY "Users can view correspondence" ON correspondence_metadata
    FOR SELECT USING (true); -- Adjust this based on your auth requirements

-- Policy: Only authenticated users can insert
CREATE POLICY "Authenticated users can insert correspondence" ON correspondence_metadata
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy: Only authenticated users can update
CREATE POLICY "Authenticated users can update correspondence" ON correspondence_metadata
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Insert some sample data for testing
INSERT INTO correspondence_metadata (
  letter_no, letter_date, parties, subject, content_type, project_name,
  criticality, decision_made, content, risk_level, sentiment, keywords
) VALUES
(
  '2024/001',
  '2024-09-15',
  'Görkem İnşaat Ltd. Şti. - İstanbul Büyükşehir Belediyesi',
  'Proje İzni Başvuru',
  'Başvuru',
  'İstanbul Metro Hattı',
  8,
  false,
  'İstanbul Büyükşehir Belediyesi''ne yapılan proje izin başvurusu ile ilgili yazışma...',
  'Orta',
  'Nötr',
  ARRAY['proje', 'izin', 'metro', 'başvuru']
),
(
  '2024/002',
  '2024-09-10',
  'Görkem İnşaat Ltd. Şti. - Çevre Bakanlığı',
  'ÇED Raporu Onayı',
  'Bilgilendirme',
  'İstanbul Metro Hattı',
  6,
  true,
  'Çevre Etki Değerlendirmesi raporu onay süreci tamamlandı...',
  'Düşük',
  'Pozitif',
  ARRAY['çed', 'çevre', 'rapor', 'onay']
),
(
  '2024/003',
  '2024-09-05',
  'Görkem İnşaat Ltd. Şti. - Maliye Bakanlığı',
  'KDV İadesi Talebi',
  'Talep',
  'İstanbul Metro Hattı',
  7,
  false,
  'Yapılan harcamalar için KDV iadesi talebi...',
  'Orta',
  'Nötr',
  ARRAY['kdv', 'iade', 'ödeme', 'talep']
)
ON CONFLICT (id) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE correspondence_metadata IS 'Karar destek sistemi için yazışma metadata bilgileri';
COMMENT ON COLUMN correspondence_metadata.ai_analysis IS 'AI analiz sonuçları JSON formatında';
COMMENT ON COLUMN correspondence_metadata.keywords IS 'AI tarafından çıkarılan anahtar kelimeler';
COMMENT ON COLUMN correspondence_metadata.criticality IS '1-10 arası önem derecesi';
COMMENT ON COLUMN correspondence_metadata.related_docs IS 'İlişkili belge ID''leri dizisi';