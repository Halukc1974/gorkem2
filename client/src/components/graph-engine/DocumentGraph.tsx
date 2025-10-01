import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { GraphNode, GraphEdge } from '../../services/graph-service';
import { useGraphCustomizationManager } from './hooks/useGraphCustomizationManager';
import { GraphContextMenu } from './components/GraphContextMenu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { filterPreviousCorrespondence, filterNextCorrespondence, filterAllCorrespondence } from './utils/filterData';
import { buildStarMapGraph } from '../../utils/documentGraphStarMap';
import { supabaseService } from '../../services/supabase';
// import { useSupabaseService } from '../../services/supabase'; // Kaldırıldı, kullanılmıyor

// Register dagre layout plugin
cytoscape.use(dagre);

interface DocumentGraphProps {
  data: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  onNodeClick: (nodeId: string) => void;
  // Optional prop to open a specific internal tab on mount (e.g. 'star-map')
  initialActiveTab?: string;
  // When true, force the internal tab to switch to 'star-map' (used by parent tabs)
  openStarMap?: boolean;
  // If provided, use this preloaded star-map data instead of fetching from supabase
  preloadedStarMap?: { nodes: any[]; edges: any[] } | null;
  // Callback for adding document to basket
  onAddToBasket?: (documentId: string) => void;
}

