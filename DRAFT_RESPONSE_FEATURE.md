# Draft Response Feature - Kurulum ve Kullanım

## 🚀 Özellik Özeti

Dokümanlara AI destekli resmi cevap yazısı oluşturma sistemi eklendi.

## 📋 Özellikler

### 1. İki Tip Seçim Sistemi
- **"Cevap Vermek İçin"** (Mavi): Sadece bir doküman seçilebilir
- **"Referans Olarak Ekle"** (Yeşil): Birden fazla doküman seçilebilir
- **Mutual Exclusion**: Cevap dokümanı referans olamaz, referans doküman cevap olamaz

### 2. Draft Configuration Modal
- Cevap verilecek doküman bilgileri (mavi kutu)
- Referans dokümanlar listesi (yeşil kutu) - X ile silinebilir
- Talimat girişi (opsiyonel): Olumlu/olumsuz, detaylı/kısa vb.
- "Cevap Yazısı Oluştur" butonu

### 3. Generated Draft Modal
- AI ile oluşturulan resmi cevap metni
- Text olarak indirme butonu ✅
- PDF olarak indirme butonu (jsPDF kurulumu gerekli)

## 🔧 Kurulum

### Adım 1: jsPDF Kütüphanesini Kur

Terminalde aşağıdaki komutu çalıştırın:

```bash
npm install jspdf
```

### Adım 2: PDF Butonunu Aktif Et

`/workspaces/gorkem2/client/src/pages/ai-search.tsx` dosyasında yaklaşık **2716. satırda** bulunan PDF butonu kodunu aşağıdaki ile değiştirin:

**ŞU ANKİ KOD (Devre Dışı):**
```tsx
<Button
  onClick={() => {
    toast({
      title: 'Bilgi',
      description: 'PDF özelliği için önce terminalde "npm install jspdf" komutunu çalıştırın.',
      variant: 'default'
    });
  }}
  disabled
  className="bg-gray-400 cursor-not-allowed"
>
  <FileText className="w-4 h-4 mr-2" />
  PDF Olarak İndir (npm install jspdf gerekli)
</Button>
```

**YENİ KOD (Aktif):**
```tsx
<Button
  onClick={async () => {
    try {
      const { jsPDF } = await import('jspdf');
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      
      // Split text into lines that fit the page
      const lines = doc.splitTextToSize(generatedDraftText, maxWidth);
      
      // Add text to PDF with pagination
      let y = margin;
      const lineHeight = 7;
      
      for (let i = 0; i < lines.length; i++) {
        if (y + lineHeight > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(lines[i], margin, y);
        y += lineHeight;
      }
      
      doc.save(`draft-response-${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast({
        title: 'İndirildi',
        description: 'Cevap yazısı PDF olarak indirildi.',
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: 'Hata',
        description: 'PDF oluşturulamadı. Lütfen text olarak indirin.',
        variant: 'destructive'
      });
    }
  }}
  className="bg-red-600 hover:bg-red-700"
>
  <FileText className="w-4 h-4 mr-2" />
  PDF Olarak İndir
</Button>
```

### Adım 3: Build

```bash
npm run build
```

## 📖 Kullanım Adımları

1. **Dokümanlari Analiz Et**: Document Analysis sekmesinde dokümanlari seçip "Analyze" butonuna bas
2. **ChatGPT/DeepSeek Seç**: Model seç ve analiz et
3. **Cevap Dokümanı Seç**: Bir dokümanda "Cevap Vermek İçin" checkbox'ını işaretle
4. **Referans Ekle (Opsiyonel)**: Diğer dokümanlarda "Referans Olarak Ekle" checkbox'larını işaretle
5. **Draft Oluştur**: "Cevap Yazısı Oluştur" butonuna bas
6. **Talimat Gir (Opsiyonel)**: Draft configuration modal'da istediğin tarzı belirt
   - Örnek: "Olumlu bir cevap ver, talepleri kabul et"
   - Örnek: "Olumsuz yanıt ver, maliyet sebeplerini açıkla"
7. **Oluştur ve İndir**: "Cevap Yazısı Oluştur" butonuna bas, sonra Text veya PDF olarak indir

## ⚠️ Önemli Notlar

- **Mutual Exclusion**: Cevap için seçilen doküman referans olamaz
- **Tek Cevap Dokümanı**: Sadece bir doküman cevap için seçilebilir
- **Çoklu Referans**: Birden fazla referans doküman eklenebilir
- **Modal Durumu**: Generated draft modal kapatıldığında draft config modal açık kalır
- **API Kullanımı**: ChatGPT veya DeepSeek API kullanır (analysisOptions'daki seçime göre)
- **Token Limiti**: AI prompt max 2500 token ile sınırlı

## 🎯 State Değişkenleri

```typescript
const [selectedForResponse, setSelectedForResponse] = useState<string | null>(null);
const [selectedAsReference, setSelectedAsReference] = useState<Set<string>>(new Set());
const [showDraftModal, setShowDraftModal] = useState(false);
const [showGeneratedDraftModal, setShowGeneratedDraftModal] = useState(false);
const [draftInstructions, setDraftInstructions] = useState('');
const [generatedDraftText, setGeneratedDraftText] = useState('');
```

## 🔧 Handler Fonksiyonları

- `handleResponseCheckbox(id)` - Cevap dokümanı seçimi
- `handleReferenceCheckbox(id)` - Referans doküman toggle
- `removeReference(id)` - Referans dokümanı kaldırma
- `handleGenerateDraft()` - Draft configuration modal açma
- `handleActualDraftGeneration()` - AI ile cevap oluşturma

## 📝 AI Prompt Yapısı

Draft oluşturma prompt'u şunları içerir:
1. Cevap verilecek doküman detayları (letter_no, date, subject, analiz)
2. Referans dokümanlar listesi (eğer varsa)
3. Kullanıcı talimatları (eğer girilmişse)
4. Resmi iş mektubu format gereksinimleri

## 🎨 UI Güncellemeleri

- Analysis results card'larında iki checkbox
- "Cevap Yazısı Oluştur" butonu (sadece response seçiliyse aktif)
- Draft configuration modal (document info + references + instructions)
- Generated draft modal (text display + download buttons)

---

**Geliştirme Tarihi**: 7 Ekim 2025
**Dosya**: `/workspaces/gorkem2/client/src/pages/ai-search.tsx`
**Satır Sayısı**: 2754 (modal'lar dahil)
