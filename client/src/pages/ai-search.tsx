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

  // Star-map adası arama (Belge Haritası sekmesi için)
  const [starQuery, setStarQuery] = useState('');
  const [starLoading, setStarLoading] = useState(false);
  const [starError, setStarError] = useState<string | null>(null);
 
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
    <TabsList className="grid w-full md:w-auto grid-cols-3">
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
                    onNodeClick={handleNodeClick}
                    initialActiveTab="previous"
                    openStarMap={false}
                    preloadedStarMap={preloadedStarMap}
                  />
                </GraphCustomizationProvider>
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