const createCyInstance = (
  container: HTMLDivElement,
  data: { nodes: GraphNode[]; edges: GraphEdge[] },
  onNodeClick: (id: string) => void,
  onContextMenu: (pos: { x: number; y: number }, nodeId: string | null) => void,
  onBackgroundClick: () => void
): cytoscape.Core => {
  // Build elements: original nodes + small top/bottom clones
  const builtNodes: any[] = [];
  const builtEdges: any[] = [];

  data.nodes.forEach(node => {
    // main node (mark as type 'main' so styling targets it)
    builtNodes.push({ data: { id: node.id, label: '', type: 'main', keywords: node.data.keywords || '', ...node.data } });

    // top clone (letter_no)
    const topId = `${node.id}__top`;
    builtNodes.push({ data: { id: topId, label: '', type: 'letter_no', letterNo: (node.data as any).letterNo || (node.data as any).letter_no || '', _originalId: node.id }, classes: 'clone' });

    // bottom clone (letter_date)
    const bottomId = `${node.id}__bottom`;
    builtNodes.push({ data: { id: bottomId, label: '', type: 'letter_date', letterDate: (node.data as any).date || (node.data as any).letter_date || '', _originalId: node.id }, classes: 'clone' });

    // invisible stack edges
    builtEdges.push({ data: { id: `${topId}->${node.id}`, source: topId, target: node.id, type: 'stack' }, classes: 'stack' });
    builtEdges.push({ data: { id: `${node.id}->${bottomId}`, source: node.id, target: bottomId, type: 'stack' }, classes: 'stack' });
  });

  data.edges.forEach(edge => builtEdges.push({ data: { id: edge.id, source: edge.source, target: edge.target, type: edge.type } }));

  const instance = cytoscape({
    container,
    elements: {
      nodes: builtNodes,
      edges: builtEdges
    },
    style: [
      {
        selector: 'node[type="main"]',
        style: {
          'background-color': '#22c55e',
          'border-width': 2,
          'border-color': '#16a34a',
          'width': '140px',
          'height': '140px',
          'shape': 'roundrectangle',
          'content': function(ele: cytoscape.NodeSingular) {
            const keywords = ele.data('keywords');
            let text = '';
            if (Array.isArray(keywords)) {
              text = keywords.slice(0, 5).join(', ');
            } else if (keywords) {
              text = String(keywords).split(',').slice(0, 5).join(', ');
            }

            const maxLength = 120; // Toplam karakter sınırı
            const maxLines = 4; // Maksimum satır sayısı

            if (text.length > maxLength) {
              const words = text.split(' ');
              let result = '';
              let currentLine = '';
              let lineCount = 0;

              for (const word of words) {
                if (lineCount >= maxLines) {
                  break;
                }

                if ((currentLine + ' ' + word).length > 30) { // Her satır için yaklaşık 30 karakter
                  result += (result ? '\\n' : '') + currentLine;
                  currentLine = word;
                  lineCount++;
                } else {
                  currentLine += (currentLine ? ' ' : '') + word;
                }
              }

              if (currentLine && lineCount < maxLines) {
                result += (result ? '\\n' : '') + currentLine;
              }

              return result + (text.length > maxLength ? '...' : '');
            }

            return text;
          },
          'text-wrap': 'wrap',
          'text-max-width': '120px',
          'text-overflow-wrap': 'anywhere',
          'text-valign': 'center',
          'text-halign': 'center',
          'padding': '6px',
          'color': '#000000',
          'font-size': '8px',
          'font-weight': 'normal',
          'text-background-opacity': 0,
          'text-outline-width': 0,
          'text-margin-x': 2,
          'text-margin-y': 2,
          'text-transform': 'none',
          'z-index': 10
        }
      },
      {
        selector: 'edge',
        style: {
          'curve-style': 'bezier'
        }
      },
      {
        selector: 'edge.stack',
        style: {
          'line-color': 'transparent',
          'opacity': 0,
          'width': 1,
          'target-arrow-shape': 'none'
        }
      },
      {
        selector: 'node[type="letter_no"]',
        style: {
          'background-color': 'transparent',
          'background-opacity': 0,
          'border-width': '0px',
          'border-color': 'transparent',
          'border-opacity': 0,
          'width': '100px',
          'height': '1px',
          'shape': 'rectangle',
          'content': function(ele: cytoscape.NodeSingular) {
            return ele.data('letterNo') || ele.data('letter_no') || '';
          },
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '8px',
          'color': '#6B7280',
          'events': 'no',
          'z-index': -1
        }
      },
      {
        selector: 'node[type="letter_date"]',
        style: {
          'background-color': 'transparent',
          'background-opacity': 0,
          'border-width': '0px',
          'border-color': 'transparent',
          'border-opacity': 0,
          'width': '100px',
          'height': '1px',
          'shape': 'rectangle',
          'content': function(ele: cytoscape.NodeSingular) {
            return ele.data('letterDate') || ele.data('letter_date') || '';
          },
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '8px',
          'color': '#6B7280',
          'events': 'no',
          'z-index': -1
        }
      },
      {
        selector: 'node.clone',
        style: {
          'background-color': 'transparent',
          'background-opacity': 0,
          'border-width': '0px',
          'border-color': 'transparent',
          'border-opacity': 0,
          'padding': '1px',
          'width': '100px',
          'height': '1px',
          'color': '#6B7280',
          'font-size': '8px',
          'events': 'no',
          'z-index': -1
        }
      }
    ],
    layout: {
      name: 'dagre',
      rankDir: 'TB',
      padding: 10,
      spacingFactor: 1.5,
      animate: false,
      rankSep: 100,
      nodeSep: 50,
      edgeSep: 50,
      fit: true
    } as any,
    wheelSensitivity: 1,
    minZoom: 0.1,
    maxZoom: 4,
    autoungrabify: false,
    userZoomingEnabled: true,
    userPanningEnabled: true
  });

  // After layout completes, position clones relative to their main node and lock them
  instance.on('layoutstop', () => {
    try {
      // We'll attempt to position clones and then watch for stabilization for a few frames.
      const gap = 1; // small gap for clarity

      const positionClonesOnce = () => {
        data.nodes.forEach(node => {
          const mainId = node.id;
          const topId = `${mainId}__top`;
          const bottomId = `${mainId}__bottom`;

          const mainEle = instance.getElementById(mainId);
          const topEle = instance.getElementById(topId);
          const bottomEle = instance.getElementById(bottomId);

          if (!mainEle || !topEle || !bottomEle) return;

          // Prefer boundingBox() which is layout-stable; fallback to renderedBoundingBox
          const mainPos = mainEle.position();
          const mainBB = (typeof mainEle.boundingBox === 'function') ? mainEle.boundingBox() : mainEle.renderedBoundingBox();
          const topBB = (typeof topEle.boundingBox === 'function') ? topEle.boundingBox() : topEle.renderedBoundingBox();

          // set positions relative to main node
          topEle.position({ x: mainPos.x, y: mainPos.y - (mainBB.h / 2) - (topBB.h / 5) - gap });
          bottomEle.position({ x: mainPos.x, y: mainPos.y + (mainBB.h / 2) + (topBB.h / 5) + gap });

          // lock clones so they move only when main node moves programmatically
          try { topEle.lock(); bottomEle.lock(); } catch (e) { /* ignore if already locked */ }
        });
      };

      // run a small RAF loop to allow CSS/renderer to settle
      let frames = 0;
      const maxFrames = 6;
      const rafLoop = () => {
        positionClonesOnce();
        frames += 1;
        if (frames < maxFrames) requestAnimationFrame(rafLoop);
      };
      requestAnimationFrame(rafLoop);
    } catch (err) {
      // ignore positioning errors but keep app stable
      // console.warn('layoutstop clone positioning failed', err);
    }
  });

  // Whenever a main node's position changes (e.g. user drags it), update its clones
  instance.on('position', 'node[type="main"]', (evt: any) => {
    try {
      const main = evt.target as cytoscape.NodeSingular;
      const mainId = main.id();
      const topEle = instance.getElementById(`${mainId}__top`);
      const bottomEle = instance.getElementById(`${mainId}__bottom`);
      if (!topEle || !bottomEle) return;

      const mainPos = main.position();
      const mainBB = (typeof main.boundingBox === 'function') ? main.boundingBox() : main.renderedBoundingBox();
      const topBB = (typeof topEle.boundingBox === 'function') ? topEle.boundingBox() : topEle.renderedBoundingBox();
      const gap = 1;

      // Unlock briefly so position can be set, then re-lock
      try { topEle.unlock(); bottomEle.unlock(); } catch (e) {}
      topEle.position({ x: mainPos.x, y: mainPos.y - (mainBB.h / 2) - (topBB.h / 5) - gap });
      bottomEle.position({ x: mainPos.x, y: mainPos.y + (mainBB.h / 2) + (topBB.h / 5) + gap });
      try { topEle.lock(); bottomEle.lock(); } catch (e) {}
    } catch (err) {
      // ignore
    }
  });

  instance.on('tap', 'node', evt => {
    evt.preventDefault();
    onNodeClick(evt.target.id());
  });

  instance.on('cxttap', 'node, edge', evt => {
    evt.preventDefault();
    evt.stopPropagation();
    const renderedPosition = evt.renderedPosition;
    
    const containerBounds = container.getBoundingClientRect();
    const x = renderedPosition.x + containerBounds.left;
    const y = renderedPosition.y + containerBounds.top;
    
    onContextMenu(
      { x, y },
      evt.target.isNode() ? evt.target.id() : null
    );
  });

  // Prevent browser context menu
  instance.on('cxttapstart', (evt: any) => {
    evt.preventDefault();
    evt.stopPropagation();
    evt.stopImmediatePropagation();
  });

  // Also prevent on the container
  container.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
  }, true); // Use capture phase

  instance.on('tap', evt => {
    if (evt.target === instance) {
      onBackgroundClick();
    }
  });

  return instance;
};

