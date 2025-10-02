import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import { Separator } from '../components/ui/separator';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { 
  Search, 
  Database, 
  Network, 
  Brain, 
  FileText, 
  Filter,
  Settings,
  RefreshCw,
  Download,
  Eye,
  Clock,
  Tag,
  Folder,
  HardDrive,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  BarChart3,
  Users,
  Link,
  FileIcon,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  User
} from 'lucide-react';
import { useDocumentSearch } from '../hooks/useDocumentSearch';
import { useAuth } from '../hooks/useAuth';
import { useUserSettingsLegacy } from '../hooks/useUserSettings';
import ConfigManagement from '../components/ConfigManagement';
import ConfigSettings from '../components/settings/ConfigSettings';
import { performSecurityCheck } from '../utils/security';
import { UserSettings } from '../services/supabase';

// Debug Panel kontrolü - sadece development'da ve gerektiğinde açın
const SHOW_DEBUG_PANEL = process.env.NODE_ENV === 'development';

export default function DocumentSearchPage() {
  const {
    // State
    isLoading,
    supabaseResults,
    searchDecision,
    queryEnhancement,
    searchMethod,
    aiAnalysis,
    error,
    lastQuery,
    stats,
    connectionState,
    availableOptions,
    
    // Actions
    configureServices,
    testConnections,
    loadInitialData,
    search,
    vectorSearch,
    advancedSearch,
    findSimilarDocuments,
    clearResults,
    
    // Computed
    isAnyDatabaseConnected,
    totalResults,
    hasResults
  } = useDocumentSearch();

  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('search');
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Initialize enableAI from localStorage, default to true if not set
  const [enableAI, setEnableAI] = useState(() => {
    const stored = localStorage.getItem('doc_search_enable_ai');
    return stored !== null ? stored === 'true' : true;
  });
  
  // Kullanıcı ayarları hook'u
  const { user } = useAuth();
  const { 
    settings, 
    isLoading: settingsLoading, 
    saveUserSettings
  } = useUserSettingsLegacy();

  // Some older code referenced settingsError; provide a safe local var
  const settingsError = (settings as any)?._error || null;
  
  // Filters
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    type_of_corr: '',
    severity_rate: '',
    inc_out: '',
    keywords: [] as string[],
    internal_no: ''
  });

  // Database configs
  const [configs, setConfigs] = useState({
    supabase: { url: settings?.supabase?.url || '', anonKey: settings?.supabase?.anonKey || '' },
    deepseek: { apiKey: settings?.deepseek?.apiKey || '' },
    openai: { apiKey: settings?.openai?.apiKey || '' }
  });

  // Önceki config'leri takip etmek için ref
  const prevConfigsRef = useRef(configs);
  // Auto-save-on-login guard to ensure we run save only once per session/login
  const autoSaveOnLoginRef = useRef(false);
  // No longer need initialEnableAIAppliedRef since we use localStorage now

  // Sayfa yüklendiğinde güvenlik kontrolü
  useEffect(() => {
    performSecurityCheck();
  }, []);

  // Handle settings changes (removed enableAI sync since it's local-only now)
  useEffect(() => {
    if (settings && !settingsLoading) {
      
      // Yeni configs'i oluştur
      const newConfigs = {
        supabase: { 
          url: settings.supabase?.url || '', 
          anonKey: settings.supabase?.anonKey || '' 
        },
        deepseek: { 
          apiKey: settings.deepseek?.apiKey || '' 
        },
        openai: {
          apiKey: settings.openai?.apiKey || ''
        }
      };
      
      // Config'ler gerçekten değişti mi kontrol et (önceki config ile karşılaştır)
      const configsChanged = (
        prevConfigsRef.current.supabase.url !== newConfigs.supabase.url ||
        prevConfigsRef.current.supabase.anonKey !== newConfigs.supabase.anonKey ||
        prevConfigsRef.current.deepseek.apiKey !== newConfigs.deepseek.apiKey ||
        prevConfigsRef.current.openai.apiKey !== newConfigs.openai.apiKey
      );
      
      if (configsChanged) {
        console.log('🔄 Config değişikliği tespit edildi, servisleri yeniden konfigüre ediliyor...');
        setConfigs(newConfigs);
        prevConfigsRef.current = newConfigs; // Ref'i güncelle
        
        // Ayarlar tam ise servisleri otomatik konfigüre et
        if (settings.supabase?.url && settings.supabase?.anonKey) {
          try {
            configureServices(newConfigs);
            console.log('✅ Servisler başarıyla konfigüre edildi');
          } catch (error) {
            console.error('❌ Otomatik servis konfigürasyonu başarısız:', error);
          }
        }
      } else {
        console.log('ℹ️ Config değişikliği yok, servis konfigürasyonu atlandı');
        // If configs didn't change but services are not connected yet (first login),
        // force a one-time configure + test so the UI applies the Firestore-provided settings.
        // This avoids the kısır döngü where the checkbox toggle or other UI tries to save
        // before an initial connection is established.
        if (!isAnyDatabaseConnected) {
          console.log('⚙️ Servisler bağlı değil; bir kerelik otomatik konfigürasyon ve test çalıştırılıyor');
          // avoid blocking the effect
          (async () => {
            try {
              // ensure local configs state matches settings
              setConfigs(newConfigs);
              prevConfigsRef.current = newConfigs;
              // call configureServices (wrapped in hook to init once)
              try {
                configureServices(newConfigs);
              } catch (err) {
                console.warn('Otomatik konfigürasyon hatası (ignore):', err);
              }
              // run connection tests (hook has cooldown/guards)
              try {
                await testConnections();
              } catch (err) {
                console.warn('Otomatik bağlantı testi hatası (ignore):', err);
              }
              // After initial configure + test, trigger the same action as the
              // "Kaydet ve Senkronize Et" button once (save settings & sync)
              try {
                if (!autoSaveOnLoginRef.current) {
                  autoSaveOnLoginRef.current = true;
                  console.log('🔔 Otomatik olarak "Kaydet ve Senkronize Et" tetikleniyor');
                  // call default: persistEnableAI = true (button behavior)
                  await handleConfigSave();
                }
              } catch (saveErr) {
                console.warn('Otomatik kaydet/senkronize başarısız (ignore):', saveErr);
              }
            } catch (e) {
              console.error('Otomatik konfigürasyon sırasında hata:', e);
            }
          })();
        }
      }
    }
  }, [settings, settingsLoading]);

  // Handle AI toggle (purely local now, no syncing with remote settings)
  const handleAIToggle = (checked: boolean) => {
    setEnableAI(checked);
    localStorage.setItem('doc_search_enable_ai', checked.toString());
  };

  // Refresh stats and options when Supabase connects
  useEffect(() => {
    if (connectionState.supabase === 'connected') {
      loadInitialData();
    }
  }, [connectionState.supabase]);

  // Auto-load configs from window.__APP_CONFIG__ (only once)
  useEffect(() => {
    const loadConfigsFromWindow = () => {
      const appConfig = (window as any).__APP_CONFIG__;
      if (appConfig) {
        const newConfigs = {
          neo4j: { uri: '', username: '', password: '' },
          supabase: { 
            url: appConfig.SUPABASE_URL || '', 
            anonKey: appConfig.SUPABASE_ANON_KEY || '' 
          },
          deepseek: { 
            apiKey: appConfig.DEEPSEEK_API_KEY || '' 
          },
          openai: {
            apiKey: appConfig.OPENAI_API_KEY || ''
          }
        };
        
        // Only set configs if they are currently empty (don't override user input)
        setConfigs(prevConfigs => {
          // If user has already entered data, don't override
          if (prevConfigs.supabase.url || prevConfigs.supabase.anonKey || 
              prevConfigs.deepseek.apiKey || prevConfigs.openai.apiKey) {
            return prevConfigs;
          }
          return newConfigs;
        });
        
        // Auto-configure services if we have the data and configs are empty
        if (newConfigs.supabase.url && newConfigs.supabase.anonKey && !configs.supabase.url) {
          configureServices(newConfigs);
          // Otomatik test kaldırıldı - manuel test için buton kullanın
        }
      }
    };

    // Load immediately if available, or wait for window load (only once)
    if ((window as any).__APP_CONFIG__) {
      loadConfigsFromWindow();
    } else {
      window.addEventListener('load', loadConfigsFromWindow);
      return () => window.removeEventListener('load', loadConfigsFromWindow);
    }
  }, []); // Empty dependency array - run only once

  // Handle config save
  // handleConfigSave optionally accepts opts.persistEnableAI (default true).
  // If persistEnableAI is false, the current enableAI value will not be written to Firestore.
  const handleConfigSave = async (opts?: { persistEnableAI?: boolean }) => {
    try {
      // Yeni ayarları oluştur
      const persistEnable = opts?.persistEnableAI !== false;
      const newSettings: UserSettings = {
        supabase: configs.supabase,
        deepseek: configs.deepseek,
        openai: configs.openai,
        // Remove enableAI from settings since it's local-only now
        vectorThreshold: 0.3,
        vectorWeight: 0.3,
        textWeight: 0.7,
        textScoreMethod: 'overlap'
      };

      // Ayarları kaydet (hem Supabase'e hem localStorage'a)
      await saveUserSettings(newSettings);
      
      // Servisleri konfigüre et
      configureServices(configs);
      await testConnections();
      setShowSettings(false);
      
      console.log('💾 Ayarlar kaydedildi ve test edildi');
    } catch (error) {
      console.error('Ayarlar kaydedilemedi:', error);
    }
  };

  // Connection status icon
  const getConnectionIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'testing': return <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  // Handle search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    console.log('🔍 Arama başlatılıyor...');
    console.log('Sorgu:', searchQuery);
    console.log('AI Destekli:', enableAI);
    console.log('Bağlantı durumları:', connectionState);
    console.log('Configs:', configs);
    
    const searchFilters = {
      ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
      ...(filters.dateTo && { dateTo: filters.dateTo }),
      ...(filters.type_of_corr && { type_of_corr: filters.type_of_corr }),
      ...(filters.severity_rate && { severity_rate: filters.severity_rate }),
      ...(filters.inc_out && { inc_out: filters.inc_out }),
      ...(filters.keywords?.length && { keywords: filters.keywords }),
      ...(filters.internal_no && { internal_no: filters.internal_no })
    };
    
    try {
      await search(searchQuery, searchFilters, enableAI);
    } catch (error) {
      console.error('Arama hatası:', error);
    }
  };


  // Format date
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Date belirtilmemiş';
    return new Date(dateString).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get document title (short_desc veya letter_no)
  const getDocumentTitle = (doc: any): string => {
    return doc.short_desc || doc.letter_no || doc.internal_no || `Belge #${doc.id}`;
  };

  // Get document subtitle
  const getDocumentSubtitle = (doc: any): string => {
    const parts = [];
    if (doc.letter_no) parts.push(`Mektup No: ${doc.letter_no}`);
    if (doc.internal_no) parts.push(`Dahili No: ${doc.internal_no}`);
    return parts.join(' • ') || 'Detay bilgisi yok';
  };

  // Quick preview state for Supabase results (Ön İzle)
  const [quickPreviewOpen, setQuickPreviewOpen] = useState(false);
  const [quickPreviewData, setQuickPreviewData] = useState<any>(null);

  const openQuickPreview = (r: any) => {
    setQuickPreviewData(r);
    setQuickPreviewOpen(true);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      
      {/* Authentication Required Warning */}
      {!user && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <User className="h-5 w-5" />
              Giriş Gerekli
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700">
              🔒 <strong>Güvenlik:</strong> API anahtarları ve yapılandırma bilgileriniz güvenli bir şekilde saklanmaktadır. 
              Bu bilgilere erişmek ve sistemi kullanmak için lütfen giriş yapın.
            </p>
            <div className="mt-3 text-sm text-red-600">
              ✅ Tüm hassas veriler Firestore'da şifrelenerek saklanır<br/>
              ✅ Her kullanıcı sadece kendi verilerine erişebilir<br/>
              ✅ LocalStorage'da hassas veri saklanmaz
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Debug Panel - Geliştirme için */}
      {SHOW_DEBUG_PANEL && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-blue-800">🔧 Debug Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-blue-700">
            <div><strong>App Config:</strong> {(window as any).__APP_CONFIG__ ? 'Yüklendi' : 'Yüklenemedi'}</div>
            <div><strong>User Auth:</strong> {user?.uid ? '✅ Giriş yapmış' : '❌ Giriş yapmamış'}</div>
            <div><strong>Settings Loading:</strong> {settingsLoading ? '🔄 Yükleniyor' : '✅ Yüklendi'}</div>
            <div><strong>Settings Error:</strong> {settingsError || 'Yok'}</div>
            <div className="border-t pt-2 mt-2">
              <div><strong>Supabase (Legacy):</strong></div>
              <div className="ml-2">URL: {settings?.supabase?.url || 'Boş'}</div>
              <div className="ml-2">Key: {settings?.supabase?.anonKey ? `${settings.supabase.anonKey.substring(0, 20)}...` : 'Boş'}</div>
            </div>
            <div className="border-t pt-2 mt-2">
              <div><strong>Config State (Eski):</strong></div>
              <div className="ml-2">Supabase URL: {configs.supabase.url || 'Boş'}</div>
              <div className="ml-2">Supabase Key: {configs.supabase.anonKey ? `${configs.supabase.anonKey.substring(0, 20)}...` : 'Boş'}</div>
              <div className="ml-2">DeepSeek Key: {configs.deepseek.apiKey || 'Boş'}</div>
              <div className="ml-2">OpenAI Key: {configs.openai.apiKey || 'Boş'}</div>
            </div>
            <div><strong>Bağlantı Durumları:</strong> Supabase: {connectionState.supabase}, DeepSeek: {connectionState.deepseek}, OpenAI: {connectionState.openai}</div>
            <div><strong>Toplam Doküman:</strong> {stats.totalDocuments}</div>
            <div><strong>Son Sorgu:</strong> {lastQuery || 'Henüz arama yapılmadı'}</div>
            <div><strong>Sonuç Sayısı:</strong> Supabase: {supabaseResults.length}</div>
            {error && <div className="text-red-600"><strong>Hata:</strong> {error}</div>}
          </CardContent>
        </Card>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🔍 Belge Arama Sistemi</h1>
          <p className="text-gray-600 mt-1">
            AI destekli akıllı belge arama - Supabase PostgreSQL
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div className="flex items-center gap-2 text-sm">
            <div className="flex items-center gap-1">
              {getConnectionIcon(connectionState.supabase)}
              <span className="text-xs">Supabase</span>
            </div>
            <div className="flex items-center gap-1">
              {getConnectionIcon(connectionState.deepseek)}
              <span className="text-xs">DeepSeek</span>
            </div>
            <div className="flex items-center gap-1">
              {getConnectionIcon(connectionState.openai)}
              <span className="text-xs">OpenAI</span>
            </div>
          </div>
          
          {/*
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Ayarlar
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab('config')}
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <User className="h-4 w-4 mr-2" />
            Gelişmiş Ayarlar
          </Button>
          */}
        </div>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="Arama sorgunuzu yazın... (örn: 'sözleşme belgelerine benzer dokümanlar')"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="text-lg h-12"
              />
            </div>
            
            {/* AI Toggle */}
            <div className="flex items-center space-x-2 bg-gray-50 px-4 rounded-lg">
              <Checkbox
                id="enable-ai"
                checked={enableAI}
                onCheckedChange={handleAIToggle}
              />
              <Label 
                htmlFor="enable-ai" 
                className="text-sm font-medium cursor-pointer flex items-center gap-1"
              >
                <Brain className="h-4 w-4" />
                {enableAI ? 'AI Vector Search' : 'Basit Arama'}
              </Label>
            </div>
            
            <Button
              onClick={handleSearch}
              disabled={isLoading || !searchQuery.trim() || !isAnyDatabaseConnected}
              className="h-12 px-8"
            >
              {isLoading ? (
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Search className="h-5 w-5 mr-2" />
              )}
              Ara
            </Button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Date Range */}
                <div className="space-y-2">
                  <Label>Mektup Datei Range</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                      placeholder="Başlangıç"
                    />
                    <Input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                      placeholder="Bitiş"
                    />
                  </div>
                </div>

                {/* Correspondence Type */}
                <div className="space-y-2">
                  <Label>Yazışma Türü</Label>
                  <Select value={filters.type_of_corr} onValueChange={(value) => setFilters(prev => ({ ...prev, type_of_corr: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Yazışma türü seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Tümü</SelectItem>
                      {availableOptions.correspondenceTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Severity Rate */}
                <div className="space-y-2">
                  <Label>Önem Derecesi</Label>
                  <Select value={filters.severity_rate} onValueChange={(value) => setFilters(prev => ({ ...prev, severity_rate: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Önem derecesi seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Tümü</SelectItem>
                      {availableOptions.severityRates.map(rate => (
                        <SelectItem key={rate} value={rate}>{rate}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Incoming/Outgoing */}
                <div className="space-y-2">
                  <Label>Gelen/Giden</Label>
                  <Select value={filters.inc_out} onValueChange={(value) => setFilters(prev => ({ ...prev, inc_out: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Gelen/Giden seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Tümü</SelectItem>
                      <SelectItem value="Gelen">Gelen</SelectItem>
                      <SelectItem value="Giden">Giden</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Internal Number */}
                <div className="space-y-2">
                  <Label>Dahili Numara</Label>
                  <Input
                    value={filters.internal_no}
                    onChange={(e) => setFilters(prev => ({ ...prev, internal_no: e.target.value }))}
                    placeholder="Dahili numara girin"
                  />
                </div>
              </div>

              {/* Keywords */}
              {availableOptions.keywords.length > 0 && (
                <div className="space-y-2">
                  <Label>Anahtar Kelimeler</Label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {availableOptions.keywords.slice(0, 20).map(keyword => (
                      <div key={keyword} className="flex items-center space-x-2">
                        <Checkbox
                          id={keyword}
                          checked={filters.keywords.includes(keyword)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFilters(prev => ({ ...prev, keywords: [...prev.keywords, keyword] }));
                            } else {
                              setFilters(prev => ({ ...prev, keywords: prev.keywords.filter(k => k !== keyword) }));
                            }
                          }}
                        />
                        <Label htmlFor={keyword} className="text-sm">{keyword}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setFilters({
                  dateFrom: '', dateTo: '', type_of_corr: '', severity_rate: '', inc_out: '', keywords: [], internal_no: ''
                })}>
                  Temizle
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Decision Display */}
      {searchDecision && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              AI Arama Stratejisi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge variant={searchDecision.searchType === 'both' ? 'default' : 'secondary'}>
                  {searchDecision.searchType === 'neo4j' && '📊 Graph Database'}
                  {searchDecision.searchType === 'supabase' && '🗃️ Supabase'}
                  {searchDecision.searchType === 'both' && '🔄 Her İki Sistem'}
                </Badge>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Güven Skoru:</span>
                  <Progress value={searchDecision.confidence * 100} className="w-20 h-2" />
                  <span className="text-sm font-medium">{Math.round(searchDecision.confidence * 100)}%</span>
                </div>
              </div>
              <p className="text-sm text-gray-700">{searchDecision.reasoning}</p>
              {searchDecision.queryOptimization && (
                <div className="text-xs text-gray-600">
                  <strong>Optimize edilmiş sorgu:</strong> {searchDecision.queryOptimization.optimizedQuery}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading */}
      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center p-12">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
              <span className="text-lg text-gray-600">
                {searchDecision ? 
                  `Supabase'de arama yapılıyor...` : 
                  'AI arama stratejisi belirleniyor...'
                }
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {(hasResults || activeTab === 'config') && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex items-center justify-between">
            <TabsList className={`grid w-auto ${activeTab === 'config' ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {activeTab !== 'config' && (
                <>
                  <TabsTrigger value="search" className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Sonuçlar ({totalResults})
                  </TabsTrigger>
                </>
              )}
              <TabsTrigger value="config" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                {activeTab === 'config' ? 'Gelişmiş Konfigürasyon' : 'Ayarlar'}
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              {activeTab === 'config' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setActiveTab('search')}
                  className="mr-2"
                >
                  ← Aramaya Dön
                </Button>
              )}
              {activeTab !== 'config' && (
                <>
                  <Button variant="outline" size="sm" onClick={clearResults}>
                    Temizle
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Dışa Aktar
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Combined Results */}
          <TabsContent value="search" className="space-y-4">
            {/* Search Information */}
            {lastQuery && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-blue-600" />
                    Arama Bilgileri
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Arama Detayları</h4>
                      <div className="space-y-1 text-sm">
                        <div><strong>Sorgu:</strong> {lastQuery}</div>
                        <div><strong>Yöntem:</strong> 
                          <Badge variant="outline" className="ml-2">
                            {searchMethod === 'vector' ? '🧠 Vector Search' : 
                             searchMethod === 'hybrid' ? '🔀 Hybrid Search' : '📝 Text Search'}
                          </Badge>
                        </div>
                        {queryEnhancement && (
                          <>
                            <div><strong>Geliştirilmiş Sorgu:</strong> {queryEnhancement.enhancedQuery}</div>
                            <div><strong>Dil:</strong> {queryEnhancement.language === 'turkish' ? '🇹🇷 Türkçe' : '🇺🇸 İngilizce'}</div>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Arama Stratejisi</h4>
                      <div className="space-y-1 text-sm">
                        {queryEnhancement && (queryEnhancement as any).searchTerms && (
                          <div><strong>Anahtar Kelimeler:</strong> {(queryEnhancement as any).searchTerms.join(', ')}</div>
                        )}
                        {queryEnhancement && (queryEnhancement as any).intent && (
                          <div><strong>Arama Amacı:</strong> {(queryEnhancement as any).intent}</div>
                        )}
                        <div><strong>Toplam Sonuç:</strong> {totalResults}</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {aiAnalysis && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    AI Analiz Sonuçları
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Alakalılık Skorları</h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Supabase:</span>
                          <div className="flex items-center gap-2">
                            <Progress value={aiAnalysis.relevanceScores.supabase * 100} className="w-20 h-2" />
                            <span className="text-sm font-medium">{Math.round(aiAnalysis.relevanceScores.supabase * 100)}%</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Vector Search:</span>
                          <div className="flex items-center gap-2">
                            <Progress value={aiAnalysis.relevanceScores.vector * 100} className="w-20 h-2" />
                            <span className="text-sm font-medium">{Math.round(aiAnalysis.relevanceScores.vector * 100)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">AI Önerileri</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {aiAnalysis.recommendations.map((rec, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-blue-500">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Combined Results List */}
            <div className="space-y-4">
              {/* Supabase Results */}
              {supabaseResults.map((result, index) => (
                <Card key={`supabase-${index}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{getDocumentTitle(result)}</CardTitle>
                        <CardDescription className="mt-1">{getDocumentSubtitle(result)}</CardDescription>
                        <div className="flex items-center gap-2 mt-2">
                          {/* Ön İzle (quick preview) button - green magnifier before Database badge */}
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border"
                            onClick={() => openQuickPreview(result)}
                            title="Ön İzle"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-green-600">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l5 5M21 21l-5-5M10 14a4 4 0 100-8 4 4 0 000 8z" />
                            </svg>
                            <span className="text-xs text-green-600">Ön İzle</span>
                          </button>
                          <Badge variant="outline" className="text-green-600">
                            <Database className="h-3 w-3 mr-1" />
                            Database
                          </Badge>
                          {result.similarity && (
                            <Badge variant={result.similarity > 0.9 ? 'default' : result.similarity > 0.7 ? 'secondary' : 'outline'}>
                              🎯 {(result.similarity * 100).toFixed(1)}%
                            </Badge>
                          )}
                          {result.searchType && (
                            <Badge variant="outline" className={
                              result.searchType === 'vector' ? 'text-purple-600' : 
                              result.searchType === 'hybrid' ? 'text-blue-600' : 'text-gray-600'
                            }>
                              {result.searchType === 'vector' ? '🧠 Vector' : 
                               result.searchType === 'hybrid' ? '🔀 Hybrid' : '📝 Text'}
                            </Badge>
                          )}
                          {result.type_of_corr && <Badge>{result.type_of_corr}</Badge>}
                          {result.severity_rate && (
                            <Badge variant={
                              result.severity_rate.toLowerCase().includes('yüksek') ? 'destructive' : 
                              result.severity_rate.toLowerCase().includes('orta') ? 'default' : 'secondary'
                            }>
                              {result.severity_rate}
                            </Badge>
                          )}
                          {result["incout"] && (
                            <Badge variant="secondary">
                              {result["incout"] === 'Gelen' ? '📨 Gelen' : '📤 Giden'}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <div>{formatDate(result.letter_date)}</div>
                        {result.sp_id && <div className="text-xs">SP: {result.sp_id}</div>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {result.content && (
                      <p className="text-gray-700 mb-3 line-clamp-3">
                        {result.content.length > 200 ? 
                          `${result.content.substring(0, 200)}...` : 
                          result.content
                        }
                      </p>
                    )}
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 mb-3">
                      {result.ref_letters && (
                        <div>
                          <span className="font-medium">Ref. Mektuplar:</span>
                          <div className="truncate">{result.ref_letters}</div>
                        </div>
                      )}
                      {result.reply_letter && (
                        <div>
                          <span className="font-medium">Cevap:</span>
                          <div className="truncate">{result.reply_letter}</div>
                        </div>
                      )}
                      {result.weburl && (
                        <div>
                          <span className="font-medium">Web URL:</span>
                          <a href={result.weburl} target="_blank" rel="noopener noreferrer" 
                             className="text-blue-600 hover:underline truncate block">
                            Bağlantı
                          </a>
                        </div>
                      )}
                      {result.metadata && Object.keys(result.metadata).length > 0 && (
                        <div>
                          <span className="font-medium">Metadata:</span>
                          <div className="text-xs">{Object.keys(result.metadata).length} alan</div>
                        </div>
                      )}
                    </div>

                    {result.keywords && (
                      <div className="flex flex-wrap gap-1">
                        {result.keywords.split(',').slice(0, 5).map((keyword, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            <Tag className="h-3 w-3 mr-1" />
                            {keyword.trim()}
                          </Badge>
                        ))}
                        {result.keywords.split(',').length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{result.keywords.split(',').length - 5} daha
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Quick preview dialog for Supabase result (Öz İzle) */}
          <Dialog open={quickPreviewOpen} onOpenChange={setQuickPreviewOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Document Preview</DialogTitle>
              </DialogHeader>
              <div className="p-4 text-sm">
                {quickPreviewData ? (
                  <div className="space-y-3">
                    <div><strong>{quickPreviewData.letter_no || '—'}</strong></div>
                    <div className="text-xs text-gray-600">{quickPreviewData.ref_letters || ''}</div>
                    <div className="text-xs text-gray-600">{quickPreviewData.letter_date ? new Date(quickPreviewData.letter_date).toLocaleDateString() : ''}</div>
                    <div style={{ height: 8 }} />
                    <div className="font-medium">{quickPreviewData.subject || ''}</div>
                    <div className="whitespace-pre-wrap text-gray-800">{quickPreviewData.content || ''}</div>
                  </div>
                ) : (
                  <div>Yükleniyor...</div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {/* Supabase Tab */}
          <TabsContent value="supabase" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Supabase Database Sonuçları
                </CardTitle>
                <CardDescription>
                  Yazışma kayıtları ve belge verileri
                </CardDescription>
              </CardHeader>
              <CardContent>
                {supabaseResults.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Supabase'de sonuç bulunamadı
                  </div>
                ) : (
                  <div className="space-y-4">
                    {supabaseResults.map((result, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-medium text-lg">{getDocumentTitle(result)}</h3>
                            <p className="text-sm text-gray-600 mt-1">{getDocumentSubtitle(result)}</p>
                          </div>
                          <div className="text-right text-sm text-gray-500">
                            <div>{formatDate(result.letter_date)}</div>
                            <div className="text-xs">ID: {result.id}</div>
                          </div>
                        </div>

                        {result.content && (
                          <div className="mb-3">
                            <h4 className="text-sm font-medium text-gray-700 mb-1">İçerik:</h4>
                            <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                              {result.content}
                            </p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="font-medium text-gray-700">Yazışma Türü:</span>
                            <div className="text-gray-600">{result.type_of_corr || 'Belirtilmemiş'}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Önem:</span>
                            <div className="text-gray-600">{result.severity_rate || 'Belirtilmemiş'}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Gelen/Giden:</span>
                            <div className="text-gray-600">{result["incout"] || 'Belirtilmemiş'}</div>
                          </div>
                          <div>
                            <span className="font-medium text-gray-700">Dahili No:</span>
                            <div className="text-gray-600">{result.internal_no || 'Yok'}</div>
                          </div>
                        </div>

                        {(result.ref_letters || result.reply_letter || result.keywords) && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            {result.ref_letters && (
                              <div className="mb-2">
                                <span className="text-xs font-medium text-gray-700">Referans Mektuplar: </span>
                                <span className="text-xs text-gray-600">{result.ref_letters}</span>
                              </div>
                            )}
                            {result.reply_letter && (
                              <div className="mb-2">
                                <span className="text-xs font-medium text-gray-700">Cevap Mektubu: </span>
                                <span className="text-xs text-gray-600">{result.reply_letter}</span>
                              </div>
                            )}
                            {result.keywords && (
                              <div>
                                <span className="text-xs font-medium text-gray-700">Anahtar Kelimeler: </span>
                                <span className="text-xs text-gray-600">{result.keywords}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {result.weburl && (
                          <div className="mt-3">
                            <a href={result.weburl} target="_blank" rel="noopener noreferrer"
                               className="text-xs text-blue-600 hover:underline">
                              🔗 Web Bağlantısı
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Config Management Tab */}
          <TabsContent value="config" className="space-y-4">
            <ConfigManagement />
          </TabsContent>
        </Tabs>
      )}

      {/* Stats Dashboard */}
      {!hasResults && !isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <FileText className="h-8 w-8 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold">{stats.totalDocuments}</div>
                  <div className="text-sm text-gray-600">Toplam Yazışma</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Clock className="h-8 w-8 text-green-600" />
                <div>
                  <div className="text-2xl font-bold">{stats.recentDocuments}</div>
                  <div className="text-sm text-gray-600">Bu Hafta</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Folder className="h-8 w-8 text-purple-600" />
                <div>
                  <div className="text-2xl font-bold">{Object.keys(stats.correspondenceTypeCounts).length}</div>
                  <div className="text-sm text-gray-600">Yazışma Türü</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <TrendingUp className="h-8 w-8 text-orange-600" />
                <div>
                  <div className="text-2xl font-bold">
                    {(stats.incomingOutgoing['Gelen'] || 0) + (stats.incomingOutgoing['Giden'] || 0)}
                  </div>
                  <div className="text-sm text-gray-600">Gelen/Giden</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Settings Modal */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Veritabanı Ayarları
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="text-sm text-gray-600">Supabase, DeepSeek ve OpenAI API bağlantı bilgilerini girin</div>
            <ConfigSettings />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
