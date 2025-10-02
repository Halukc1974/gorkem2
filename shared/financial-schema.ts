// Finansal dashboard için Google Sheets veri yapısı
export const FINANCIAL_SHEETS_STRUCTURE = {
  // Ana finansal veriler
  gelirler: {
    columns: [
      'Date',           // 2025-09-02
      'proje_id',        // PROJ001
      'gelir_turu',      // Hakediş, Enerji, Zirai, Diğer
      'aciklama',        // Açıklama
      'tutar',           // 150000
      'para_birimi',     // TL, USD, EUR
      'odeme_durumu',    // Ödendi, Bekliyor, Gecikti
      'fatura_no',       // F-2025-001
      'musteri',         // Müşteri adı
      'kategori'         // Alt kategori
    ]
  },
  
  giderler: {
    columns: [
      'Date',           // 2025-09-02
      'proje_id',        // PROJ001
      'kategori',        // Şantiye, Taşeron, Merkez, Enerji, Finansman
      'alt_kategori',    // Malzeme, İşçilik, Kira, Kredi
      'aciklama',        // Açıklama
      'tutar',           // 50000
      'para_birimi',     // TL, USD, EUR
      'odeme_durumu',    // Ödendi, Bekliyor, Gecikti
      'tedarikci',       // Tedarikçi adı
      'fatura_no'        // Fatura numarası
    ]
  },

  projeler: {
    columns: [
      'proje_id',        // PROJ001
      'proje_adi',       // Konut Projesi A
      'toplam_butce',    // 5000000
      'baslangic_Datei', // 2025-01-01
      'bitis_Datei',    // 2025-12-31
      'durum',           // Aktif, Tamamlandı, Askıya alındı
      'sorumlu_kisi',    // Proje sorumlusu
      'lokasyon',        // İstanbul/Başakşehir
      'tip'              // Konut, Ticari, Altyapı
    ]
  },

  banka_hesaplari: {
    columns: [
      'hesap_adi',       // Ziraat TL Hesabı
      'banka',           // T.C. Ziraat Bankası
      'hesap_no',        // 1234567890
      'bakiye',          // 2500000
      'para_birimi',     // TL, USD, EUR
      'Date',           // 2025-09-02
      'hesap_turu',      // Vadesiz, Vadeli, Kredi
      'durum'            // Aktif, Pasif
    ]
  },

  yaklasan_odemeler: {
    columns: [
      'vade_Datei',     // 2025-09-05
      'aciklama',        // SGK Primi
      'tutar',           // 75000
      'kategori',        // Vergi, SGK, Taşeron, Kredi
      'oncelik',         // Yüksek, Orta, Düşük
      'durum',           // Bekliyor, Ödendi, Gecikti
      'sorumlu',         // Ödemeyi yapacak kişi
      'notlar'           // Ek bilgiler
    ]
  },

  istirakler: {
    columns: [
      'istirak_adi',     // Görkem Enerji A.Ş.
      'sektor',          // Enerji, Tarım, İnşaat
      'aylık_gelir',     // 180000
      'aylık_gider',     // 120000
      'net_kar',         // 60000
      'Date',           // 2025-09-01
      'aktif_projeler',  // 3
      'durum'            // Aktif, Pasif
    ]
  }
};