export function DocumentGraph({ data, onNodeClick, initialActiveTab, openStarMap, preloadedStarMap, onAddToBasket }: DocumentGraphProps) {
  // Belge haritası için state
  const starMapCyRef = useRef<HTMLDivElement>(null);
  const [starMapLoading, setStarMapLoading] = useState(false);
  const [starMapError, setStarMapError] = useState<string | null>(null);
  const [starMapData, setStarMapData] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [starMapCy, setStarMapCy] = useState<cytoscape.Core | null>(null);
  // Tooltip state for star-map nodes
  const [starTooltip, setStarTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    title?: string;
    body?: string;
  }>({ visible: false, x: 0, y: 0, title: undefined, body: undefined });
  // Context menu state for star-map
  const [starContextMenu, setStarContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    nodeId?: string;
  }>({ visible: false, x: 0, y: 0 });
  // Refs for graph containers
  const previousCyRef = useRef<HTMLDivElement>(null);
  const nextCyRef = useRef<HTMLDivElement>(null);
  const allCyRef = useRef<HTMLDivElement>(null);
  
  // Filtered data states
  const [filteredData, setFilteredData] = useState<{
    previous: DocumentGraphProps['data'];
    next: DocumentGraphProps['data'];
    all: DocumentGraphProps['data'];
  }>({ 
    previous: { nodes: [], edges: [] },
    next: { nodes: [], edges: [] },
    all: { nodes: [], edges: [] }
  });
  
  // Cytoscape instances
  const [previousCy, setPreviousCy] = useState<cytoscape.Core | null>(null);
  const [nextCy, setNextCy] = useState<cytoscape.Core | null>(null);
  const [allCy, setAllCy] = useState<cytoscape.Core | null>(null);

  // Filter data once when it changes
  useEffect(() => {
    if (!data) return;
    
    console.log('Initial data received:', data);
    setFilteredData({
      previous: filterPreviousCorrespondence(data),
      next: filterNextCorrespondence(data),
      all: filterAllCorrespondence(data)
    });
  }, [data]);
  
  // UI state
  const [contextMenuPosition, setContextMenuPosition] = useState<{x: number, y: number} | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(initialActiveTab || "previous");
  const [showGraphContextMenu, setShowGraphContextMenu] = useState(false);

  // If parent asks to open the star map, switch internal tab to 'star-map'
  useEffect(() => {
    if (openStarMap) {
      setActiveTab('star-map');
    }
  }, [openStarMap]);
  // Belge haritası verisini Supabase'den çek veya preloaded veriyi kullan
  useEffect(() => {
    if (activeTab !== 'star-map') return;
    setStarMapLoading(true);
    setStarMapError(null);

    const load = async () => {
      try {
        if (preloadedStarMap && preloadedStarMap.nodes && preloadedStarMap.edges) {
          setStarMapData({ nodes: preloadedStarMap.nodes, edges: preloadedStarMap.edges });
          setStarMapLoading(false);
          return;
        }

        const records = await supabaseService.getAllDocumentRelations();
        const graph = buildStarMapGraph(records);
        setStarMapData({ nodes: graph.nodes, edges: graph.edges });
        setStarMapLoading(false);
      } catch (err: any) {
        setStarMapError(String(err));
        setStarMapLoading(false);
      }
    };

    load();
  }, [activeTab, preloadedStarMap]);
  // Belge haritası cytoscape instance'ı oluştur
  useEffect(() => {
    if (activeTab !== 'star-map' || !starMapCyRef.current || !starMapData.nodes.length) return;
    // Cytoscape force-directed layout
    const instance = cytoscape({
      container: starMapCyRef.current,
      elements: {
        // include useful metadata on nodes so hover can show readable content
        nodes: starMapData.nodes.map(n => ({ data: { id: n.id, letter_date: n.letter_date, letter_no: n.letter_no, ref_letters: n.ref_letters, content: n.content, title: n.title || n.id } })),
        edges: starMapData.edges.map(e => ({ data: { source: e.source, target: e.target } }))
      },
      style: [
        // Improved node style for readability: white background, dark text, blue border
  { selector: 'node', style: { 'background-color': '#ffffff', 'width': 28, 'height': 28, 'label': 'data(id)', 'color': '#0f172a', 'font-size': 10, 'font-weight': 'bold', 'text-valign': 'center', 'text-halign': 'center', 'border-width': 2, 'border-color': '#0ea5e9' } },
        { selector: 'edge', style: { 'line-color': '#facc15', 'width': 2 } }
      ],
      layout: { name: 'cose', animate: true, fit: true },
      minZoom: 0.1,
      maxZoom: 10
    });
    setStarMapCy(instance);
    // Attach tooltip handlers
    const onMouseOver = (evt: any) => {
      try {
        const node = evt.target;
        if (!node || !node.isNode || !node.isNode()) return;

        const renderedPosition = evt.renderedPosition || node.renderedPosition();
        const containerBounds = starMapCyRef.current?.getBoundingClientRect();
        const pageX = containerBounds ? renderedPosition.x + containerBounds.left : renderedPosition.x;
        const pageY = containerBounds ? renderedPosition.y + containerBounds.top : renderedPosition.y;

        const data = node.data() || {};
        // Title olarak letter_no'yu kullan, yoksa id'yi
        const title = data.letter_no || data.id || '';
        
        // Body'de letter_date, ref_letters ve content'i göster
        const parts: string[] = [];
        if (data.letter_date) parts.push(`Tarih: ${data.letter_date}`);
        if (data.ref_letters) parts.push(`Referanslar: ${Array.isArray(data.ref_letters) ? data.ref_letters.join(', ') : data.ref_letters}`);
        if (data.content) parts.push(`İçerik: ${String(data.content).slice(0, 500)}${String(data.content).length > 500 ? '...' : ''}`);

        setStarTooltip({ visible: true, x: pageX + 12, y: pageY + 12, title, body: parts.join('\n\n') });
      } catch (e) {
        // ignore hover errors
      }
    };    const onMouseOut = () => {
      setStarTooltip(prev => ({ ...prev, visible: false }));
    };

    instance.on('mouseover', 'node', onMouseOver);
    instance.on('mouseout', 'node', onMouseOut);
    
    // Add click handler for star-map nodes (single click)
    instance.on('tap', 'node', (evt: any) => {
      evt.preventDefault();
      const nodeId = evt.target.id();
      if (onNodeClick) {
        onNodeClick(nodeId);
      }
    });
    
    // Add context menu for star-map (right click)
    instance.on('cxttap', 'node', (evt: any) => {
      evt.preventDefault();
      evt.stopPropagation();
      const renderedPosition = evt.renderedPosition;
      const containerBounds = starMapCyRef.current?.getBoundingClientRect();
      const x = containerBounds ? renderedPosition.x + containerBounds.left : renderedPosition.x;
      const y = containerBounds ? renderedPosition.y + containerBounds.top : renderedPosition.y;
      
      setStarContextMenu({
        visible: true,
        x,
        y,
        nodeId: evt.target.id()
      });
    });
    
    // Close context menu on background click
    instance.on('tap', (evt: any) => {
      if (evt.target === instance) {
        setStarContextMenu({ visible: false, x: 0, y: 0 });
      }
    });
    
    // Prevent browser context menu on cytoscape events
    instance.on('cxttapstart', (evt: any) => {
      evt.preventDefault();
      evt.stopPropagation();
    });
    
    // Cleanup function
    return () => {
      try {
        instance.off('mouseover');
        instance.off('mouseout');
        instance.off('tap');
        instance.off('cxttap');
        instance.off('cxttapstart');
      } catch (e) {}
      instance.destroy();
      setStarMapCy(null);
    };
  }, [activeTab, starMapData, onNodeClick]);

  // Graph customization
  const { 
    updateNodeStyles: updatePreviousNodeStyles, 
    updateEdgeStyles: updatePreviousEdgeStyles, 
    updateLayout: updatePreviousLayout 
  } = useGraphCustomizationManager(previousCy);

  const { 
    updateNodeStyles: updateNextNodeStyles, 
    updateEdgeStyles: updateNextEdgeStyles, 
    updateLayout: updateNextLayout 
  } = useGraphCustomizationManager(nextCy);

  const { 
    updateNodeStyles: updateAllNodeStyles, 
    updateEdgeStyles: updateAllEdgeStyles, 
    updateLayout: updateAllLayout 
  } = useGraphCustomizationManager(allCy);

  // Initialize previous correspondence graph - only when data changes
  useEffect(() => {
    if (!previousCyRef.current || !filteredData.previous) return;

    console.log('Previous graph initializing with data:', filteredData.previous);
    
    // Prevent browser context menu on container
    const container = previousCyRef.current;
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };
    container.addEventListener('contextmenu', preventContextMenu, true);
    
    const instance = createCyInstance(
      previousCyRef.current,
      filteredData.previous,
      onNodeClick,
      (position, nodeId) => {
        setContextMenuPosition(position);
        setSelectedNodeId(nodeId);
      },
      () => {
        setContextMenuPosition(null);
        setSelectedNodeId(null);
      }
    );
    setPreviousCy(instance);

    return () => {
      // Sadece component unmount olduğunda temizle
      container.removeEventListener('contextmenu', preventContextMenu, true);
      if (previousCyRef.current) {
        instance.destroy();
        setPreviousCy(null);
      }
    };
  }, [filteredData.previous, onNodeClick]);

  // Initialize next correspondence graph - only when data changes
  useEffect(() => {
    if (!nextCyRef.current || !filteredData.next) return;

    console.log('Next graph initializing with data:', filteredData.next);
    
    // Prevent browser context menu on container
    const container = nextCyRef.current;
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };
    container.addEventListener('contextmenu', preventContextMenu, true);
    
    const instance = createCyInstance(
      nextCyRef.current,
      filteredData.next,
      onNodeClick,
      (position, nodeId) => {
        setContextMenuPosition(position);
        setSelectedNodeId(nodeId);
      },
      () => {
        setContextMenuPosition(null);
        setSelectedNodeId(null);
      }
    );

    setNextCy(instance);

    return () => {
      // Sadece component unmount olduğunda temizle
      container.removeEventListener('contextmenu', preventContextMenu, true);
      if (nextCyRef.current) {
        instance.destroy();
        setNextCy(null);
      }
    };
  }, [filteredData.next, onNodeClick]);

  // Initialize all correspondence graph - only when data changes
  useEffect(() => {
    if (!allCyRef.current || !filteredData.all) return;

    console.log('All graph initializing with data:', filteredData.all);
    
    // Prevent browser context menu on container
    const container = allCyRef.current;
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };
    container.addEventListener('contextmenu', preventContextMenu, true);
    
    const instance = createCyInstance(
      allCyRef.current,
      filteredData.all,
      onNodeClick,
      (position, nodeId) => {
        setContextMenuPosition(position);
        setSelectedNodeId(nodeId);
      },
      () => {
        setContextMenuPosition(null);
        setSelectedNodeId(null);
      }
    );

    setAllCy(instance);

    return () => {
      // Sadece component unmount olduğunda temizle
      container.removeEventListener('contextmenu', preventContextMenu, true);
      if (allCyRef.current) {
        instance.destroy();
        setAllCy(null);
      }
    };
  }, [filteredData.all, onNodeClick]);

  // Update styles when graph customization changes
  useEffect(() => {
    if (previousCy) {
      updatePreviousNodeStyles();
      updatePreviousEdgeStyles();
      updatePreviousLayout();
    }
  }, [previousCy, updatePreviousNodeStyles, updatePreviousEdgeStyles, updatePreviousLayout]);

  useEffect(() => {
    if (nextCy) {
      updateNextNodeStyles();
      updateNextEdgeStyles();
      updateNextLayout();
    }
  }, [nextCy, updateNextNodeStyles, updateNextEdgeStyles, updateNextLayout]);

  useEffect(() => {
    if (allCy) {
      updateAllNodeStyles();
      updateAllEdgeStyles();
      updateAllLayout();
    }
  }, [allCy, updateAllNodeStyles, updateAllEdgeStyles, updateAllLayout]);

  // Sekme değiştiğinde grafikleri göster/gizle
  useEffect(() => {
    // Sekme değiştiğinde aktif grafiği güncelle
    const activeGraph = {
      previous: previousCy,
      next: nextCy,
      all: allCy
    }[activeTab];

    if (activeGraph) {
      // Küçük bir gecikme ile grafiği güncelle (DOM güncellemesinin tamamlanmasını bekle)
      setTimeout(() => {
        activeGraph.resize();
        activeGraph.fit();
      }, 50);
    }
  }, [activeTab, previousCy, nextCy, allCy]);

  // Close context menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Check if click is outside context menus
      const target = e.target as HTMLElement;
      const isContextMenu = target.closest('[data-context-menu]');
      
      if (!isContextMenu) {
        setContextMenuPosition(null);
        setSelectedNodeId(null);
        setStarContextMenu({ visible: false, x: 0, y: 0 });
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <Tabs 
      defaultValue="previous" 
      className="w-full"
      value={activeTab}
      onValueChange={setActiveTab}
    >
      <TabsList className="mb-4">
        {/* <TabsTrigger value="previous">Önceki Yazışmalar</TabsTrigger>
        <TabsTrigger value="next">Sonraki Yazışmalar</TabsTrigger>
        <TabsTrigger value="all">Tüm Yazışmalar</TabsTrigger> */}
  {/* internal star-map trigger removed; top-level tab will provide the star-map */}
      </TabsList>
      {/* Star-map container (no internal tab trigger). This allows the component to mount
          the cytoscape star-map when `initialActiveTab="star-map"` is passed from above.
          It's hidden unless internal activeTab === 'star-map'. */}
      <div style={{ position: 'relative', display: activeTab === 'star-map' ? 'block' : 'none' }}>
        <div 
          ref={starMapCyRef}
          onContextMenu={(e) => {
            // Sadece container'ın kendisinde browser menüsünü engelle
            // Node'larda Cytoscape'in cxttap eventi bizim menümüzü gösterecek
            if (e.target === e.currentTarget) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          style={{ 
            width: '100%', 
            height: '600px',
            backgroundColor: '#f6fafcff',
            borderRadius: '0.5rem',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
            position: 'relative',
            overflow: 'hidden',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            MozUserSelect: 'none',
            msUserSelect: 'none'
          }} 
        >
          {starMapLoading && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', color: '#64748b' }}>
              Belge haritası yükleniyor...
            </div>
          )}
          {starMapError && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', color: 'red' }}>
              {starMapError}
            </div>
          )}
          {!starMapLoading && !starMapError && !starMapData.nodes.length && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', color: '#64748b' }}>
              Hiç belge ilişkisi bulunamadı
            </div>
          )}
        </div>
        
        {/* Star-map context menu */}
        {starContextMenu.visible && (
          <div
            data-context-menu="true"
            style={{
              position: 'fixed',
              top: starContextMenu.y,
              left: starContextMenu.x,
              zIndex: 2000,
              background: 'white',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              minWidth: '180px'
            }}
          >
            <div style={{ padding: '4px 0' }}>
              {starContextMenu.nodeId && onAddToBasket && (
                <button
                  onClick={() => {
                    onAddToBasket(starContextMenu.nodeId!);
                    setStarContextMenu({ visible: false, x: 0, y: 0 });
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 16px',
                    textAlign: 'left',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  📄 Belgeyi Sepete Ekle
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <TabsContent value="previous" className="mt-0" forceMount>
        <div style={{ position: 'relative', display: activeTab === 'previous' ? 'block' : 'none' }}>
          <div 
            ref={previousCyRef}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }}
            onMouseDown={(e) => {
              if (e.button === 2) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            style={{ 
              width: '100%', 
              height: '600px',
              backgroundColor: '#f6fafcff',
              borderRadius: '0.5rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              position: 'relative',
              overflow: 'hidden',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none'
            }} 
          >
            {!data?.nodes?.length && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                color: '#64748b'
              }}>
                Önceki yazışmalar bulunamadı veya yüklenemiyor
              </div>
            )}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="next" className="mt-0" forceMount>
        <div style={{ position: 'relative', display: activeTab === 'next' ? 'block' : 'none' }}>
          <div 
            ref={nextCyRef}
            onContextMenu={(e) => {
              // Sadece container'ın kendisinde browser menüsünü engelle
              if (e.target === e.currentTarget) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            style={{ 
              width: '100%', 
              height: '600px',
              backgroundColor: '#f6fafcff',
              borderRadius: '0.5rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              position: 'relative',
              overflow: 'hidden',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none'
            }} 
          >
            {!data?.nodes?.length && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                color: '#64748b'
              }}>
                Sonraki yazışmalar bulunamadı veya yüklenemiyor
              </div>
            )}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="all" className="mt-0" forceMount>
        <div style={{ position: 'relative', display: activeTab === 'all' ? 'block' : 'none' }}>
          <div 
            ref={allCyRef}
            onContextMenu={(e) => {
              // Sadece container'ın kendisinde browser menüsünü engelle
              if (e.target === e.currentTarget) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            style={{ 
              width: '100%', 
              height: '600px',
              backgroundColor: '#f6fafcff',
              borderRadius: '0.5rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              position: 'relative',
              overflow: 'hidden',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none'
            }} 
          >
            {!data?.nodes?.length && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                color: '#64748b'
              }}>
                Tüm yazışmalar bulunamadı veya yüklenemiyor
              </div>
            )}
          </div>
        </div>
      </TabsContent>

      {contextMenuPosition && (
        <div
          data-context-menu="true"
          style={{
            position: 'fixed',
            top: contextMenuPosition.y,
            left: contextMenuPosition.x,
            zIndex: 2000,
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            minWidth: '180px'
          }}
        >
          <div style={{ padding: '4px 0' }}>
            {selectedNodeId && onAddToBasket && (
              <button
                onClick={() => {
                  onAddToBasket(selectedNodeId);
                  setContextMenuPosition(null);
                  setSelectedNodeId(null);
                }}
                style={{
                  width: '100%',
                  padding: '8px 16px',
                  textAlign: 'left',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                📄 Belgeyi Sepete Ekle
              </button>
            )}
            <button
              onClick={() => {
                // GraphContextMenu'yu açmak için state ekleyeceğim
                setShowGraphContextMenu(true);
                setContextMenuPosition(null);
              }}
              style={{
                width: '100%',
                padding: '8px 16px',
                textAlign: 'left',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '14px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              ⚙️ Grafik Özelleştirmeleri
            </button>
          </div>
        </div>
      )}

      {showGraphContextMenu && (
        <GraphContextMenu
          onClose={() => setShowGraphContextMenu(false)}
          selectedNodeId={selectedNodeId}
        />
      )}
      {/* Star-map tooltip rendered via React so we can style it easily */}
      {starTooltip.visible && (
        <div
          role="tooltip"
          style={{
            position: 'fixed',
            top: starTooltip.y,
            left: starTooltip.x,
            zIndex: 2000,
            background: 'white',
            padding: '10px',
            borderRadius: 8,
            boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
            maxWidth: 420,
            fontSize: 13,
            color: '#0f172a',
            whiteSpace: 'pre-wrap',
            pointerEvents: 'none'
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{starTooltip.title}</div>
          <div style={{ lineHeight: 1.4 }}>{starTooltip.body}</div>
        </div>
      )}
    </Tabs>
  );
}
