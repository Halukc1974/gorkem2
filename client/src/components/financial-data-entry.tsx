import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { CalendarDays, Plus, Save } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { googleSheetsClient } from '../services/googleSheets';

interface FinancialEntry {
  Date: string;
  proje_id?: string;
  aciklama: string;
  tutar: number;
  para_birimi: string;
  kategori: string;
  alt_kategori?: string;
  odeme_durumu: string;
}

export function FinancialDataEntry() {
  const [activeTab, setActiveTab] = useState('gelir');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Form states
  const [gelirForm, setGelirForm] = useState<FinancialEntry>({
    Date: new Date().toISOString().split('T')[0],
    proje_id: '',
    aciklama: '',
    tutar: 0,
    para_birimi: 'TRY',
    kategori: '',
    odeme_durumu: 'Bekliyor'
  });

  const [giderForm, setGiderForm] = useState<FinancialEntry>({
    Date: new Date().toISOString().split('T')[0],
    proje_id: '',
    aciklama: '',
    tutar: 0,
    para_birimi: 'TRY',
    kategori: '',
    alt_kategori: '',
    odeme_durumu: 'Bekliyor'
  });

  // Kategori seçenekleri
  const gelirKategorileri = [
    'Hakediş Gelirleri',
    'Enerji Gelirleri', 
    'Zirai Gelirler',
    'Kira Gelirleri',
    'Faiz Gelirleri',
    'Devlet Destekleri',
    'Diğer Gelirler'
  ];

  const giderKategorileri = [
    'Şantiye Giderleri',
    'Taşeron Hakedişleri', 
    'Merkez Giderleri',
    'Enerji ve Tarım Giderleri',
    'Finansman Giderleri',
    'Vergi ve SGK',
    'Diğer Giderler'
  ];

  const giderAltKategorileri: Record<string, string[]> = {
    'Şantiye Giderleri': ['Malzeme', 'İşçilik', 'Ekipman', 'Ulaşım', 'Konaklama'],
    'Taşeron Hakedişleri': ['Kaba İnşaat', 'İnce İnşaat', 'Elektrik', 'Sıhhi Tesisat', 'Dış Cephe'],
    'Merkez Giderleri': ['Personel Maaşları', 'Kira', 'Araç', 'İletişim', 'Kırtasiye'],
    'Finansman Giderleri': ['Kredi Faizi', 'Teminat Mektubu', 'Banka Masrafları'],
    'Vergi ve SGK': ['KDV', 'Gelir Vergisi', 'SGK Primi', 'İşsizlik Sigortası']
  };

  // Gelir kaydetme
  const saveGelir = async () => {
    if (!gelirForm.aciklama || !gelirForm.tutar || !gelirForm.kategori) {
      toast({
        title: "Eksik Bilgi",
        description: "Lütfen zorunlu alanları doldurun",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      
      // Google Sheets'e yeni satır ekle
      const rowData = [
        gelirForm.Date,
        gelirForm.proje_id || '',
        gelirForm.kategori,
        gelirForm.aciklama,
        gelirForm.tutar.toString(),
        gelirForm.para_birimi,
        gelirForm.odeme_durumu,
        '', // fatura_no
        '', // musteri
        gelirForm.alt_kategori || ''
      ];

      // Client-side Google Sheets append is deprecated.
      // Replace with Supabase server-side write or other backend integration.
      console.warn('Attempted to append to Google Sheets from client; operation skipped.');
      toast({
        title: "Devre Dışı",
        description: "Gelir kaydı client'tan doğrudan Google Sheets'e eklenemez. Lütfen yönetici ile iletişime geçin.",
        variant: 'destructive'
      });

      // Formu resetle
      setGelirForm({
        Date: new Date().toISOString().split('T')[0],
        proje_id: '',
        aciklama: '',
        tutar: 0,
        para_birimi: 'TRY',
        kategori: '',
        odeme_durumu: 'Bekliyor'
      });

    } catch (error: any) {
      toast({
        title: "Hata",
        description: "Gelir kaydı eklenemedi: " + (error?.message || 'Bilinmeyen hata'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Gider kaydetme
  const saveGider = async () => {
    if (!giderForm.aciklama || !giderForm.tutar || !giderForm.kategori) {
      toast({
        title: "Eksik Bilgi",
        description: "Lütfen zorunlu alanları doldurun",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      
      const rowData = [
        giderForm.Date,
        giderForm.proje_id || '',
        giderForm.kategori,
        giderForm.alt_kategori || '',
        giderForm.aciklama,
        giderForm.tutar.toString(),
        giderForm.para_birimi,
        giderForm.odeme_durumu,
        '', // tedarikci
        ''  // fatura_no
      ];

      console.warn('Attempted to append to Google Sheets from client; operation skipped.');
      toast({
        title: "Devre Dışı",
        description: "Gider kaydı client'tan doğrudan Google Sheets'e eklenemez. Lütfen yönetici ile iletişime geçin.",
        variant: 'destructive'
      });

      // Formu resetle
      setGiderForm({
        Date: new Date().toISOString().split('T')[0],
        proje_id: '',
        aciklama: '',
        tutar: 0,
        para_birimi: 'TRY',
        kategori: '',
        alt_kategori: '',
        odeme_durumu: 'Bekliyor'
      });

    } catch (error: any) {
      toast({
        title: "Hata",
        description: "Gider kaydı eklenemedi: " + (error?.message || 'Bilinmeyen hata'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Finansal Veri Girişi</h2>
        <p className="text-muted-foreground">Gelir ve gider kayıtlarını buradan ekleyebilirsiniz</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="gelir" className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-green-600" />
            Gelir Ekle
          </TabsTrigger>
          <TabsTrigger value="gider" className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-red-600" />
            Gider Ekle
          </TabsTrigger>
        </TabsList>

        {/* Gelir Formu */}
        <TabsContent value="gelir" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-green-600">Yeni Gelir Kaydı</CardTitle>
              <CardDescription>Gelir bilgilerini girin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gelir-Date">Date *</Label>
                  <Input
                    id="gelir-Date"
                    type="date"
                    value={gelirForm.Date}
                    onChange={(e) => setGelirForm({...gelirForm, Date: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="gelir-proje">Proje ID</Label>
                  <Input
                    id="gelir-proje"
                    placeholder="PROJ001"
                    value={gelirForm.proje_id}
                    onChange={(e) => setGelirForm({...gelirForm, proje_id: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gelir-kategori">Gelir Türü *</Label>
                <Select onValueChange={(value) => setGelirForm({...gelirForm, kategori: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Gelir türünü seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {gelirKategorileri.map((kategori) => (
                      <SelectItem key={kategori} value={kategori}>
                        {kategori}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gelir-aciklama">Açıklama *</Label>
                <Textarea
                  id="gelir-aciklama"
                  placeholder="Gelir açıklaması..."
                  value={gelirForm.aciklama}
                  onChange={(e) => setGelirForm({...gelirForm, aciklama: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gelir-tutar">Tutar *</Label>
                  <Input
                    id="gelir-tutar"
                    type="number"
                    placeholder="0"
                    value={gelirForm.tutar}
                    onChange={(e) => setGelirForm({...gelirForm, tutar: parseFloat(e.target.value) || 0})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gelir-para-birimi">Para Birimi</Label>
                  <Select onValueChange={(value) => setGelirForm({...gelirForm, para_birimi: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="TRY" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRY">TRY (₺)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gelir-durum">Ödeme Durumu</Label>
                  <Select onValueChange={(value) => setGelirForm({...gelirForm, odeme_durumu: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Bekliyor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ödendi">Ödendi</SelectItem>
                      <SelectItem value="Bekliyor">Bekliyor</SelectItem>
                      <SelectItem value="Gecikti">Gecikti</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={saveGelir} disabled={loading} className="bg-green-600 hover:bg-green-700">
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Kaydediliyor...' : 'Gelir Kaydet'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Gider Formu */}
        <TabsContent value="gider" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">Yeni Gider Kaydı</CardTitle>
              <CardDescription>Gider bilgilerini girin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gider-Date">Date *</Label>
                  <Input
                    id="gider-Date"
                    type="date"
                    value={giderForm.Date}
                    onChange={(e) => setGiderForm({...giderForm, Date: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="gider-proje">Proje ID</Label>
                  <Input
                    id="gider-proje"
                    placeholder="PROJ001"
                    value={giderForm.proje_id}
                    onChange={(e) => setGiderForm({...giderForm, proje_id: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gider-kategori">Gider Kategorisi *</Label>
                  <Select onValueChange={(value) => setGiderForm({...giderForm, kategori: value, alt_kategori: ''})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kategori seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {giderKategorileri.map((kategori) => (
                        <SelectItem key={kategori} value={kategori}>
                          {kategori}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {giderForm.kategori && giderAltKategorileri[giderForm.kategori] && (
                  <div className="space-y-2">
                    <Label htmlFor="gider-alt-kategori">Alt Kategori</Label>
                    <Select onValueChange={(value) => setGiderForm({...giderForm, alt_kategori: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Alt kategori seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {giderAltKategorileri[giderForm.kategori].map((altKategori) => (
                          <SelectItem key={altKategori} value={altKategori}>
                            {altKategori}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="gider-aciklama">Açıklama *</Label>
                <Textarea
                  id="gider-aciklama"
                  placeholder="Gider açıklaması..."
                  value={giderForm.aciklama}
                  onChange={(e) => setGiderForm({...giderForm, aciklama: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gider-tutar">Tutar *</Label>
                  <Input
                    id="gider-tutar"
                    type="number"
                    placeholder="0"
                    value={giderForm.tutar}
                    onChange={(e) => setGiderForm({...giderForm, tutar: parseFloat(e.target.value) || 0})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gider-para-birimi">Para Birimi</Label>
                  <Select onValueChange={(value) => setGiderForm({...giderForm, para_birimi: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="TRY" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRY">TRY (₺)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gider-durum">Ödeme Durumu</Label>
                  <Select onValueChange={(value) => setGiderForm({...giderForm, odeme_durumu: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Bekliyor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Ödendi">Ödendi</SelectItem>
                      <SelectItem value="Bekliyor">Bekliyor</SelectItem>
                      <SelectItem value="Gecikti">Gecikti</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button onClick={saveGider} disabled={loading} className="bg-red-600 hover:bg-red-700">
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? 'Kaydediliyor...' : 'Gider Kaydet'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
