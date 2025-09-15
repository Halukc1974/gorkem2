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
  data: DocumentGraphProps['data'],
  onNodeClick: (nodeId: string) => void,
  onContextMenu: (position: { x: number; y: number }, nodeId: string | null) => void,
  onBackgroundClick: () => void
) => {
  const instance = cytoscape({
    container,
    elements: {
      nodes: data.nodes.map(node => ({
        data: { 
          id: node.id,
          label: '',
          keywords: node.data.keywords || '',
          ...node.data
        }
      })),
      edges: data.edges.map(edge => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type
        }
      }))
    },
    style: [
      {
        selector: 'node',
        style: {
          'background-color': '#22c55e',
          'border-width': 2,
          'border-color': '#16a34a',
          'width': '200px',
          'height': '80px',
          'shape': 'roundrectangle',
          'content': function(ele: cytoscape.NodeSingular) {
            const keywords = ele.data('keywords');
            let text = '';
            if (Array.isArray(keywords)) {
              text = keywords.slice(0, 5).join(', ');
            } else if (keywords) {
              text = String(keywords).split(',').slice(0, 5).join(', ');
            }
            
            // Kelime bölme olmadan metin sığdırma
            const maxLength = 80;
            if (text.length > maxLength) {
              const words = text.split(' ');
              let result = '';
              let line = '';
              
              for (const word of words) {
                if ((line + word).length > maxLength) {
                  if (result) result += '\\n';
                  result += line;
                  line = word;
                } else {
                  if (line) line += ' ';
                  line += word;
                }
              }
              
              if (line) {
                if (result) result += '\\n';
                result += line;
              }
              
              return result;
            }
            
            return text;
          },
          'text-wrap': 'wrap',
          'text-max-width': '180px',
          'text-overflow-wrap': 'whitespace',
          'text-valign': 'center',
          'text-halign': 'center',
          'color': '#000000',
          'font-size': '11px',
          'font-weight': 'normal',
          'text-background-opacity': 0,
          'text-outline-width': 0,
          'padding': '8px',
          'text-margin-x': 5,
          'text-margin-y': 0,
          'text-transform': 'none',
          'text-line-spacing': 1.2,
          'z-index': 10
        }
      },
      {
        selector: 'edge',
        style: {
          'curve-style': 'bezier'
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
