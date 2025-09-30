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
import { Brain, Search, FileText, Plus, X, Loader2, Reply, AlertTriangle, FileDown, Printer, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';

import { useUserSettingsLegacy } from "../hooks/useUserSettings";
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

  // Tab and configuration states
  const [activeTab, setActiveTab] = useState('correspondence');
  const [isConfigured, setIsConfigured] = useState(false);
  const [useVectorSearch, setUseVectorSearch] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCorrespondence, setSelectedCorrespondence] = useState<CorrespondenceMetadata | null>(null);

  // Correspondence basket (sepet) states
  const [correspondenceBasket, setCorrespondenceBasket] = useState<CorrespondenceMetadata[]>([]);
  const [selectedForResponse, setSelectedForResponse] = useState<CorrespondenceMetadata | null>(null);
  const [referenceDocuments, setReferenceDocuments] = useState<CorrespondenceMetadata[]>([]);

  // AI Analysis states
  const [basketSummaries, setBasketSummaries] = useState<Array<{
    id: string;
    title: string;
    summary: string;
    keyPoints: string[];
    riskLevel: string;
  }>>([]);
  const [referenceSummaries, setReferenceSummaries] = useState<Array<{
    id: string;
    title: string;
    summary: string;
    keyPoints: string[];
    riskLevel: string;
  }>>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [isGeneratingSummaries, setIsGeneratingSummaries] = useState(false);

  // Selected documents analysis state
  const [selectedDocumentsAnalysis, setSelectedDocumentsAnalysis] = useState<{
    selectedDocuments: string[];
    basketItems: CorrespondenceMetadata[];
    referenceItems: CorrespondenceMetadata[];
    analysis: any;
    generatedAt: string;
  } | null>(null);

  // Response letter generation states
  const [isResponseLetterModalOpen, setIsResponseLetterModalOpen] = useState(false);
  const [isResponseLetterResultModalOpen, setIsResponseLetterResultModalOpen] = useState(false);
  const [responseLetterInstruction, setResponseLetterInstruction] = useState('');
  const [isGeneratingResponseLetter, setIsGeneratingResponseLetter] = useState(false);
  const [generatedResponseLetter, setGeneratedResponseLetter] = useState<{
    content: string;
    generatedAt: string;
    instruction: string;
  } | null>(null);

  // OpenAI connection status
  const [openaiConnectionStatus, setOpenaiConnectionStatus] = useState<{
    isConnected: boolean;
    isChecking: boolean;
    lastChecked: string | null;
    error: string | null;
  }>({
    isConnected: false,
    isChecking: false,
    lastChecked: null,
    error: null
  });

  const { settings, isLoading: settingsLoading } = useUserSettingsLegacy();
  const { configureServices } = useDocumentSearch();
  const { toast } = useToast();

  // Configure Supabase using global config
  useEffect(() => {
    if (settings?.supabase?.url && settings?.supabase?.anonKey) {
      try {
        configureServices({ supabase: settings.supabase });
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
  }, [settings, configureServices]);

  // AI analiz sekmesine geçtiğinde OpenAI bağlantısını otomatik kontrol et
  useEffect(() => {
    if (activeTab === 'analysis' && settings?.openai?.apiKey && !openaiConnectionStatus.isConnected && !openaiConnectionStatus.isChecking) {
      console.log('🔄 AI analiz sekmesine geçildi, OpenAI bağlantısı kontrol ediliyor...');
      checkOpenAIConnection();
    }
  }, [activeTab, settings?.openai?.apiKey]);

  // OpenAI bağlantısını kontrol eden fonksiyon
  const checkOpenAIConnection = async () => {
    if (!settings?.openai?.apiKey) {
      setOpenaiConnectionStatus({
        isConnected: false,
        isChecking: false,
        lastChecked: new Date().toISOString(),
        error: "OpenAI API key bulunamadı. Lütfen ayarlar bölümünden API key'inizi girin."
      });
      return;
    }

    setOpenaiConnectionStatus(prev => ({ ...prev, isChecking: true, error: null }));

    try {
      console.log('🔄 OpenAI bağlantısı test ediliyor...');
      const testResponse = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${settings.openai.apiKey}`
        }
      });

      if (!testResponse.ok) {
        const errorMsg = `OpenAI API bağlantı hatası: ${testResponse.status} ${testResponse.statusText}`;
        setOpenaiConnectionStatus({
          isConnected: false,
          isChecking: false,
          lastChecked: new Date().toISOString(),
          error: errorMsg
        });
        console.error('❌ OpenAI bağlantı testi başarısız:', errorMsg);
      } else {
        setOpenaiConnectionStatus({
          isConnected: true,
          isChecking: false,
          lastChecked: new Date().toISOString(),
          error: null
        });
        console.log('✅ OpenAI bağlantısı başarılı!');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
      setOpenaiConnectionStatus({
        isConnected: false,
        isChecking: false,
        lastChecked: new Date().toISOString(),
        error: `Bağlantı hatası: ${errorMsg}`
      });
      console.error('❌ OpenAI bağlantı testi hatası:', error);
    }
  };

  // Generate summaries when AI analysis tab is selected
  useEffect(() => {
    if (activeTab === 'analysis' && isConfigured) {
      generateAllSummaries();
    }
  }, [activeTab, correspondenceBasket, referenceDocuments, isConfigured]);

  // Generate AI summaries for basket and reference documents
  const generateAllSummaries = async () => {
    if (!isConfigured || (correspondenceBasket.length === 0 && referenceDocuments.length === 0)) {
      return;
    }

    setIsGeneratingSummaries(true);
    try {
      // Sepet belgelerinin özetlerini oluştur
      if (correspondenceBasket.length > 0) {
        const basketResults = await decisionSupportService.generateBasketSummaries(correspondenceBasket);
        setBasketSummaries(basketResults);
      }

      // Referans belgelerinin özetlerini oluştur
      if (referenceDocuments.length > 0) {
        const referenceResults = await decisionSupportService.generateBasketSummaries(referenceDocuments);
        setReferenceSummaries(referenceResults);
      }

      toast({
        title: "AI Özetler Hazır",
        description: `${correspondenceBasket.length + referenceDocuments.length} belge için AI özetleri oluşturuldu.`,
      });
    } catch (error) {
      console.error('Summary generation error:', error);
      toast({
        title: "Özet Oluşturma Hatası",
        description: "AI özetleri oluşturulurken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingSummaries(false);
    }
  };

  // Generate summaries when AI analysis tab is selected
  useEffect(() => {
    if (activeTab === 'analysis' && isConfigured) {
      generateAllSummaries();
    }
  }, [activeTab, correspondenceBasket, referenceDocuments, isConfigured]);

  // Handle single document analysis
  const handleAnalyze = async (correspondence: CorrespondenceMetadata) => {
    if (!isConfigured) {
      toast({
        title: "Konfigürasyon Gerekli",
        description: "AI analiz için gerekli konfigürasyonlar eksik.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const analysis = await decisionSupportService.analyzeCorrespondence(correspondence.content);
      
      // Update the correspondence with analysis results
      const updatedCorrespondence = { ...correspondence, aiAnalysis: analysis };
      
      // Update in correspondenceData if it exists there
      setCorrespondenceData(prev => prev.map(item => 
        item.id === correspondence.id ? updatedCorrespondence : item
      ));

      // Update in basket if it exists there
      setCorrespondenceBasket(prev => prev.map(item => 
        item.id === correspondence.id ? updatedCorrespondence : item
      ));

      // Update in reference documents if it exists there
      setReferenceDocuments(prev => prev.map(item => 
        item.id === correspondence.id ? updatedCorrespondence : item
      ));

      toast({
        title: "AI Analiz Tamamlandı",
        description: `"${correspondence.short_desc}" için AI analiz hazır.`,
      });
    } catch (error) {
      console.error('Single document analysis error:', error);
      toast({
        title: "Analiz Hatası",
        description: "AI analiz sırasında bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

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

  // Handle document selection
  const toggleDocumentSelection = (documentId: string) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(documentId)) {
        newSet.delete(documentId);
      } else {
        newSet.add(documentId);
      }
      return newSet;
    });
  };

  const selectAllDocuments = () => {
    const allIds = [...basketSummaries, ...referenceSummaries].map(doc => doc.id);
    setSelectedDocuments(new Set(allIds));
  };

  const clearSelection = () => {
    setSelectedDocuments(new Set());
  };

  // Process selected documents
  const processSelectedDocuments = async () => {
    if (selectedDocuments.size === 0) {
      toast({
        title: "Belge Seçilmedi",
        description: "İşlem yapmak için en az bir belge seçin.",
        variant: "destructive",
      });
      return;
    }

    const selectedBasketItems = correspondenceBasket.filter(item => selectedDocuments.has(item.id));
    const selectedReferenceItems = referenceDocuments.filter(item => selectedDocuments.has(item.id));

    if (selectedBasketItems.length === 0 && selectedReferenceItems.length === 0) {
      toast({
        title: "Geçersiz Seçim",
        description: "Seçili belgeler bulunamadı.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setOpenaiConnectionStatus({ isConnected: false, isChecking: true, lastChecked: null, error: null });

    try {
      // Kullanıcı ayarlarından OpenAI API key'ini al
      const openaiApiKey = settings?.openai?.apiKey;

      if (!openaiApiKey || !openaiApiKey.trim()) {
        setOpenaiConnectionStatus({
          isConnected: false,
          isChecking: false,
          lastChecked: new Date().toISOString(),
          error: "OpenAI API key bulunamadı. Lütfen ayarlar bölümünden API key'inizi girin."
        });
        toast({
          title: "API Key Gerekli",
          description: "Belge analizi için OpenAI API key gerekli.",
          variant: "destructive",
        });
        setIsAnalyzing(false);
        return;
      }

      // OpenAI bağlantısını test et
      console.log('🔄 OpenAI bağlantısı test ediliyor...');
      const testResponse = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`
        }
      });

      if (!testResponse.ok) {
        const errorMsg = `OpenAI API bağlantı hatası: ${testResponse.status} ${testResponse.statusText}`;
        setOpenaiConnectionStatus({
          isConnected: false,
          isChecking: false,
          lastChecked: new Date().toISOString(),
          error: errorMsg
        });
        console.error('❌ OpenAI bağlantı testi başarısız:', errorMsg);
        toast({
          title: "OpenAI Bağlantı Hatası",
          description: "API key'inizi kontrol edin.",
          variant: "destructive",
        });
        setIsAnalyzing(false);
        return;
      }

      setOpenaiConnectionStatus({
        isConnected: true,
        isChecking: false,
        lastChecked: new Date().toISOString(),
        error: null
      });
      console.log('✅ OpenAI bağlantısı başarılı!');

      // Tüm seçili belgelerin içeriğini birleştir
      const allSelectedDocuments = [...selectedBasketItems, ...selectedReferenceItems];
      const combinedContent = allSelectedDocuments.map(item =>
        `BELGE: ${item.short_desc}\nTÜR: ${item.incout === 'incoming' ? 'Gelen Yazışma' : 'Giden Yazışma'}\nTARİH: ${new Date(item.letter_date).toLocaleDateString('tr-TR')}\nİÇERİK:\n${item.content}`
      ).join('\n\n---\n\n');

      // Detaylı analiz için kapsamlı prompt oluştur
      const analysisPrompt = `
Aşağıdaki seçili belgeleri kapsamlı bir şekilde analiz et. Analiz raporun 200-300 kelime arasında olmalı ve aşağıdaki unsurları içermeli:

BELGELER:
${combinedContent}

ANALİZ TALİMATLARI:
1. **Genel Özet**: Belgelerin genel konusunu ve amacını özetle (50-70 kelime)
2. **İlişkiler ve Bağlantılar**: Belgeler arasındaki ilişkileri, referansları ve bağlantıları belirle. Mantıksız veya tutarsız referansları temizle ve gerçek ilişkileri vurgula.
3. **Risk Analizi**: Potansiyel riskleri, önem derecelerini ve aciliyet faktörlerini değerlendir (50-70 kelime)
4. **Duygu ve Ton Analizi**: Belgelerin genel duygu durumunu ve iletişim tonunu analiz et
5. **Önerilen Aksiyonlar**: Yapılması gereken somut adımları ve önerileri listele (50-70 kelime)
6. **Zaman Çizelgesi**: Önemli tarihler, süreler ve zamanlamalar varsa belirt

ANALİZ FORMATI:
- Türkçe yaz
- Profesyonel ve nesnel dil kullan
- Somut bulgulara dayalı ol
- Önerileri uygulanabilir şekilde belirt
- Risk seviyelerini (Düşük/Orta/Yüksek) belirt

Lütfen JSON formatında yanıt ver:
{
  "summary": "Genel özet metni",
  "relationships": "Belgeler arası ilişkiler analizi",
  "risk_analysis": {
    "level": "Düşük|Orta|Yüksek",
    "factors": ["risk faktörü 1", "risk faktörü 2"],
    "description": "Risk analizi açıklaması"
  },
  "sentiment_analysis": {
    "overall": "Pozitif|Nötr|Negatif",
    "score": 0-100,
    "description": "Duygu analizi açıklaması"
  },
  "action_suggestions": ["aksiyon 1", "aksiyon 2", "aksiyon 3"],
  "timeline": "Zaman çizelgesi ve önemli tarihler"
}
      `;

      console.log('🔄 OpenAI ile detaylı analiz başlatılıyor...');
      const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Sen deneyimli bir kamu yönetimi uzmanısın. Yazışma belgelerini analiz eder, ilişkileri belirler ve karar destek önerileri sunarsun. Türkçe yanıt verirsin ve detaylı, kapsamlı analizler yaparsın.'
            },
            {
              role: 'user',
              content: analysisPrompt
            }
          ],
          temperature: 0.3,
          max_tokens: 4000
        })
      });

      if (!analysisResponse.ok) {
        throw new Error(`OpenAI API error: ${analysisResponse.status} ${analysisResponse.statusText}`);
      }

      const analysisData = await analysisResponse.json();
      const aiResponse = analysisData.choices[0]?.message?.content;

      if (!aiResponse) {
        throw new Error('OpenAI API boş yanıt döndürdü');
      }

      console.log('✅ OpenAI analizi tamamlandı, JSON parse ediliyor...');

      // JSON parse et ve validate et
      let parsedAnalysis;
      try {
        parsedAnalysis = JSON.parse(aiResponse);
      } catch (parseError) {
        console.error('JSON parse hatası:', parseError);
        console.log('AI yanıtı:', aiResponse);
        throw new Error('AI yanıtı geçerli JSON formatında değil');
      }

      // Analiz sonuçlarını state'te sakla
      const analysisResult = {
        selectedDocuments: Array.from(selectedDocuments),
        basketItems: selectedBasketItems,
        referenceItems: selectedReferenceItems,
        analysis: parsedAnalysis,
        generatedAt: new Date().toISOString()
      };

      setSelectedDocumentsAnalysis(analysisResult);

      // localStorage'a da kaydet (şimdilik)
      localStorage.setItem('selectedDocumentsAnalysis', JSON.stringify(analysisResult));

      console.log('✅ Belge analizi başarıyla tamamlandı!');
      console.log('📊 Analiz özeti:', parsedAnalysis.summary?.substring(0, 100) + '...');

      toast({
        title: "Analiz Tamamlandı",
        description: `${selectedDocuments.size} seçili belge için kapsamlı OpenAI analizi hazır.`,
      });

    } catch (error) {
      console.error('❌ Seçili belgeler analizi hatası:', error);
      setOpenaiConnectionStatus({
        isConnected: false,
        isChecking: false,
        lastChecked: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Bilinmeyen hata'
      });

      toast({
        title: "Analiz Hatası",
        description: "Seçili belgeler analiz edilirken bir hata oluştu. API key'ini kontrol edin.",
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

  // Generate response letter based on analysis and user instruction
  const generateResponseLetter = async () => {
    if (!selectedDocumentsAnalysis || !responseLetterInstruction.trim()) {
      toast({
        title: "Eksik Bilgi",
        description: "Analiz ve talimat gerekli.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingResponseLetter(true);
    try {
      // Kullanıcı ayarlarından OpenAI API key'ini al
      const openaiApiKey = settings?.openai?.apiKey;

      if (!openaiApiKey || !openaiApiKey.trim()) {
        toast({
          title: "API Key Gerekli",
          description: "Cevap yazısı oluşturmak için OpenAI API key gerekli.",
          variant: "destructive",
        });
        setIsGeneratingResponseLetter(false);
        return;
      }

      // Tüm ilgili belgelerin içeriğini birleştir
      const allDocuments = [...selectedDocumentsAnalysis.basketItems, ...selectedDocumentsAnalysis.referenceItems];
      const allContent = allDocuments.map(item =>
        `Belge: ${item.short_desc}\nİçerik: ${item.content}`
      ).join('\n\n---\n\n');

      // OpenAI API ile cevap yazısı oluştur
      const responsePrompt = `
Aşağıdaki analiz ve belgeler temel alınarak, kullanıcının isteğine göre resmi bir cevap yazısı oluştur:

KULLANICI TALİMATI: ${responseLetterInstruction}

ANALİZ SONUCU: ${JSON.stringify(selectedDocumentsAnalysis.analysis, null, 2)}

İLGİLİ BELGELER:
${allContent}

TALİMATLAR:
1. Resmi ve profesyonel bir yazı dili kullan
2. Kullanıcının talimatına uygun içerik oluştur
3. Yazışma referanslarını dahil et
4. Uygun resmi başlık ve kapanış kullan
5. Türkçe yaz
6. Detaylı ve kapsamlı ol

Lütfen sadece cevap yazısının içeriğini döndür, başka açıklama ekleme.
      `;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Sen deneyimli bir kamu yönetimi uzmanısın. Analiz ve belgeler temel alınarak resmi cevap yazıları oluşturursun. Türkçe, resmi ve profesyonel yazarsın.'
            },
            {
              role: 'user',
              content: responsePrompt
            }
          ],
          temperature: 0.4,
          max_tokens: 3000
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const aiResponse = data.choices[0]?.message?.content;

      if (!aiResponse) {
        throw new Error('OpenAI API boş yanıt döndürdü');
      }

      const responseLetter = {
        content: aiResponse.trim(),
        generatedAt: new Date().toISOString(),
        instruction: responseLetterInstruction
      };

      setGeneratedResponseLetter(responseLetter);
      setIsResponseLetterModalOpen(false); // İlk modal'ı kapat
      setIsResponseLetterResultModalOpen(true); // Sonuç modal'ını aç

      toast({
        title: "Cevap Yazısı Hazır",
        description: "AI tarafından oluşturulan cevap yazısı hazır.",
      });

    } catch (error) {
      console.error('Response letter generation error:', error);
      toast({
        title: "Cevap Yazısı Hatası",
        description: "Cevap yazısı oluşturulurken bir hata oluştu. API key'ini kontrol edin.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingResponseLetter(false);
    }
  };  // Export response letter as PDF
  const exportAsPDF = () => {
    if (!generatedResponseLetter) return;

    // Basit PDF export (şimdilik print kullanarak)
    const printContent = `
      <html>
        <head>
          <title>Cevap Yazısı</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; margin-bottom: 30px; }
            .content { line-height: 1.6; }
            .footer { margin-top: 50px; text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>CEVAP YAZISI</h2>
            <p>Oluşturulma Tarihi: ${new Date(generatedResponseLetter.generatedAt).toLocaleDateString('tr-TR')}</p>
          </div>
          <div class="content">
            ${generatedResponseLetter.content.replace(/\n/g, '<br>')}
          </div>
          <div class="footer">
            <p>Sayın Yetkili</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Export response letter as Word (basit text dosyası olarak)
  const exportAsWord = () => {
    if (!generatedResponseLetter) return;

    const content = `CEVAP YAZISI

Oluşturulma Tarihi: ${new Date(generatedResponseLetter.generatedAt).toLocaleDateString('tr-TR')}

${generatedResponseLetter.content}

Saygılarımla,
Yetkili
    `;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cevap-yazisi-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
          {/* OpenAI Connection Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  openaiConnectionStatus.isConnected ? 'bg-green-500' :
                  openaiConnectionStatus.isChecking ? 'bg-yellow-500 animate-pulse' :
                  openaiConnectionStatus.error ? 'bg-red-500' : 'bg-gray-400'
                }`} />
                OpenAI API Bağlantı Durumu
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">
                    {openaiConnectionStatus.isChecking ? 'Bağlantı kontrol ediliyor...' :
                     openaiConnectionStatus.isConnected ? '✅ Bağlantı başarılı' :
                     openaiConnectionStatus.error ? '❌ Bağlantı hatası' : '⏳ Bağlantı kontrol edilmedi'}
                  </span>
                  {openaiConnectionStatus.lastChecked && (
                    <span className="text-xs text-muted-foreground">
                      Son kontrol: {new Date(openaiConnectionStatus.lastChecked).toLocaleTimeString('tr-TR')}
                    </span>
                  )}
                </div>
                {openaiConnectionStatus.error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {openaiConnectionStatus.error}
                    </AlertDescription>
                  </Alert>
                )}
                {openaiConnectionStatus.isConnected && (
                  <div className="text-xs text-green-600 dark:text-green-400">
                    ✓ Gerçek OpenAI API (gpt-4o-mini) kullanılıyor - Mock veri kullanılmıyor
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          {/* Control Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI Analiz Paneli
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={selectAllDocuments}
                    disabled={basketSummaries.length === 0 && referenceSummaries.length === 0}
                  >
                    Tümünü Seç
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={clearSelection}
                    disabled={selectedDocuments.size === 0}
                  >
                    Seçimi Temizle
                  </Button>
                  <Button
                    size="sm"
                    onClick={processSelectedDocuments}
                    disabled={selectedDocuments.size === 0 || isAnalyzing}
                  >
                    {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Seçili Belgeleri İşle ({selectedDocuments.size})
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Sepetinizde {correspondenceBasket.length} yazışma, referanslarınızda {referenceDocuments.length} belge bulunmaktadır.
                {isGeneratingSummaries && " AI özetleri hazırlanıyor..."}
              </div>
            </CardContent>
          </Card>

          {/* Basket Documents Analysis */}
          {basketSummaries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🛒 Sepet Belgeleri ({basketSummaries.length})
                  {selectedForResponse && (
                    <Badge variant="secondary" className="ml-2">
                      Cevap: {selectedForResponse.short_desc}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {basketSummaries.map((summary) => (
                    <div key={summary.id} className="grid grid-cols-12 gap-4 p-4 border rounded-lg hover:bg-muted/50">
                      {/* Checkbox Column */}
                      <div className="col-span-1 flex items-center">
                        <Checkbox
                          checked={selectedDocuments.has(summary.id)}
                          onCheckedChange={() => toggleDocumentSelection(summary.id)}
                        />
                      </div>

                      {/* Document Title Column */}
                      <div className="col-span-4">
                        <h4 className="font-semibold text-sm mb-1">{summary.title}</h4>
                        <Badge
                          variant={summary.riskLevel === 'Yüksek' ? 'destructive' :
                                 summary.riskLevel === 'Orta' ? 'secondary' : 'default'}
                          className="text-xs"
                        >
                          Risk: {summary.riskLevel}
                        </Badge>
                      </div>

                      {/* AI Summary Column */}
                      <div className="col-span-6">
                        <p className="text-sm text-muted-foreground mb-2">{summary.summary}</p>
                        <div className="text-xs">
                          <strong>Ana Noktalar:</strong>
                          <ul className="list-disc list-inside mt-1 space-y-1">
                            {summary.keyPoints.map((point, idx) => (
                              <li key={idx}>{point}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Action Column */}
                      <div className="col-span-1 flex items-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const doc = correspondenceBasket.find(d => d.id === summary.id);
                            if (doc) setSelectedCorrespondence(doc);
                          }}
                          title="Detaylı analiz"
                        >
                          <Brain className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reference Documents Analysis */}
          {referenceSummaries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📄 Referans Belgeler ({referenceSummaries.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {referenceSummaries.map((summary) => (
                    <div key={summary.id} className="grid grid-cols-12 gap-4 p-4 border rounded-lg hover:bg-muted/50">
                      {/* Checkbox Column */}
                      <div className="col-span-1 flex items-center">
                        <Checkbox
                          checked={selectedDocuments.has(summary.id)}
                          onCheckedChange={() => toggleDocumentSelection(summary.id)}
                        />
                      </div>

                      {/* Document Title Column */}
                      <div className="col-span-4">
                        <h4 className="font-semibold text-sm mb-1">{summary.title}</h4>
                        <Badge
                          variant={summary.riskLevel === 'Yüksek' ? 'destructive' :
                                 summary.riskLevel === 'Orta' ? 'secondary' : 'default'}
                          className="text-xs"
                        >
                          Risk: {summary.riskLevel}
                        </Badge>
                      </div>

                      {/* AI Summary Column */}
                      <div className="col-span-6">
                        <p className="text-sm text-muted-foreground mb-2">{summary.summary}</p>
                        <div className="text-xs">
                          <strong>Ana Noktalar:</strong>
                          <ul className="list-disc list-inside mt-1 space-y-1">
                            {summary.keyPoints.map((point, idx) => (
                              <li key={idx}>{point}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Action Column */}
                      <div className="col-span-1 flex items-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const doc = referenceDocuments.find(d => d.id === summary.id);
                            if (doc) setSelectedCorrespondence(doc);
                          }}
                          title="Detaylı analiz"
                        >
                          <Brain className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No Documents Message */}
          {basketSummaries.length === 0 && referenceSummaries.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">AI Analiz İçin Belge Yok</h3>
                <p className="text-muted-foreground mb-4">
                  AI analiz yapmak için önce yazışmaları sepetinize veya referanslarınıza ekleyin.
                </p>
                <Button onClick={() => setActiveTab('correspondence')}>
                  Yazışmalara Git
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Selected Documents Analysis Report */}
          {selectedDocumentsAnalysis && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Seçili Belgeler Kapsamlı Analizi
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={isResponseLetterModalOpen} onOpenChange={(open) => {
                      setIsResponseLetterModalOpen(open);
                      if (!open) {
                        setResponseLetterInstruction('');
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button onClick={() => setIsResponseLetterModalOpen(true)}>
                          <FileText className="mr-2 h-4 w-4" />
                          Cevap Yazısı Oluştur
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Cevap Yazısı Oluştur</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="responseInstruction">Nasıl bir cevap yazısı oluşturulsun?</Label>
                            <Textarea
                              id="responseInstruction"
                              placeholder="Örneğin: İdareye gerekçeleri ile birlikte süre uzatımı istiyorum..."
                              value={responseLetterInstruction}
                              onChange={(e) => setResponseLetterInstruction(e.target.value)}
                              rows={4}
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              onClick={() => setIsResponseLetterModalOpen(false)}
                            >
                              İptal
                            </Button>
                            <Button
                              onClick={generateResponseLetter}
                              disabled={isGeneratingResponseLetter || !responseLetterInstruction.trim()}
                            >
                              {isGeneratingResponseLetter ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <FileText className="mr-2 h-4 w-4" />
                              )}
                              Oluştur
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Response Letter Result Modal */}
                    <Dialog open={isResponseLetterResultModalOpen} onOpenChange={setIsResponseLetterResultModalOpen}>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Oluşturulan Cevap Yazısı
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6">
                          {generatedResponseLetter && (
                            <>
                              <div className="p-4 border rounded-lg bg-muted/50">
                                <h4 className="font-semibold mb-2">Talimatınız:</h4>
                                <p className="text-sm text-muted-foreground italic">
                                  "{generatedResponseLetter.instruction}"
                                </p>
                              </div>

                              <div className="p-4 border rounded-lg">
                                <h4 className="font-semibold mb-4">Cevap Yazısı İçeriği:</h4>
                                <div className="whitespace-pre-wrap text-sm leading-relaxed bg-white p-4 rounded border min-h-[300px]">
                                  {generatedResponseLetter.content}
                                </div>
                              </div>

                              <div className="flex gap-2 justify-between items-center pt-4 border-t">
                                <div className="text-xs text-muted-foreground">
                                  Oluşturulma Tarihi: {new Date(generatedResponseLetter.generatedAt).toLocaleString('tr-TR')}
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={exportAsPDF}
                                  >
                                    <Printer className="mr-2 h-4 w-4" />
                                    PDF Yazdır
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={exportAsWord}
                                  >
                                    <Download className="mr-2 h-4 w-4" />
                                    Word İndir
                                  </Button>
                                  <Button
                                    onClick={() => setIsResponseLetterResultModalOpen(false)}
                                  >
                                    Kapat
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Analysis Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Analiz Özeti</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedDocumentsAnalysis.analysis.summary}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Risk Analizi</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Risk Seviyesi:</span>
                        <Badge variant={selectedDocumentsAnalysis.analysis.risk_analysis.level === 'Yüksek' ? 'destructive' :
                                       selectedDocumentsAnalysis.analysis.risk_analysis.level === 'Orta' ? 'secondary' : 'default'}>
                          {selectedDocumentsAnalysis.analysis.risk_analysis.level}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Risk Faktörleri: {selectedDocumentsAnalysis.analysis.risk_analysis.factors.join(', ')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Suggestions */}
                <div>
                  <h4 className="font-semibold mb-2">Önerilen Aksiyonlar</h4>
                  <ul className="text-sm space-y-1">
                    {selectedDocumentsAnalysis.analysis.action_suggestions.map((action, idx) => (
                      <li key={idx}>• {action}</li>
                    ))}
                  </ul>
                </div>

                {/* Sentiment Analysis */}
                <div>
                  <h4 className="font-semibold mb-2">Duygu Analizi</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedDocumentsAnalysis.analysis.sentiment_analysis.overall === 'Pozitif' ? 'default' :
                                   selectedDocumentsAnalysis.analysis.sentiment_analysis.overall === 'Negatif' ? 'destructive' : 'secondary'}>
                      {selectedDocumentsAnalysis.analysis.sentiment_analysis.overall}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Skor: {selectedDocumentsAnalysis.analysis.sentiment_analysis.score}/100
                    </span>
                  </div>
                </div>

                {/* Analyzed Documents */}
                <div>
                  <h4 className="font-semibold mb-2">Analiz Edilen Belgeler ({selectedDocumentsAnalysis.basketItems.length + selectedDocumentsAnalysis.referenceItems.length})</h4>
                  <div className="space-y-2">
                    {[...selectedDocumentsAnalysis.basketItems, ...selectedDocumentsAnalysis.referenceItems].map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.short_desc}</p>
                          <p className="text-xs text-muted-foreground">{doc.letter_no}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {doc.incout === 'incoming' ? 'Gelen' : 'Giden'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground text-center pt-4 border-t">
                  Analiz Tarihi: {new Date(selectedDocumentsAnalysis.generatedAt).toLocaleString('tr-TR')}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generated Response Letter */}
          {generatedResponseLetter && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Oluşturulan Cevap Yazısı
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={exportAsPDF}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      PDF Yazdır
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={exportAsWord}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Word İndir
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <h4 className="font-semibold mb-2">Talimatınız:</h4>
                    <p className="text-sm text-muted-foreground italic">
                      "{generatedResponseLetter.instruction}"
                    </p>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-semibold mb-4">Cevap Yazısı İçeriği:</h4>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {generatedResponseLetter.content}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground text-center pt-4 border-t">
                    Oluşturulma Tarihi: {new Date(generatedResponseLetter.generatedAt).toLocaleString('tr-TR')}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
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
