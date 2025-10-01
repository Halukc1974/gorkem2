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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';

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

    // Node click handler - belge detaylarını göster
  const handleNodeClickWithModal = async (nodeId: string) => {
    try {
      const details = await supabaseService.getClient()
        .from('documents')
        .select('*')
        .or(`letter_no.eq.${nodeId},internal_no.eq.${nodeId},id.eq.${nodeId}`)
        .single();

      if (details.data) {
        // Eğer weburl varsa doğrudan aç
        if (details.data.weburl) {
          window.open(details.data.weburl, '_blank');
          return;
        }
        
        // Weburl yoksa modal aç
        setSelectedDocument(details.data);
        setShowDocumentModal(true);
      } else {
        console.warn('Belge detayları bulunamadı:', nodeId);
      }
    } catch (error) {
      console.error('Belge detayları alınırken hata:', error);
    }
  };
  const [preloadedStarMap, setPreloadedStarMap] = useState<{ nodes: any[]; edges: any[] } | null>(null);
  const [starQuery, setStarQuery] = useState('');
  const [starLoading, setStarLoading] = useState(false);
  const [starError, setStarError] = useState<string | null>(null);

  // Belge analiz state
  const [documentBasket, setDocumentBasket] = useState<Array<{
    id: string;
    letter_no: string;
    letter_date?: string;
    ref_letters?: string;
    short_desc?: string;
  }>>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());

  // Belge detay modal state
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);

  // Belge sepetine ekleme fonksiyonu
  const addToDocumentBasket = async (documentId: string) => {
    // Eğer zaten sepette varsa ekleme
    if (documentBasket.some(doc => doc.id === documentId)) {
      return;
    }

    try {
      // Belge detaylarını Supabase'den çek
      const { data, error } = await supabaseService.getClient()
        .from('documents')
        .select('id, letter_no, letter_date, ref_letters, short_desc')
        .eq('id', documentId)
        .single();

      if (error) throw error;

      if (data) {
        setDocumentBasket(prev => [...prev, {
          id: data.id,
          letter_no: data.letter_no || '',
          letter_date: data.letter_date,
          ref_letters: data.ref_letters,
          short_desc: data.short_desc
        }]);
      }
    } catch (error) {
      console.error('Belge sepete eklenirken hata:', error);
    }
  };

  // Belge sepetinden çıkarma fonksiyonu
  const removeFromDocumentBasket = (documentId: string) => {
    setDocumentBasket(prev => prev.filter(doc => doc.id !== documentId));
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      newSet.delete(documentId);
      return newSet;
    });
  };
 
  const handleFindIsland = async (query: string) => {
    if (!query || !query.trim()) return;
    setStarLoading(true);
    setStarError(null);
    try {
      // Ensure we have full star map data (use cached preloadedStarMap if present)
      let fullGraph = preloadedStarMap;
      if (!fullGraph) {
        const records = await supabaseService.getAllDocumentRelations();
        const built = buildStarMapGraph(records);
        fullGraph = { nodes: built.nodes, edges: built.edges };
      }

      // Helper: extract canonical id from node/edge shapes the util may produce
      const getNodeId = (n: any) => {
        if (!n) return '';
        if (typeof n === 'string') return n;
        if (n.id) return String(n.id);
        if (n.data?.id) return String(n.data.id);
        if (n.data?.letter_no) return String(n.data.letter_no);
        return '';
      };

      const normalize = (s: any) => String(s ?? '').trim().toUpperCase();

      // Map normalized id -> original id (to handle case/whitespace differences)
      const normToOriginal = new Map<string, string>();
      fullGraph.nodes.forEach((n: any) => {
        const orig = getNodeId(n);
        if (!orig) return;
        normToOriginal.set(normalize(orig), orig);
      });

      const qNorm = normalize(query);
      const startId = normToOriginal.get(qNorm) || null;
      if (!startId) {
        setStarError('Aranan letter_no haritada bulunamadı.');
        setStarLoading(false);
        return;
      }

      // build adjacency and BFS to get connected component (undirected)
      const adj = new Map<string, Set<string>>();
      // initialize adjacency for all known original ids
      fullGraph.nodes.forEach((n: any) => {
        const id = getNodeId(n);
        if (!adj.has(id)) adj.set(id, new Set());
      });
      // add edges (handle shapes where edge may be {source,target} or {data:{source,target}})
      fullGraph.edges.forEach((e: any) => {
        const s = e.source ?? e.data?.source ?? e.data?.from ?? '';
        const t = e.target ?? e.data?.target ?? e.data?.to ?? '';
        const sId = String(s);
        const tId = String(t);
        if (!adj.has(sId)) adj.set(sId, new Set());
        if (!adj.has(tId)) adj.set(tId, new Set());
        adj.get(sId)!.add(tId);
        adj.get(tId)!.add(sId);
      });

      const queue: string[] = [startId];
      const seen = new Set<string>([startId]);
      while (queue.length) {
        const cur = queue.shift()!;
        const neighbors = adj.get(cur);
        if (!neighbors) continue;
        for (const nb of neighbors) {
          if (!seen.has(nb)) {
            seen.add(nb);
            queue.push(nb);
          }
        }
      }

      // filter nodes/edges to the island
    const islandNodes = fullGraph.nodes.filter((n: any) => seen.has(getNodeId(n)));
    const islandNodeIds = new Set(islandNodes.map((n: any) => getNodeId(n)));
      const getEdgeEndpoints = (e: any) => {
        const s = e.source ?? e.data?.source ?? e.data?.from ?? e[0] ?? undefined;
        const t = e.target ?? e.data?.target ?? e.data?.to ?? e[1] ?? undefined;
        return { s: s !== undefined ? String(s) : undefined, t: t !== undefined ? String(t) : undefined };
      };

      const islandEdges = fullGraph.edges.filter((e: any) => {
        const { s, t } = getEdgeEndpoints(e);
        if (!s || !t) return false;
        return islandNodeIds.has(s) && islandNodeIds.has(t);
      });

      setPreloadedStarMap({ nodes: islandNodes, edges: islandEdges });
      // ensure UI shows star-map tab (optional)
      setActiveTab('star-map-top');
    } catch (err: any) {
      console.error('Ada bulma hatası', err);
      setStarError(String(err?.message ?? err));
    } finally {
      setStarLoading(false);
    }
  };
 
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <span className="inline-flex items-center justify-center p-2 bg-blue-100 rounded-lg">
              {/* <Brain className="h-8 w-8 text-blue-600 stroke-2" strokeLinejoin="round" /> */}
            </span>
           Belge Referans Grafikleri
          </h1>
          <p className="text-gray-600 mt-1">
            AI destekli arama ve belge ilişkileri görselleştirme
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
    <TabsList className="grid w-full md:w-auto grid-cols-4">
          {/* <TabsTrigger value="search" className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-current stroke-2" strokeLinejoin="round" />
            AI Arama
          </TabsTrigger> */}
          <TabsTrigger value="graph" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Belge Referans Grafiği
          </TabsTrigger>
          <TabsTrigger value="star-map-top" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Tüm Belge Ağı
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Belge Analiz
          </TabsTrigger>
        </TabsList>
        
        

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
                {/* Arama kutusu: letter_no girin -> sadece o belgenin bulunduğu ada getirilsin */}
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Ada için letter_no girin (ör. IC-HQ-975)"
                    value={starQuery}
                    onChange={(e) => setStarQuery(e.target.value)}
                    className="w-full max-w-md"
                  />
                  <Button onClick={() => handleFindIsland(starQuery)} disabled={starLoading}>
                    {starLoading ? 'Bulunuyor...' : 'Ada Getir'}
                  </Button>
                  <Button variant="ghost" onClick={() => { setPreloadedStarMap(null); setStarQuery(''); }}>
                    Sıfırla
                  </Button>
                </div>
                {starError && <div className="text-sm text-red-600">{starError}</div>}

                <GraphCustomizationProvider>
                  <DocumentGraph 
                    data={graphData || { nodes: [], edges: [] }}
                    onNodeClick={handleNodeClickWithModal}
                    initialActiveTab="previous"
                    openStarMap={false}
                    preloadedStarMap={preloadedStarMap}
                    onAddToBasket={addToDocumentBasket}
                  />
                </GraphCustomizationProvider>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="star-map-top">
          <Card>            
            <CardContent>
              <div className="space-y-4">
                {/* Arama kutusu: letter_no girin -> sadece o belgenin bulunduğu ada getirilsin */}
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Ada için letter_no girin (ör. IC-HQ-975)"
                    value={starQuery}
                    onChange={(e) => setStarQuery(e.target.value)}
                    className="w-full max-w-md"
                  />
                  <Button onClick={() => handleFindIsland(starQuery)} disabled={starLoading}>
                    {starLoading ? 'Bulunuyor...' : 'Ada Getir'}
                  </Button>
                  <Button variant="ghost" onClick={() => { setPreloadedStarMap(null); setStarQuery(''); }}>
                    Sıfırla
                  </Button>
                </div>
                {starError && <div className="text-sm text-red-600">{starError}</div>}
                 <GraphCustomizationProvider>
                   <DocumentGraph 
                     data={graphData || { nodes: [], edges: [] }}
                     onNodeClick={handleNodeClickWithModal}
                     initialActiveTab="star-map"
                     openStarMap={activeTab === 'star-map-top'}
                     preloadedStarMap={preloadedStarMap}
                     onAddToBasket={addToDocumentBasket}
                   />
                 </GraphCustomizationProvider>
               </div>
             </CardContent>
           </Card>
         </TabsContent>
        <TabsContent value="analysis">
          <Card>
            <CardHeader>
              <CardTitle>Belge Analiz</CardTitle>
              <CardDescription>
                Seçilen belgeleri analiz edin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Analiz Et butonu */}
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    {documentBasket.length} belge seçildi
                  </div>
                  <Button 
                    onClick={() => {
                      // TODO: Analiz işlemi burada yapılacak
                      console.log('Seçilen belgeler:', Array.from(selectedDocuments));
                    }}
                    disabled={selectedDocuments.size === 0}
                  >
                    Analiz Et ({selectedDocuments.size})
                  </Button>
                </div>

                {/* Belge tablosu */}
                {documentBasket.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Henüz hiç belge eklenmemiş. Grafiklerde node'lara sağ tıklayarak "Belgeyi Sepete Ekle" seçeneği ile belgeleri ekleyebilirsiniz.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-300 px-4 py-2 text-left">
                            <input
                              type="checkbox"
                              checked={selectedDocuments.size === documentBasket.length && documentBasket.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedDocuments(new Set(documentBasket.map(doc => doc.id)));
                                } else {
                                  setSelectedDocuments(new Set());
                                }
                              }}
                              className="rounded"
                            />
                          </th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Belge No</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Tarih</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Referanslar</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Açıklama</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documentBasket.map((doc) => (
                          <tr key={doc.id} className="hover:bg-gray-50">
                            <td className="border border-gray-300 px-4 py-2">
                              <input
                                type="checkbox"
                                checked={selectedDocuments.has(doc.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedDocuments(prev => new Set([...prev, doc.id]));
                                  } else {
                                    setSelectedDocuments(prev => {
                                      const newSet = new Set(prev);
                                      newSet.delete(doc.id);
                                      return newSet;
                                    });
                                  }
                                }}
                                className="rounded"
                              />
                            </td>
                            <td className="border border-gray-300 px-4 py-2">{doc.letter_no}</td>
                            <td className="border border-gray-300 px-4 py-2">{doc.letter_date || '-'}</td>
                            <td className="border border-gray-300 px-4 py-2">{doc.ref_letters || '-'}</td>
                            <td className="border border-gray-300 px-4 py-2">{doc.short_desc || '-'}</td>
                            <td className="border border-gray-300 px-4 py-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFromDocumentBasket(doc.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                ✕
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Belge Detay Modal */}
      <Dialog open={showDocumentModal} onOpenChange={setShowDocumentModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Belge Detayları</DialogTitle>
          </DialogHeader>
          {selectedDocument && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold">Belge No:</label>
                  <p>{selectedDocument.letter_no || '-'}</p>
                </div>
                <div>
                  <label className="font-semibold">Tarih:</label>
                  <p>{selectedDocument.letter_date || '-'}</p>
                </div>
                <div>
                  <label className="font-semibold">Referanslar:</label>
                  <p>{selectedDocument.ref_letters || '-'}</p>
                </div>
                <div>
                  <label className="font-semibold">Önem Derecesi:</label>
                  <p>{selectedDocument.severity_rate || '-'}</p>
                </div>
                <div>
                  <label className="font-semibold">Yazışma Türü:</label>
                  <p>{selectedDocument.type_of_corr || '-'}</p>
                </div>
                <div>
                  <label className="font-semibold">Gelen/Giden:</label>
                  <p>{selectedDocument.incout || '-'}</p>
                </div>
              </div>
              
              <div>
                <label className="font-semibold">Kısa Açıklama:</label>
                <p className="mt-1">{selectedDocument.short_desc || '-'}</p>
              </div>
              
              <div>
                <label className="font-semibold">İçerik:</label>
                <div className="mt-1 p-3 bg-gray-50 rounded max-h-40 overflow-y-auto">
                  {selectedDocument.content || 'İçerik bulunamadı'}
                </div>
              </div>
              
              <div>
                <label className="font-semibold">Anahtar Kelimeler:</label>
                <p className="mt-1">{selectedDocument.keywords || '-'}</p>
              </div>
              
              {selectedDocument.weburl && (
                <div>
                  <label className="font-semibold">Web URL:</label>
                  <a 
                    href={selectedDocument.weburl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline ml-2"
                  >
                    {selectedDocument.weburl}
                  </a>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}