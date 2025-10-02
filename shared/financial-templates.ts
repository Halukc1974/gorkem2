// Finansal Google Sheets şablonları
export const FINANCIAL_SHEET_TEMPLATES = {
  'Gelirler': {
    template: 'income-tracking',
    headers: [
      'Date',
      'Proje ID', 
      'Gelir Türü',
      'Açıklama',
      'Tutar',
      'Para Birimi',
      'Ödeme Durumu',
      'Fatura No',
      'Müşteri',
      'Kategori'
    ],
    categories: [
      'Hakediş Gelirleri',
      'Enerji Gelirleri', 
      'Zirai Gelirler',
      'Kira Gelirleri',
      'Faiz Gelirleri',
      'Devlet Destekleri',
      'Diğer Gelirler'
    ]
  },
  
  'Giderler': {
    template: 'expense-tracking',
    headers: [
      'Date',
      'Proje ID',
      'Kategori',
      'Alt Kategori',
      'Açıklama',
      'Tutar',
      'Para Birimi',
      'Ödeme Durumu',
      'Tedarikçi',
      'Fatura No'
    ],
    categories: [
      'Şantiye Giderleri',
      'Taşeron Hakedişleri', 
      'Merkez Giderleri',
      'Enerji ve Tarım Giderleri',
      'Finansman Giderleri',
      'Vergi ve SGK',
      'Diğer Giderler'
    ]
  },

  'Projeler': {
    template: 'project-tracking',
    headers: [
      'Proje Adı',
      'Proje Numarası/Kodu',
      'İşveren',
      'Yüklenici Firma',
      'Müşavir Firma',
      'Proje Türü',
      'Proje Lokasyonu',
      'Arsa Alanı (m²)',
      'İnşaat Alanı Brüt (m²)',
      'İnşaat Alanı Net (m²)',
      'Kat Adedi',
      'Başlangıç Datei',
      'Bitiş Datei',
      'Devam Durumu',
      'Fiili Bitiş Datei',
      'Alt Yükleniciler',
      'Yaklaşık Maliyet',
      'Kesin Teminat %',
      'Geçici Teminat %',
      'Finansman Kaynakları',
      'Geçici Kabul Durumu',
      'Kesin Kabul Durumu',
      'As-Built Proje Durumu'
    ],
    categories: [
      'Konut Projeleri',
      'Ticari Projeler', 
      'Endüstriyel Projeler',
      'Altyapı Projeleri',
      'Kamu Projeleri',
      'Özel Sektör Projeleri'
    ]
  },

  'Banka_Hesaplari': {
    template: 'bank-accounts',
    headers: [
      'Hesap Adı',
      'Banka',
      'Hesap No',
      'Bakiye',
      'Para Birimi',
      'Date',
      'Hesap Türü',
      'Durum'
    ]
  },

  'Yaklasan_Odemeler': {
    template: 'upcoming-payments',
    headers: [
      'Vade Datei',
      'Açıklama',
      'Tutar',
      'Kategori',
      'Öncelik',
      'Durum',
      'Sorumlu',
      'Notlar'
    ]
  },

  'Istirakler': {
    template: 'subsidiaries',
    headers: [
      'İştirak Adı',
      'Sektör',
      'Aylık Gelir',
      'Aylık Gider',
      'Net Kar',
      'Date',
      'Aktif Projeler',
      'Durum'
    ]
  }
};
