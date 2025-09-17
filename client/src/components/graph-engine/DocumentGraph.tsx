import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { GraphNode, GraphEdge } from '../../services/graph-service';
import { useGraphCustomizationManager } from './hooks/useGraphCustomizationManager';
import { GraphContextMenu } from './components/GraphContextMenu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { filterPreviousCorrespondence, filterNextCorrespondence, filterAllCorrespondence } from './utils/filterData';

// Register dagre layout plugin
cytoscape.use(dagre);

interface DocumentGraphProps {
  data: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  onNodeClick: (nodeId: string) => void;
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
          'height': '20px',
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
          'height': '20px',
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
          'height': '20px',
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
      data.nodes.forEach(node => {
        const mainId = node.id;
        const topId = `${mainId}__top`;
        const bottomId = `${mainId}__bottom`;

        const mainEle = instance.getElementById(mainId);
        const topEle = instance.getElementById(topId);
        const bottomEle = instance.getElementById(bottomId);

        if (!mainEle || !topEle || !bottomEle) return;

        const mainPos = mainEle.position();
        const mainBB = mainEle.renderedBoundingBox();
        const topBB = topEle.renderedBoundingBox();
        const gap = 1; // almost zero gap for tight positioning

        // place top clone above main
        topEle.position({ x: mainPos.x, y: mainPos.y - (mainBB.h / 2) - (topBB.h / 2) - gap });
        // place bottom clone below main
        bottomEle.position({ x: mainPos.x, y: mainPos.y + (mainBB.h / 2) + (topBB.h / 2) + gap });

        // Do not lock clones; instead keep them non-interactive and let position handlers
        // move them together with their main node when the main node moves.
        // (clones are non-interactive via 'events': 'no' style)
      });
    } catch (err) {
      // ignore positioning errors
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
      const mainBB = main.renderedBoundingBox();
      const topBB = topEle.renderedBoundingBox();
      const gap = 1; // almost zero gap for tight positioning

      topEle.position({ x: mainPos.x, y: mainPos.y - (mainBB.h / 2) - (topBB.h / 2) - gap });
      bottomEle.position({ x: mainPos.x, y: mainPos.y + (mainBB.h / 2) + (topBB.h / 2) + gap });
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
    const renderedPosition = evt.renderedPosition;
    
    const containerBounds = container.getBoundingClientRect();
    const x = renderedPosition.x + containerBounds.left;
    const y = renderedPosition.y + containerBounds.top;
    
    onContextMenu(
      { x, y },
      evt.target.isNode() ? evt.target.id() : null
    );
  });

  instance.on('tap', evt => {
    if (evt.target === instance) {
      onBackgroundClick();
    }
  });

  return instance;
};

export function DocumentGraph({ data, onNodeClick }: DocumentGraphProps) {
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
  const [activeTab, setActiveTab] = useState<string>("previous");

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

  return (
    <Tabs 
      defaultValue="previous" 
      className="w-full"
      value={activeTab}
      onValueChange={setActiveTab}
    >
      <TabsList className="mb-4">
        <TabsTrigger value="previous">Önceki Yazışmalar</TabsTrigger>
        <TabsTrigger value="next">Sonraki Yazışmalar</TabsTrigger>
        <TabsTrigger value="all">Tüm Yazışmalar</TabsTrigger>
      </TabsList>

      <TabsContent value="previous" className="mt-0" forceMount>
        <div style={{ position: 'relative', display: activeTab === 'previous' ? 'block' : 'none' }}>
          <div 
            ref={previousCyRef}
            onContextMenu={(e) => e.preventDefault()}
            style={{ 
              width: '100%', 
              height: '600px',
              backgroundColor: '#f6fafcff',
              borderRadius: '0.5rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              position: 'relative',
              overflow: 'hidden'
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
            onContextMenu={(e) => e.preventDefault()}
            style={{ 
              width: '100%', 
              height: '600px',
              backgroundColor: '#f6fafcff',
              borderRadius: '0.5rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              position: 'relative',
              overflow: 'hidden'
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
            onContextMenu={(e) => e.preventDefault()}
            style={{ 
              width: '100%', 
              height: '600px',
              backgroundColor: '#f6fafcff',
              borderRadius: '0.5rem',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
              position: 'relative',
              overflow: 'hidden'
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
          style={{
            position: 'fixed',
            top: contextMenuPosition.y,
            left: contextMenuPosition.x,
            zIndex: 1000
          }}
        >
          <GraphContextMenu
            onClose={() => setContextMenuPosition(null)}
            selectedNodeId={selectedNodeId}
          />
        </div>
      )}
    </Tabs>
  );
}
