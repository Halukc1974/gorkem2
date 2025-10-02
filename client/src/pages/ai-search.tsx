import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { 
  Search, Network, Brain, Cpu, CircuitBoard, Sparkles, CheckCircle2, XCircle, Eye, FileText, Calendar 
} from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { DocumentGraph } from '../components/graph-engine/DocumentGraph';
import { supabaseService } from '../services/supabase';
import { buildStarMapGraph } from '../utils/documentGraphStarMap';
import { useDocumentGraph } from '../hooks/use-document-graph';
import { GraphCustomizationProvider } from '../components/graph-engine/context/GraphCustomizationContext';
import { useDocumentSearch } from '../hooks/use-document-search';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useUserSettings } from '../hooks/useUserSettings';
import { DecisionSupportService } from '../services/decision-support';
import { useToast } from '../hooks/use-toast';

export default function AISearchPage() {
  // User settings hook for API keys
  const { config, hasValidApis } = useUserSettings();
  
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

    // Node click handler - show document details or open web_url
  const handleNodeClickWithModal = useCallback(async (nodeId: string) => {
    try {
      console.log('Node clicked:', nodeId);
      
      // Get document details - can be letter_no, internal_no or id
            // First try letter_no or internal_no
      let { data, error } = await supabaseService.getClient()
        .from('documents')
        .select('id, letter_no, letter_date, ref_letters, short_desc, weburl, content, inc_out')
        .or(`letter_no.eq.${nodeId},internal_no.eq.${nodeId},id.eq.${nodeId}`)
        .maybeSingle();
      
      // If not found, try internal_no
      if (!data && !error) {
        const result = await supabaseService.getClient()
          .from('documents')
          .select('*')
          .eq('internal_no', nodeId)
          .maybeSingle();
        data = result.data;
        error = result.error;
      }
      
      // If still not found, try id
      if (!data && !error) {
        const result = await supabaseService.getClient()
          .from('documents')
          .select('*')
          .eq('id', nodeId)
          .maybeSingle();
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('Document query error:', error);
        return;
      }

      if (data) {
        console.log('Document found:', data);
        
        // If weburl exists, open directly
        if (data.weburl) {
          console.log('Opening web URL:', data.weburl);
          window.open(data.weburl, '_blank', 'noopener,noreferrer');
          return;
        }
        
        console.log('No web URL, opening modal');
        // If no weburl, open modal
        setSelectedDocument(data);
        setShowDocumentModal(true);
      } else {
        console.warn('Document details not found:', nodeId);
      }
    } catch (error) {
      console.error('Error getting document details:', error);
    }
  }, []);
  const [preloadedStarMap, setPreloadedStarMap] = useState<{ nodes: any[]; edges: any[] } | null>(null);
  const [starQuery, setStarQuery] = useState('');
  const [starLoading, setStarLoading] = useState(false);
  const [starError, setStarError] = useState<string | null>(null);

  // Timeline state
  const [timelineQuery, setTimelineQuery] = useState('');
  const [timelineDocuments, setTimelineDocuments] = useState<any[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  // Document analysis state
  const [documentBasket, setDocumentBasket] = useState<Array<{
    id: string;
    letter_no: string;
    letter_date?: string;
    ref_letters?: string;
    short_desc?: string;
    weburl?: string;
    inc_out?: string;
  }>>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());

  // Document detail modal state
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [showDocumentModal, setShowDocumentModal] = useState(false);

  // Document preview modal state
  const [previewContent, setPreviewContent] = useState<{ letter_no: string; content: string } | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Add document to basket function
  const addToDocumentBasket = useCallback(async (documentId: string) => {
    try {
      console.log('Adding to basket, nodeId:', documentId);
      
      // Get document details from Supabase - nodeId can be letter_no, internal_no or id
      // First try letter_no
      let { data, error } = await supabaseService.getClient()
        .from('documents')
        .select('id, letter_no, letter_date, ref_letters, short_desc, weburl, inc_out')
        .eq('letter_no', documentId)
        .maybeSingle();
      
      // If not found, try internal_no
      if (!data && !error) {
        const result = await supabaseService.getClient()
          .from('documents')
          .select('id, letter_no, letter_date, ref_letters, short_desc, weburl, inc_out')
          .eq('internal_no', documentId)
          .maybeSingle();
        data = result.data;
        error = result.error;
      }
      
      // If still not found, try id
      if (!data && !error) {
        const result = await supabaseService.getClient()
          .from('documents')
          .select('id, letter_no, letter_date, ref_letters, short_desc, weburl, inc_out')
          .eq('id', documentId)
          .maybeSingle();
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('Document not found:', error);
        alert(`Document not found: ${documentId}`);
        return;
      }

      if (data) {
        // If already in basket, don't add
        if (documentBasket.some(doc => doc.id === String(data.id))) {
          console.log('Document already in basket:', data.id);
          alert('This document is already in the basket!');
          return;
        }

        console.log('Adding document to basket:', data);
        setDocumentBasket(prev => [...prev, {
          id: String(data.id),
          letter_no: data.letter_no || '',
          letter_date: data.letter_date,
          ref_letters: data.ref_letters,
          short_desc: data.short_desc,
          weburl: data.weburl,
          inc_out: data.inc_out
        }]);
        alert(`"${data.letter_no}" document added to basket!`);
      }
    } catch (error) {
      console.error('Error adding document to basket:', error);
      alert('An error occurred while adding the document to basket!');
    }
  }, [documentBasket]);

  // Remove document from basket function
  const removeFromDocumentBasket = (documentId: string) => {
    setDocumentBasket(prev => prev.filter(doc => doc.id !== documentId));
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      newSet.delete(documentId);
      return newSet;
    });
  };

  // Document preview function
  const handlePreviewDocument = async (documentId: string, letterNo: string) => {
    try {
      const { data, error } = await supabaseService.getClient()
        .from('documents')
        .select('content')
        .eq('id', documentId)
        .single();

      if (error || !data) {
        alert('Document content could not be loaded!');
        return;
      }

      setPreviewContent({ letter_no: letterNo, content: data.content || 'Content not found' });
      setShowPreviewModal(true);
    } catch (error) {
      console.error('Document preview error:', error);
      alert('An error occurred while previewing the document!');
    }
  };

  // Open document in new tab
  const handleOpenDocument = (weburl: string | undefined) => {
    if (weburl && weburl.trim()) {
      window.open(weburl, '_blank', 'noopener,noreferrer');
    } else {
      alert('URL not found for this document!');
    }
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
        setStarError('Searched letter_no not found in map.');
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
      console.error('Island finding error', err);
      setStarError(String(err?.message ?? err));
    } finally {
      setStarLoading(false);
    }
  };

  // Handle timeline search - finds island and displays as timeline
  const handleFindTimeline = async (query: string) => {
    if (!query || !query.trim()) return;
    setTimelineLoading(true);
    setTimelineError(null);
    setTimelineDocuments([]);
    
    try {
      // Use same island finding logic as handleFindIsland
      let fullGraph = preloadedStarMap;
      if (!fullGraph) {
        const records = await supabaseService.getAllDocumentRelations();
        const built = buildStarMapGraph(records);
        fullGraph = { nodes: built.nodes, edges: built.edges };
      }

      const getNodeId = (n: any) => {
        if (!n) return '';
        if (typeof n === 'string') return n;
        if (n.id) return String(n.id);
        if (n.data?.id) return String(n.data.id);
        if (n.data?.letter_no) return String(n.data.letter_no);
        return '';
      };

      const normalize = (s: any) => String(s ?? '').trim().toUpperCase();

      const normToOriginal = new Map<string, string>();
      fullGraph.nodes.forEach((n: any) => {
        const orig = getNodeId(n);
        if (!orig) return;
        normToOriginal.set(normalize(orig), orig);
      });

      const qNorm = normalize(query);
      const startId = normToOriginal.get(qNorm) || null;
      if (!startId) {
        setTimelineError('Searched letter_no not found in map.');
        setTimelineLoading(false);
        return;
      }

      // Build adjacency and BFS to get connected component
      const adj = new Map<string, Set<string>>();
      fullGraph.nodes.forEach((n: any) => {
        const id = getNodeId(n);
        if (!adj.has(id)) adj.set(id, new Set());
      });
      
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

      // Get all letter_no values from the island
      const islandLetterNos = Array.from(seen);
      
      // Fetch full document details from Supabase
      const { data: documents, error } = await supabaseService.getClient()
        .from('documents')
        .select('id, letter_no, letter_date, ref_letters, short_desc, weburl, inc_out, content')
        .in('letter_no', islandLetterNos);

      if (error) {
        console.error('Error fetching timeline documents:', error);
        setTimelineError('Error loading documents from database.');
        setTimelineLoading(false);
        return;
      }

      if (!documents || documents.length === 0) {
        setTimelineError('No documents found for this island.');
        setTimelineLoading(false);
        return;
      }

      // Sort documents by date
      const sortedDocuments = documents
        .filter(doc => doc.letter_date) // Only include documents with dates
        .sort((a, b) => new Date(a.letter_date).getTime() - new Date(b.letter_date).getTime());

      setTimelineDocuments(sortedDocuments);
      setTimelineLoading(false);

    } catch (err: any) {
      console.error('Timeline search error:', err);
      setTimelineError(String(err?.message ?? err));
      setTimelineLoading(false);
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
           Document Reference Graphs
          </h1>
          <p className="text-gray-600 mt-1">
            AI-powered search and document relationship visualization
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
    <TabsList className="grid w-full md:w-auto grid-cols-5">
          {/* <TabsTrigger value="search" className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-current stroke-2" strokeLinejoin="round" />
            AI Search
          </TabsTrigger> */}
          <TabsTrigger value="graph" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Document Reference Graph
          </TabsTrigger>
          <TabsTrigger value="star-map-top" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            All Documents Network
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Timeline View
          </TabsTrigger>
          <TabsTrigger value="analysis" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Document Analysis
          </TabsTrigger>
        </TabsList>
        
        

        <TabsContent value="graph">
          <Card>
           {/*  <CardHeader>
              <CardTitle>Document Relationship Graph</CardTitle>
              <CardDescription>
                Visualizes reference relationships between documents
              </CardDescription>
            </CardHeader> */}
            <CardContent>
              <div className="space-y-4">
                {/* Search box: enter letter_no -> bring only the island where that document is located */}
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Enter letter_no for island (e.g., IC-HQ-975)"
                    value={starQuery}
                    onChange={(e) => setStarQuery(e.target.value)}
                    className="w-full max-w-md"
                  />
                  <Button onClick={() => handleFindIsland(starQuery)} disabled={starLoading}>
                    {starLoading ? 'Finding...' : 'Show Island'}
                  </Button>
                  <Button variant="ghost" onClick={() => { setPreloadedStarMap(null); setStarQuery(''); }}>
                    Reset
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
                {/* Search box: enter letter_no -> bring only the island where that document is located */}
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Enter letter_no for island (e.g., IC-HQ-975)"
                    value={starQuery}
                    onChange={(e) => setStarQuery(e.target.value)}
                    className="w-full max-w-md"
                  />
                  <Button onClick={() => handleFindIsland(starQuery)} disabled={starLoading}>
                    {starLoading ? 'Finding...' : 'Show Island'}
                  </Button>
                  <Button variant="ghost" onClick={() => { setPreloadedStarMap(null); setStarQuery(''); }}>
                    Reset
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
        
        <TabsContent value="timeline">
          <Card>
            <CardContent>
              <div className="space-y-4">
                {/* Search box */}
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Enter letter_no for timeline (e.g., IC-HQ-975)"
                    value={timelineQuery}
                    onChange={(e) => setTimelineQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleFindTimeline(timelineQuery);
                      }
                    }}
                    className="w-full max-w-md"
                  />
                  <Button onClick={() => handleFindTimeline(timelineQuery)} disabled={timelineLoading}>
                    {timelineLoading ? 'Loading...' : 'Show Timeline'}
                  </Button>
                  <Button variant="ghost" onClick={() => { 
                    setTimelineDocuments([]); 
                    setTimelineQuery(''); 
                    setTimelineError(null);
                  }}>
                    Reset
                  </Button>
                </div>
                {timelineError && <div className="text-sm text-red-600">{timelineError}</div>}

                {/* Timeline Visualization */}
                {timelineDocuments.length > 0 && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                    <div className="mb-4 text-sm text-gray-600">
                      Found {timelineDocuments.length} documents in timeline (Incoming: {timelineDocuments.filter(d => d.inc_out === 'inc').length}, Outgoing: {timelineDocuments.filter(d => d.inc_out === 'out').length})
                    </div>
                    
                    {/* Timeline Container - Horizontal scroll for all documents */}
                    <div className="overflow-x-auto pb-4" style={{ overflowY: 'visible' }}>
                      <div className="relative" style={{ minWidth: `${Math.max(timelineDocuments.length * 120, 1200)}px`, minHeight: '420px', paddingTop: '60px', paddingBottom: '60px' }}>
                        
                        {/* Incoming Letters (Top) */}
                        <div className="absolute top-0 left-0 right-0" style={{ height: '160px' }}>
                          <div className="text-xs font-semibold text-green-700 mb-2 uppercase">
                            ↓ Incoming (Administration)
                          </div>
                          <div className="relative h-full" style={{ paddingTop: '50px' }}>
                            {timelineDocuments
                              .filter(doc => doc.inc_out === 'inc')
                              .map((doc, index) => {
                                // Calculate position based on date range
                                const firstDate = new Date(timelineDocuments[0].letter_date).getTime();
                                const lastDate = new Date(timelineDocuments[timelineDocuments.length - 1].letter_date).getTime();
                                const docDate = new Date(doc.letter_date).getTime();
                                const totalRange = lastDate - firstDate || 1;
                                const position = ((docDate - firstDate) / totalRange) * 98 + 1; // 1-99% to leave margins
                                
                                return (
                                  <div
                                    key={doc.id}
                                    className="group absolute"
                                    style={{ 
                                      left: `${position}%`,
                                      top: '25px',
                                      transform: 'translateX(-50%)'
                                    }}
                                  >
                                    {/* Connector line to timeline */}
                                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0.5 h-6 bg-green-400"></div>
                                    
                                    {/* Document Node Circle */}
                                    <div 
                                      className="relative bg-green-500 border-2 border-green-700 rounded-full cursor-pointer hover:shadow-xl transition-all hover:scale-125 hover:z-50"
                                      style={{ width: '32px', height: '32px' }}
                                      onClick={() => handleNodeClickWithModal(doc.letter_no)}
                                    >
                                      {/* Vertical Date Label - Always Visible */}
                                      <div 
                                        className="absolute left-1/2 bottom-full mb-1 text-xs font-bold text-green-900 whitespace-nowrap"
                                        style={{ 
                                          writingMode: 'vertical-rl',
                                          textOrientation: 'upright',
                                          transform: 'translateX(-50%)',
                                          letterSpacing: '-0.05em'
                                        }}
                                      >
                                        {new Date(doc.letter_date).toLocaleDateString('en-US', { 
                                          month: 'short', 
                                          day: 'numeric'
                                        })}
                                      </div>
                                      
                                      {/* Hover tooltip with full info - Same style as Document Graph */}
                                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-16 w-80 bg-white border-2 border-green-600 rounded-lg shadow-2xl p-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                        <div className="space-y-2 text-sm">
                                          <div className="flex items-center justify-between border-b pb-2">
                                            <span className="font-bold text-green-900">{doc.letter_no}</span>
                                            <span className="inline-block px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-semibold">
                                              INCOMING
                                            </span>
                                          </div>
                                          <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                              <span className="text-gray-500">Date:</span>
                                              <div className="font-semibold text-gray-900">
                                                {new Date(doc.letter_date).toLocaleDateString('en-US', { 
                                                  year: 'numeric', 
                                                  month: 'long', 
                                                  day: 'numeric' 
                                                })}
                                              </div>
                                            </div>
                                            {doc.ref_letters && (
                                              <div>
                                                <span className="text-gray-500">References:</span>
                                                <div className="font-semibold text-gray-900 truncate" title={doc.ref_letters}>
                                                  {doc.ref_letters}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                          {doc.short_desc && (
                                            <div className="pt-2 border-t">
                                              <span className="text-gray-500 text-xs">Description:</span>
                                              <div className="text-gray-900 text-xs mt-1">{doc.short_desc}</div>
                                            </div>
                                          )}
                                          <div className="pt-2 border-t flex gap-2">
                                            <button
                                              className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs font-semibold hover:bg-green-700 transition-colors"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                addToDocumentBasket(doc.letter_no);
                                              }}
                                            >
                                              + Add to Basket
                                            </button>
                                            {doc.weburl && (
                                              <button
                                                className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 transition-colors"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  window.open(doc.weburl, '_blank');
                                                }}
                                              >
                                                Open
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>

                        {/* Timeline Line */}
                        <div className="absolute left-0 right-0" style={{ top: '185px', height: '30px' }}>
                          <div className="relative h-full flex items-center">
                            <div className="absolute left-0 right-0 h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-full shadow-lg"></div>
                            
                            {/* Date markers on timeline for each document */}
                            {timelineDocuments.map((doc, index) => {
                              const firstDate = new Date(timelineDocuments[0].letter_date).getTime();
                              const lastDate = new Date(timelineDocuments[timelineDocuments.length - 1].letter_date).getTime();
                              const docDate = new Date(doc.letter_date).getTime();
                              const totalRange = lastDate - firstDate || 1;
                              const position = ((docDate - firstDate) / totalRange) * 98 + 1;
                              
                              return (
                                <div
                                  key={`marker-${doc.id}`}
                                  className="absolute"
                                  style={{ left: `${position}%` }}
                                >
                                  {/* Marker dot */}
                                  <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-blue-600 rounded-full shadow-md"></div>
                                </div>
                              );
                            })}
                            
                            {/* Start marker */}
                            <div className="absolute left-0 -translate-x-1/2 top-1/2 -translate-y-1/2 w-5 h-5 bg-blue-500 rounded-full border-4 border-white shadow-lg z-20">
                              <div className="absolute left-1/2 -translate-x-1/2 top-6 text-xs font-semibold text-gray-700 whitespace-nowrap">
                                {new Date(timelineDocuments[0].letter_date).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </div>
                            </div>
                            
                            {/* End marker */}
                            <div className="absolute right-0 translate-x-1/2 top-1/2 -translate-y-1/2 w-5 h-5 bg-blue-500 rounded-full border-4 border-white shadow-lg z-20">
                              <div className="absolute left-1/2 -translate-x-1/2 top-6 text-xs font-semibold text-gray-700 whitespace-nowrap">
                                {new Date(timelineDocuments[timelineDocuments.length - 1].letter_date).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Outgoing Letters (Bottom) */}
                        <div className="absolute left-0 right-0" style={{ top: '225px', height: '160px' }}>
                          <div className="text-xs font-semibold text-red-700 mb-2 uppercase">
                            ↑ Outgoing (Gorkem)
                          </div>
                          <div className="relative h-full" style={{ paddingBottom: '50px' }}>
                            {timelineDocuments
                              .filter(doc => doc.inc_out === 'out')
                              .map((doc, index) => {
                                // Calculate position based on date range
                                const firstDate = new Date(timelineDocuments[0].letter_date).getTime();
                                const lastDate = new Date(timelineDocuments[timelineDocuments.length - 1].letter_date).getTime();
                                const docDate = new Date(doc.letter_date).getTime();
                                const totalRange = lastDate - firstDate || 1;
                                const position = ((docDate - firstDate) / totalRange) * 98 + 1;
                                
                                return (
                                  <div
                                    key={doc.id}
                                    className="group absolute"
                                    style={{ 
                                      left: `${position}%`,
                                      top: '25px',
                                      transform: 'translateX(-50%)'
                                    }}
                                  >
                                    {/* Connector line to timeline */}
                                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-0.5 h-6 bg-red-400"></div>
                                    
                                    {/* Document Node Circle */}
                                    <div 
                                      className="relative bg-red-500 border-2 border-red-700 rounded-full cursor-pointer hover:shadow-xl transition-all hover:scale-125 hover:z-50"
                                      style={{ width: '32px', height: '32px' }}
                                      onClick={() => handleNodeClickWithModal(doc.letter_no)}
                                    >
                                      {/* Vertical Date Label - Always Visible */}
                                      <div 
                                        className="absolute left-1/2 top-full mt-1 text-xs font-bold text-red-900 whitespace-nowrap"
                                        style={{ 
                                          writingMode: 'vertical-rl',
                                          textOrientation: 'upright',
                                          transform: 'translateX(-50%)',
                                          letterSpacing: '-0.05em'
                                        }}
                                      >
                                        {new Date(doc.letter_date).toLocaleDateString('en-US', { 
                                          month: 'short', 
                                          day: 'numeric'
                                        })}
                                      </div>
                                      
                                      {/* Hover tooltip with full info - Same style as Document Graph */}
                                      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-16 w-80 bg-white border-2 border-red-600 rounded-lg shadow-2xl p-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                        <div className="space-y-2 text-sm">
                                          <div className="flex items-center justify-between border-b pb-2">
                                            <span className="font-bold text-red-900">{doc.letter_no}</span>
                                            <span className="inline-block px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold">
                                              OUTGOING
                                            </span>
                                          </div>
                                          <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                              <span className="text-gray-500">Date:</span>
                                              <div className="font-semibold text-gray-900">
                                                {new Date(doc.letter_date).toLocaleDateString('en-US', { 
                                                  year: 'numeric', 
                                                  month: 'long', 
                                                  day: 'numeric' 
                                                })}
                                              </div>
                                            </div>
                                            {doc.ref_letters && (
                                              <div>
                                                <span className="text-gray-500">References:</span>
                                                <div className="font-semibold text-gray-900 truncate" title={doc.ref_letters}>
                                                  {doc.ref_letters}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                          {doc.short_desc && (
                                            <div className="pt-2 border-t">
                                              <span className="text-gray-500 text-xs">Description:</span>
                                              <div className="text-gray-900 text-xs mt-1">{doc.short_desc}</div>
                                            </div>
                                          )}
                                          <div className="pt-2 border-t flex gap-2">
                                            <button
                                              className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 transition-colors"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                addToDocumentBasket(doc.letter_no);
                                              }}
                                            >
                                              + Add to Basket
                                            </button>
                                            {doc.weburl && (
                                              <button
                                                className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-semibold hover:bg-blue-700 transition-colors"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  window.open(doc.weburl, '_blank');
                                                }}
                                              >
                                                Open
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Legend */}
                    <div className="mt-4 flex items-center justify-center gap-6 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                        <span>Incoming Letters</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                        <span>Outgoing Letters</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white"></div>
                        <span>Timeline Marker</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {timelineDocuments.length === 0 && !timelineLoading && !timelineError && (
                  <div className="text-center py-12 text-gray-500">
                    <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p>Enter a letter number to view its timeline</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis">
          <Card>
            <CardHeader>
              <CardTitle>Document Analysis</CardTitle>
              <CardDescription>
                Analyze selected documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* API Connection Status */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border">
                  {hasValidApis ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="text-sm text-gray-700">
                        API connection active 
                        {config?.apis.openai && <span className="text-xs text-gray-500 ml-1">(OpenAI)</span>}
                        {config?.apis.deepseek && <span className="text-xs text-gray-500 ml-1">(DeepSeek)</span>}
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-600" />
                      <span className="text-sm text-gray-700">
                        No API connection - Please add API key from settings
                      </span>
                    </>
                  )}
                </div>

                {/* Analyze button */}
                <div className="flex justify-between items-center">
                  <div className="text-sm text-gray-600">
                    {documentBasket.length} documents selected
                  </div>
                  <Button 
                    onClick={async () => {
                      if (selectedDocuments.size === 0) return;
                      
                      const { toast } = useToast();
                      
                      try {
                        // Get selected documents from basket
                        const selectedDocs = documentBasket.filter(doc => selectedDocuments.has(doc.id));
                        
                        if (selectedDocs.length === 0) {
                          toast({
                            title: 'No Documents Selected',
                            description: 'Please select documents to analyze.',
                            variant: 'destructive'
                          });
                          return;
                        }
                        
                        // Fetch full content for selected documents
                        const docsWithContent = await Promise.all(
                          selectedDocs.map(async (doc) => {
                            const { data, error } = await supabaseService.getClient()
                              .from('documents')
                              .select('id, letter_no, letter_date, short_desc, content, inc_out')
                              .eq('id', doc.id)
                              .single();
                            
                            if (error || !data) {
                              console.error(`Error fetching document ${doc.id}:`, error);
                              return null;
                            }
                            
                            return data;
                          })
                        );
                        
                        const validDocs = docsWithContent.filter(d => d !== null);
                        
                        if (validDocs.length === 0) {
                          toast({
                            title: 'Error',
                            description: 'Could not load document content for analysis.',
                            variant: 'destructive'
                          });
                          return;
                        }
                        
                        // Create combined content for analysis
                        const combinedContent = validDocs.map(doc => 
                          `DOCUMENT: ${doc.short_desc}\nTYPE: ${doc.inc_out === 'inc' ? 'Incoming' : 'Outgoing'}\nDATE: ${doc.letter_date}\nCONTENT:\n${doc.content || 'No content'}`
                        ).join('\n\n---\n\n');
                        
                        toast({
                          title: 'Analysis Started',
                          description: `Analyzing ${validDocs.length} documents with AI...`
                        });
                        
                        // Use DecisionSupportService for analysis
                        const decisionService = new DecisionSupportService();
                        const apiType = config?.apis.openai ? 'openai' : 'deepseek';
                        const analysis = await decisionService.analyzeCorrespondence(combinedContent, apiType);
                        
                        // Show analysis results
                        console.log('Analysis results:', analysis);
                        
                        toast({
                          title: 'Analysis Complete',
                          description: 'Document analysis has been completed successfully.',
                        });
                        
                        // TODO: Display analysis results in a modal or separate section
                        alert(`Analysis Complete!\n\nSummary: ${analysis.summary}\n\nRisk Level: ${analysis.risk_analysis.level}\n\nAction Suggestions: ${analysis.action_suggestions.join(', ')}`);
                        
                      } catch (error) {
                        console.error('Analysis error:', error);
                        toast({
                          title: 'Analysis Failed',
                          description: error instanceof Error ? error.message : 'An error occurred during analysis.',
                          variant: 'destructive'
                        });
                      }
                    }}
                    disabled={selectedDocuments.size === 0 || !hasValidApis}
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    Analyze ({selectedDocuments.size})
                  </Button>
                </div>

                {/* Document table */}
                {documentBasket.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No documents added yet. Hover over nodes in graphs and click 'Add to Basket' button to add documents.
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
                          <th className="border border-gray-300 px-4 py-2 text-center">Type</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Document No</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Date</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">References</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Description</th>
                          <th className="border border-gray-300 px-4 py-2 text-center">Preview</th>
                          <th className="border border-gray-300 px-4 py-2 text-center">Document</th>
                          <th className="border border-gray-300 px-4 py-2 text-left">Action</th>
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
                            <td className="border border-gray-300 px-4 py-2 text-center">
                              {doc.inc_out === 'inc' ? (
                                <Badge className="bg-green-500 text-white hover:bg-green-600">
                                  Incoming
                                </Badge>
                              ) : doc.inc_out === 'out' ? (
                                <Badge className="bg-red-500 text-white hover:bg-red-600">
                                  Outgoing
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  -
                                </Badge>
                              )}
                            </td>
                            <td className="border border-gray-300 px-4 py-2">{doc.letter_no}</td>
                            <td className="border border-gray-300 px-4 py-2">{doc.letter_date || '-'}</td>
                            <td className="border border-gray-300 px-4 py-2">{doc.ref_letters || '-'}</td>
                            <td className="border border-gray-300 px-4 py-2">{doc.short_desc || '-'}</td>
                            <td className="border border-gray-300 px-4 py-2 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePreviewDocument(doc.id, doc.letter_no)}
                                className="text-blue-600 hover:text-blue-800"
                                title="Preview document content"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenDocument(doc.weburl)}
                                disabled={!doc.weburl}
                                className="text-green-600 hover:text-green-800 disabled:text-gray-400"
                                title={doc.weburl ? "Open Document" : "URL not found"}
                              >
                                <FileText className="w-4 h-4" />
                              </Button>
                            </td>
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

      {/* Document Detail Modal */}
      <Dialog open={showDocumentModal} onOpenChange={setShowDocumentModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Document Details</DialogTitle>
          </DialogHeader>
          {selectedDocument && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold">Document No:</label>
                  <p>{selectedDocument.letter_no || '-'}</p>
                </div>
                <div>
                  <label className="font-semibold">Date:</label>
                  <p>{selectedDocument.letter_date || '-'}</p>
                </div>
                <div>
                  <label className="font-semibold">References:</label>
                  <p>{selectedDocument.ref_letters || '-'}</p>
                </div>
                <div>
                  <label className="font-semibold">Severity Level:</label>
                  <p>{selectedDocument.severity_rate || '-'}</p>
                </div>
                <div>
                  <label className="font-semibold">Correspondence Type:</label>
                  <p>{selectedDocument.type_of_corr || '-'}</p>
                </div>
                <div>
                  <label className="font-semibold">Incoming/Outgoing:</label>
                  <p>{selectedDocument.incout || '-'}</p>
                </div>
              </div>
              
              <div>
                <label className="font-semibold">Short Description:</label>
                <p className="mt-1">{selectedDocument.short_desc || '-'}</p>
              </div>
              
              <div>
                <label className="font-semibold">Content:</label>
                <div className="mt-1 p-3 bg-gray-50 rounded max-h-40 overflow-y-auto">
                  {selectedDocument.content || 'Content not found'}
                </div>
              </div>
              
              <div>
                <label className="font-semibold">Keywords:</label>
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

      {/* Document Preview Modal */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Document Preview: {previewContent?.letter_no}</DialogTitle>
          </DialogHeader>
          {previewContent && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {previewContent.content}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}