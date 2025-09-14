/** @jsxImportSource react */
import { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { GraphNode, GraphEdge } from '../../services/graph-service';
import { useGraphCustomization } from './context/GraphCustomizationContext';
import { useGraphCustomizationManager } from './hooks/useGraphCustomizationManager';
import { GraphContextMenu } from './components/GraphContextMenu';

// dagre layout plugin'ini kaydet
cytoscape.use(dagre);

interface DocumentGraphProps {
  data: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  onNodeClick: (nodeId: string) => void;
}

export function DocumentGraph({ data, onNodeClick }: DocumentGraphProps) {
  const cyRef = useRef(null);
  const [cy, setCy] = useState<cytoscape.Core | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{x: number, y: number} | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const { updateNodeStyles, updateEdgeStyles, updateLayout } = useGraphCustomizationManager(cy);
  
  useEffect(() => {
    if (!cyRef.current || !data) return;

    const cyInstance = cytoscape({
      container: cyRef.current,
      elements: {
        nodes: data.nodes.map(node => ({
          data: {
            id: node.id,
            label: `${node.data.letterNo}\n${node.data.date}`,
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
            'label': 'data(label)',
            'text-wrap': 'wrap',
            'text-max-width': '80px',
            'text-valign': 'center',
            'text-halign': 'center',
            'padding': '10px'
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
        // @ts-ignore - dagre layout tipleri
        fit: true,
        padding: 10,
        animate: false,
        refresh: 1,
        randomize: false
      },
      wheelSensitivity: 0.1,
      minZoom: 0.1,
      maxZoom: 4,
      autoungrabify: false, // Sürükleme desteği için false
      userZoomingEnabled: true,
      userPanningEnabled: true
    });

    // Event handlers
    cyInstance.on('tap', 'node', evt => {
      evt.preventDefault();
      onNodeClick(evt.target.id());
    });

    // Sağ tık context menu
    cyInstance.on('cxttap', 'node, edge', evt => {
      const renderedPosition = evt.renderedPosition;
      if (!cyRef.current) return;
      
      const containerBounds = (cyRef.current as HTMLDivElement).getBoundingClientRect();
      const x = renderedPosition.x + containerBounds.left;
      const y = renderedPosition.y + containerBounds.top;
      setContextMenuPosition({ x, y });
      
      if (evt.target.isNode()) {
        setSelectedNodeId(evt.target.id());
      } else {
        setSelectedNodeId(null);
      }

      evt.preventDefault();
    });

    // Canvas'a tıklayınca context menu'yü kapat
    cyInstance.on('tap', evt => {
      if (evt.target === cyInstance) {
        setContextMenuPosition(null);
        setSelectedNodeId(null);
      }
    });

    setCy(cyInstance);

    // Cleanup
    return () => {
      cyInstance.destroy();
      setCy(null);
    };
  }, [data, onNodeClick]);

  // İlk render'da ve cy güncellendiğinde stilleri güncelle
  useEffect(() => {
    if (cy) {
      updateNodeStyles();
      updateEdgeStyles();
      updateLayout();
    }
  }, [cy, updateNodeStyles, updateEdgeStyles, updateLayout]);

  return (
    <div style={{ position: 'relative' }}>
    <div 
      ref={cyRef}
      onContextMenu={(e) => e.preventDefault()} // Tarayıcı context menüsünü engelle 
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
        <div 
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#fefefeff'
          }}
        >
          Belge ilişkileri bulunamadı veya yüklenemiyor
        </div>
      )}
    </div>      {contextMenuPosition && (
        <div
          style={{
            position: 'absolute',
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
    </div>
  );
}