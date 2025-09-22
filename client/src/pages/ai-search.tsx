import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { 
  Search, Network, Brain, Cpu, CircuitBoard, Sparkles 
} from 'lucide-react';
import { DocumentGraph } from '../components/graph-engine/DocumentGraph';
import { supabaseService } from '../services/supabase';
import { buildStarMapGraph } from '../utils/documentGraphStarMap';
import { useDocumentGraph } from '../hooks/use-document-graph';
import { GraphCustomizationProvider } from '../components/graph-engine/context/GraphCustomizationContext';
import { useDocumentSearch } from '../hooks/use-document-search';

export default function AISearchPage() {
  // Document search hooks
  const {
    loading: searchLoading,
    isAnyDatabaseConnected,
    totalResults,
    hasResults,
    search,
    clearResults,
    configureServices,
  } = useDocumentSearch();
  
  // Initialize services on mount
  useEffect(() => {
    if (configureServices) {
      configureServices();
    }
  }, []); // Run only on mount

  // UI state
  const [activeTab, setActiveTab] = useState('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [enableAI, setEnableAI] = useState(() => {
    const stored = localStorage.getItem('doc_search_enable_ai');
    return stored !== null ? stored === 'true' : true;
  });

  // Graph state
  const [rootDoc, setRootDoc] = useState('');
  const { 
    graphData, 
    loading: graphLoading, 
    error, 
    loadGraph, 
    handleNodeClick 
  } = useDocumentGraph();
  const [preloadedStarMap, setPreloadedStarMap] = useState<{ nodes: any[]; edges: any[] } | null>(null);
    
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <span className="inline-flex items-center justify-center p-2 bg-blue-100 rounded-lg">
              <Brain className="h-8 w-8 text-blue-600 stroke-2" strokeLinejoin="round" />
            </span>
            Yapay Zeka ile Ara
          </h1>
          <p className="text-gray-600 mt-1">
            AI destekli arama ve belge ilişkileri görselleştirme
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
    <TabsList className="grid w-full md:w-auto grid-cols-3">
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-current stroke-2" strokeLinejoin="round" />
            AI Arama
          </TabsTrigger>
          <TabsTrigger value="graph" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Belge Grafiği
          </TabsTrigger>
          <TabsTrigger value="star-map-top" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Belge Haritası
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="search">
          <Card>
            <CardHeader>
              <CardTitle>AI Destekli Arama</CardTitle>
              <CardDescription>
                Yapay zeka ile gelişmiş belge araması yapın
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Arama yapmak için doğal dil kullanın..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <Button 
                    onClick={() => search(searchQuery)}
                    disabled={!isAnyDatabaseConnected || !searchQuery.trim()}
                  >
                    {searchLoading ? 'Aranıyor...' : 'Ara'}
                  </Button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      Filtreler {showFilters ? '▼' : '▶'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSettings(!showSettings)}
                    >
                      Ayarlar {showSettings ? '▼' : '▶'}
                    </Button>
                  </div>
                  
                  {hasResults && (
                    <Button 
                      variant="ghost"
                      size="sm"
                      onClick={clearResults}
                    >
                      Sonuçları Temizle
                    </Button>
                  )}
                </div>

                {showSettings && (
                  <Card className="mt-4">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium">AI Özelliğini Etkinleştir</h3>
                            <p className="text-sm text-gray-500">
                              AI destekli arama ve belge ilişkileri analizi
                            </p>
                          </div>
                          <Switch
                            checked={enableAI}
                            onCheckedChange={(value) => {
                              setEnableAI(value);
                              localStorage.setItem('doc_search_enable_ai', value.toString());
                            }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {showFilters && (
                  <Card className="mt-4">
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Filtre seçenekleri buraya eklenecek */}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Arama sonuçları */}
                {hasResults && totalResults > 0 ? (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-4">
                      Sonuçlar ({totalResults})
                    </h3>
                    {/* Sonuç kartları buraya eklenecek */}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="graph">
          <Card>
            <CardHeader>
              <CardTitle>Belge İlişki Grafiği</CardTitle>
              <CardDescription>
                Belgeler arasındaki referans ilişkilerini görselleştirir
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <Input
                    placeholder="Belge ID veya Numarası"
                    value={rootDoc}
                    onChange={(e) => setRootDoc(e.target.value)}
                  />
                  <Button 
                    onClick={() => loadGraph(rootDoc)}
                    disabled={!rootDoc.trim() || graphLoading || !isAnyDatabaseConnected}
                  >
                    {graphLoading ? 'Yükleniyor...' : !isAnyDatabaseConnected ? 'Bağlantı Bekleniyor...' : 'Grafiği Oluştur'}
                  </Button>
                </div>

                {error && (
                  <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
                    <div className="font-medium">Hata oluştu:</div>
                    <div>{error}</div>
                    {!isAnyDatabaseConnected && (
                      <div className="mt-2">
                        Veritabanı bağlantısı kurulamadı. Lütfen ayarlarınızı kontrol edin.
                      </div>
                    )}
                  </div>
                )}
                
                {graphData && (
                  <GraphCustomizationProvider>
                    <DocumentGraph 
                      data={graphData}
                      onNodeClick={handleNodeClick}
                    />
                  </GraphCustomizationProvider>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="star-map-top">
          <Card>
            <CardHeader>
              <CardTitle>Belge Haritası</CardTitle>
              <CardDescription>
                Tüm belgeler arasındaki ilişki haritası
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    onClick={async () => {
                      try {
                        const records = await supabaseService.getAllDocumentRelations();
                        const graph = buildStarMapGraph(records);
                        setPreloadedStarMap({ nodes: graph.nodes, edges: graph.edges });
                      } catch (err) {
                        console.error('Star map preload failed', err);
                      }
                    }}
                  >
                    Haritayı Yükle
                  </Button>
                </div>
                <GraphCustomizationProvider>
                  <DocumentGraph 
                    data={graphData || { nodes: [], edges: [] }}
                    onNodeClick={handleNodeClick}
                    initialActiveTab="star-map"
                    openStarMap={activeTab === 'star-map-top'}
                    preloadedStarMap={preloadedStarMap}
                  />
                </GraphCustomizationProvider>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}