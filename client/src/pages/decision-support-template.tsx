import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Alert, AlertDescription } from '../components/ui/alert';
import { useToast } from '../hooks/use-toast';
import { Brain, Search, FileText, Plus, X, Loader2, Reply, AlertTriangle } from 'lucide-react';

import { useUserSettings } from "../hooks/useUserSettings";
import { useDocumentSearch } from "../hooks/useDocumentSearch";

// Services
import { decisionSupportService, CorrespondenceMetadata, SearchFilters } from '../services/decision-support';
import { supabaseService } from '../services/supabase';

const DecisionSupportTemplate: React.FC = () => {
  // Search and data states
  const [correspondenceData, setCorrespondenceData] = useState<CorrespondenceMetadata[]>([]);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    query: '',
    type_of_corr: '',
    inc_out: 'all',
    severity_rate: 'all'
  });
  const [isLoading, setIsLoading] = useState(false);

  // Correspondence basket (sepet) states
  const [correspondenceBasket, setCorrespondenceBasket] = useState<CorrespondenceMetadata[]>([]);
  const [selectedForResponse, setSelectedForResponse] = useState<CorrespondenceMetadata | null>(null);
  const [referenceDocuments, setReferenceDocuments] = useState<CorrespondenceMetadata[]>([]);

  // UI states
  const [selectedCorrespondence, setSelectedCorrespondence] = useState<CorrespondenceMetadata | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('correspondence');
  const [isConfigured, setIsConfigured] = useState(false);
  const [useVectorSearch, setUseVectorSearch] = useState(false);

  const { config } = useUserSettings();
  const { configureServices } = useDocumentSearch();
  const { toast } = useToast();

  // Configure Supabase using global config
  useEffect(() => {
    if (config?.supabase?.url && config?.supabase?.anonKey) {
      try {
        configureServices({ supabase: config.supabase });
        setIsConfigured(true);
        console.log('✅ Karar destek sistemi: Supabase konfigürasyonu yüklendi (global config)');
      } catch (error) {
        console.error('❌ Karar destek sistemi: Supabase konfigürasyonu başarısız:', error);
        setIsConfigured(false);
      }
    } else {
      console.warn('⚠️ Karar destek sistemi: Geçerli Supabase konfigürasyonu bulunamadı');
      setIsConfigured(false);
    }
  }, [config, configureServices]);

  // Load initial data
  useEffect(() => {
    if (isConfigured) {
      loadCorrespondenceData();
    }
  }, [isConfigured]);

  // Load correspondence data from database
  const loadCorrespondenceData = async () => {
    if (!isConfigured) {
      toast({
        title: "Konfigürasyon Gerekli",
        description: "Veritabanı bağlantısı yapılandırılmamış.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      let result;
      
      if (useVectorSearch && searchFilters.query.trim()) {
        // Vektör arama kullan
        result = await decisionSupportService.searchCorrespondenceVector(
          searchFilters.query, 
          searchFilters
        );
      } else {
        // Normal text arama
        result = await decisionSupportService.searchCorrespondence(searchFilters.query || '', searchFilters);
      }
      
      setCorrespondenceData(result.data);
    } catch (error) {
      console.error('Error loading correspondence data:', error);
      toast({
        title: "Veri Yükleme Hatası",
        description: "Yazışma verileri yüklenirken bir hata oluştu. Veritabanı bağlantısını kontrol edin.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add to correspondence basket
  const addToBasket = (correspondence: CorrespondenceMetadata) => {
    if (!correspondenceBasket.find(item => item.id === correspondence.id)) {
      setCorrespondenceBasket(prev => [...prev, correspondence]);
      toast({
        title: "Sepete Eklendi",
        description: `"${correspondence.short_desc}" sepetinize eklendi.`,
      });
    } else {
      toast({
        title: "Zaten Sepette",
        description: "Bu yazışma zaten sepetinizde bulunuyor.",
        variant: "destructive",
      });
    }
  };

  // Remove from correspondence basket
  const removeFromBasket = (correspondenceId: string) => {
    setCorrespondenceBasket(prev => prev.filter(item => item.id !== correspondenceId));
    toast({
      title: "Sepetten Çıkarıldı",
      description: "Yazışma sepetinizden çıkarıldı.",
    });
  };

  // Set as response target
  const setAsResponseTarget = (correspondence: CorrespondenceMetadata) => {
    setSelectedForResponse(correspondence);
    toast({
      title: "Cevap Hedefi Seçildi",
      description: `"${correspondence.short_desc}" için cevap yazılacak.`,
    });
  };

  // Add as reference document
  const addAsReference = (correspondence: CorrespondenceMetadata) => {
    if (!referenceDocuments.find(item => item.id === correspondence.id)) {
      setReferenceDocuments(prev => [...prev, correspondence]);
      toast({
        title: "Referans Eklendi",
        description: `"${correspondence.short_desc}" referans belgesi olarak eklendi.`,
      });
    }
  };

  // Remove reference document
  const removeReference = (correspondenceId: string) => {
    setReferenceDocuments(prev => prev.filter(item => item.id !== correspondenceId));
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'Yüksek': return 'destructive';
      case 'Orta': return 'secondary';
      case 'Düşük': return 'default';
      default: return 'default';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'Pozitif': return 'default';
      case 'Nötr': return 'secondary';
      case 'Negatif': return 'destructive';
      default: return 'default';
    }
  };

  const handleAnalyze = async (item: CorrespondenceMetadata) => {
    if (!isConfigured) {
      toast({
        title: "Konfigürasyon Gerekli",
        description: "AI analiz için gerekli konfigürasyonlar eksik.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setSelectedCorrespondence(item);

    try {
      const analysis = await decisionSupportService.analyzeCorrespondence(item.content);
      setSelectedCorrespondence({ ...item, aiAnalysis: analysis });

      toast({
        title: 'AI Analiz Tamamlandı',
        description: `${item.short_desc} için analiz hazır.`,
      });
    } catch (error) {
      console.error('AI analysis error:', error);
      toast({
        title: "Analiz Hatası",
        description: "AI analiz sırasında bir hata oluştu. API key'lerini kontrol edin.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Generate decision support report based on basket items
  const generateDecisionReport = async () => {
    if (!isConfigured) {
      toast({
        title: "Konfigürasyon Gerekli",
        description: "Karar raporu oluşturmak için gerekli konfigürasyonlar eksik.",
        variant: "destructive",
      });
      return;
    }

    if (correspondenceBasket.length === 0) {
      toast({
        title: "Sepet Boş",
        description: "Karar raporu oluşturmak için sepetinize yazışma ekleyin.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      // Combine all correspondence content for analysis
      const combinedContent = correspondenceBasket.map(item => item.content).join('\n\n');
      const analysis = await decisionSupportService.analyzeCorrespondence(combinedContent);

      // Create comprehensive report
      const report = {
        targetCorrespondence: selectedForResponse,
        referenceDocuments: referenceDocuments,
        basketItems: correspondenceBasket,
        analysis: analysis,
        generatedAt: new Date().toISOString(),
        recommendations: generateBasketRecommendations()
      };

      // Store report in localStorage for now (could be saved to database later)
      localStorage.setItem('decisionSupportReport', JSON.stringify(report));

      toast({
        title: "Karar Raporu Hazır",
        description: "Seçili yazışmalar temel alınarak karar raporu oluşturuldu.",
      });

      setActiveTab('reports');
    } catch (error) {
      console.error('Report generation error:', error);
      toast({
        title: "Rapor Oluşturma Hatası",
        description: "Karar raporu oluşturulurken bir hata oluştu. API key'lerini kontrol edin.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Generate recommendations based on basket contents
  const generateBasketRecommendations = () => {
    const recommendations = [];
    const highSeverityItems = correspondenceBasket.filter(item => item.severity_rate === '5');
    const urgentItems = correspondenceBasket.filter(item => item.severity_rate >= '4');

    if (highSeverityItems.length > 0) {
      recommendations.push(`${highSeverityItems.length} adet yüksek önem dereceli yazışma için acil eylem planı hazırlayın`);
    }

    if (urgentItems.length > 0) {
      recommendations.push(`${urgentItems.length} adet kritik yazışma için üst yönetim onayını alın`);
    }

    if (selectedForResponse) {
      recommendations.push(`${selectedForResponse.short_desc} yazışması için hazırlanan cevap yazısını ilgili taraflara iletin`);
    }

    return recommendations;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">🧠 Karar Destek Sistemi</h1>
          <p className="text-muted-foreground">AI destekli yazışma analizi ve karar verme sistemi</p>
        </div>
      </div>

      {!isConfigured && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Karar destek sistemi için Supabase bağlantısı yapılandırılmamış.
            Lütfen ayarlar sekmesinden Supabase URL ve Anon Key bilgilerini girin.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="correspondence">Yazışmalar</TabsTrigger>
          <TabsTrigger value="analysis">AI Analiz</TabsTrigger>
          <TabsTrigger value="templates">Şablonlar</TabsTrigger>
          <TabsTrigger value="reports">Raporlar</TabsTrigger>
        </TabsList>

        {/* Correspondence Tab */}
        <TabsContent value="correspondence" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Search and Results Section */}
            <div className="lg:col-span-3 space-y-6">
              {/* Search Filters */}
              <Card>
                <CardHeader>
                  <CardTitle>Yazışma Arama</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="searchQuery">Arama Kelimesi</Label>
                      <Input
                        id="searchQuery"
                        placeholder="Konu, içerik veya anahtar kelime..."
                        value={searchFilters.query}
                        onChange={(e) => setSearchFilters(prev => ({ ...prev, query: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="type_of_corr">Yazışma Tipi</Label>
                      <Select value={searchFilters.type_of_corr} onValueChange={(value) => setSearchFilters(prev => ({ ...prev, type_of_corr: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Tümü" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tümü</SelectItem>
                          <SelectItem value="HardCopy">HardCopy</SelectItem>
                          <SelectItem value="Email">Email</SelectItem>
                          <SelectItem value="Digital">Digital</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="inc_out">Gelen/Giden</Label>
                      <Select value={searchFilters.inc_out} onValueChange={(value) => setSearchFilters(prev => ({ ...prev, inc_out: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Tümü" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tümü</SelectItem>
                          <SelectItem value="incoming">Gelen</SelectItem>
                          <SelectItem value="outgoing">Giden</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="severity_rate">Önem Derecesi</Label>
                      <Select value={searchFilters.severity_rate} onValueChange={(value) => setSearchFilters(prev => ({ ...prev, severity_rate: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Tümü" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tümü</SelectItem>
                          <SelectItem value="1">Düşük (1)</SelectItem>
                          <SelectItem value="2">Orta (2)</SelectItem>
                          <SelectItem value="3">Yüksek (3)</SelectItem>
                          <SelectItem value="4">Kritik (4)</SelectItem>
                          <SelectItem value="5">Acil (5)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 items-center">
                    <Button onClick={loadCorrespondenceData} disabled={isLoading || !isConfigured}>
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                      Ara
                    </Button>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="vectorSearch"
                        checked={useVectorSearch}
                        onCheckedChange={(checked) => setUseVectorSearch(checked as boolean)}
                      />
                      <Label htmlFor="vectorSearch" className="text-sm">Vektör Arama</Label>
                    </div>
                    <Button variant="outline" onClick={() => {
                      setSearchFilters({ query: '', type_of_corr: '', inc_out: 'all', severity_rate: 'all' });
                      setUseVectorSearch(false);
                    }}>
                      Temizle
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Search Results */}
              <Card>
                <CardHeader>
                  <CardTitle>Arama Sonuçları ({correspondenceData.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : correspondenceData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Arama sonuçları bulunamadı.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {correspondenceData.map((item) => (
                        <Card key={item.id} className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <h4 className="font-semibold">{item.short_desc}</h4>
                              <p className="text-sm text-muted-foreground">
                                Yazışma No: {item.letter_no} | Tarih: {new Date(item.letter_date).toLocaleDateString('tr-TR')} | {item.incout === 'incoming' ? 'Gelen' : 'Giden'}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Badge variant={item.severity_rate === '5' ? 'destructive' : item.severity_rate === '4' ? 'secondary' : 'default'}>
                                Önem: {item.severity_rate}
                              </Badge>
                              <Badge variant="outline">
                                {item.type_of_corr}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm mb-3 line-clamp-2">{item.content}</p>
                          {item.keywords && (
                            <p className="text-xs text-muted-foreground mb-3">Anahtar Kelimeler: {item.keywords}</p>
                          )}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAnalyze(item)}
                              disabled={isAnalyzing || !isConfigured}
                            >
                              {isAnalyzing ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Brain className="mr-2 h-3 w-3" />}
                              AI Analiz
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addToBasket(item)}
                              disabled={correspondenceBasket.some(b => b.id === item.id)}
                            >
                              <Plus className="mr-2 h-3 w-3" />
                              Sepete Ekle
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addAsReference(item)}
                              disabled={referenceDocuments.some(r => r.id === item.id)}
                            >
                              <FileText className="mr-2 h-3 w-3" />
                              Referans Ekle
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Basket and References Sidebar */}
            <div className="space-y-6">
              {/* Correspondence Basket */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Yazışma Sepeti
                    <Badge variant="secondary">{correspondenceBasket.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {correspondenceBasket.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Sepetiniz boş. Arama sonuçlarından yazışma ekleyin.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {correspondenceBasket.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.short_desc}</p>
                            <p className="text-xs text-muted-foreground">{item.letter_no}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setAsResponseTarget(item)}
                              title="Cevap yazılacak yazışma olarak ayarla"
                            >
                              <Reply className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeFromBasket(item.id)}
                              title="Sepetten çıkar"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedForResponse && (
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        Cevap Yazılacak: {selectedForResponse.short_desc}
                      </p>
                    </div>
                  )}
                  <Button
                    className="w-full mt-4"
                    onClick={generateDecisionReport}
                    disabled={correspondenceBasket.length === 0 || isAnalyzing || !isConfigured}
                  >
                    {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                    Karar Raporu Oluştur
                  </Button>
                </CardContent>
              </Card>

              {/* Reference Documents */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Referans Belgeler
                    <Badge variant="secondary">{referenceDocuments.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {referenceDocuments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Referans belgeniz yok. Arama sonuçlarından referans ekleyin.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {referenceDocuments.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.short_desc}</p>
                            <p className="text-xs text-muted-foreground">{item.letter_no}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeReference(item.id)}
                            title="Referanstan çıkar"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* AI Analysis Tab */}
        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI Analiz Sonuçları
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedCorrespondence ? (
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <h3 className="font-semibold mb-2">{selectedCorrespondence.short_desc}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {selectedCorrespondence.letter_no} | {new Date(selectedCorrespondence.letter_date).toLocaleDateString('tr-TR')} | {selectedCorrespondence.incout === 'incoming' ? 'Gelen' : 'Giden'}
                    </p>
                  </div>

                  {selectedCorrespondence.aiAnalysis ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">📝 Özet</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm">{selectedCorrespondence.aiAnalysis.summary}</p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">💡 Önerilen Aksiyonlar</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="text-sm space-y-1">
                            {selectedCorrespondence.aiAnalysis.action_suggestions.map((action, idx) => (
                              <li key={idx}>• {action}</li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">📊 Risk Analizi</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>Risk Seviyesi:</span>
                              <Badge variant={getRiskColor(selectedCorrespondence.aiAnalysis.risk_analysis.level)}>
                                {selectedCorrespondence.aiAnalysis.risk_analysis.level}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Risk Faktörleri: {selectedCorrespondence.aiAnalysis.risk_analysis.factors.join(', ')}
                            </p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">📋 Benzer Belgeler</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ul className="text-sm space-y-1">
                            {selectedCorrespondence.aiAnalysis.similar_docs.map((doc, idx) => (
                              <li key={idx}>• {doc}</li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Bu yazışma için henüz AI analiz yapılmamış.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Analiz etmek için bir yazışma seçin
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Hazır Şablonlar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-base">İzin Başvuru Şablonu</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Belediye ve ilgili kurumlara proje izin başvuruları için
                    </p>
                    <Button size="sm" className="w-full">
                      Kullan
                    </Button>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-base">Cevap Yazısı Şablonu</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Gelen yazışmalara verilen cevaplar için
                    </p>
                    <Button size="sm" className="w-full">
                      Kullan
                    </Button>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-base">İhtar Yazısı Şablonu</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Süreç hatırlatmaları ve ihtar yazıları için
                    </p>
                    <Button size="sm" className="w-full">
                      Kullan
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Toplam Yazışma</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{correspondenceData.length}</div>
                <p className="text-xs text-muted-foreground">Aktif yazışma</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Karar Bekleyen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {correspondenceData.filter(item => item.severity_rate >= '3').length}
                </div>
                <p className="text-xs text-muted-foreground">Eylem gerekli</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Yüksek Risk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {correspondenceData.filter(item => item.severity_rate === '5').length}
                </div>
                <p className="text-xs text-muted-foreground">Dikkat gerekli</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Tamamlanan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {correspondenceData.filter(item => item.reply_letter && item.reply_letter.trim() !== '').length}
                </div>
                <p className="text-xs text-muted-foreground">Bu ay</p>
              </CardContent>
            </Card>
          </div>

          {/* Decision Report Display */}
          {(() => {
            const report = localStorage.getItem('decisionSupportReport');
            if (report) {
              try {
                const reportData = JSON.parse(report);
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Oluşturulan Karar Raporu
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-semibold mb-2">Seçili Yazışmalar ({reportData.basketItems.length})</h4>
                          <ul className="text-sm space-y-1">
                            {reportData.basketItems.map((item: any, idx: number) => (
                              <li key={idx}>• {item.short_desc}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2">Referans Belgeler ({reportData.referenceDocuments.length})</h4>
                          <ul className="text-sm space-y-1">
                            {reportData.referenceDocuments.map((item: any, idx: number) => (
                              <li key={idx}>• {item.short_desc}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {reportData.targetCorrespondence && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded">
                          <p className="text-sm font-medium">
                            Cevap Yazılacak: {reportData.targetCorrespondence.short_desc}
                          </p>
                        </div>
                      )}

                      <div>
                        <h4 className="font-semibold mb-2">AI Önerileri</h4>
                        <ul className="text-sm space-y-1">
                          {reportData.recommendations.map((rec: string, idx: number) => (
                            <li key={idx}>• {rec}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          Raporu İndir
                        </Button>
                        <Button variant="outline" size="sm">
                          Raporu Yazdır
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              } catch (error) {
                return null;
              }
            }
            return null;
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DecisionSupportTemplate;
