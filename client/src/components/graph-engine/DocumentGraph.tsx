/** @jsxImportSource react */
import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { GraphNode, GraphEdge } from '../../services/graph-service';

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

  useEffect(() => {
    if (!cyRef.current || !data) return;

    const cy = cytoscape({
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
            'background-color': '#008cffff',
            'label': 'data(label)',
            'color': '#ffffffff',
            'text-wrap': 'wrap',
            'text-max-width': '80px',
            'font-size': '14px',
            'text-valign': 'center',
            'text-halign': 'center',
            'padding': '10px',
            'shape': 'roundrectangle',
            'width': 120,
            'height': 60
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#a0aec0',
            'target-arrow-color': '#a0aec0',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier'
          }
        }
      ],
      layout: {
        name: 'dagre',
        // @ts-ignore
        rankDir: 'LR', // Cytoscape-dagre özel özelliği
        spacingFactor: 2,
        nodeSep: 80,
        rankSep: 150,
        fit: true,
        padding: 10,
        animate: false, // Animasyonu devre dışı bırak
        refresh: 1, // Her değişiklikte yenile
        randomize: false // Düğüm pozisyonlarını rastgele belirleme
      },
      wheelSensitivity: 0.1, // Daha düşük fare tekerleği hassasiyeti
      minZoom: 0.1, // Minimum zoom seviyesi
      maxZoom: 4, // Maximum zoom seviyesi
      autoungrabify: true, // Düğümlerin sürüklenmesini engelle
      userZoomingEnabled: true, // Kullanıcı zoom'u etkin
      userPanningEnabled: true // Kullanıcı kaydırma etkin
    });

    // Event handlers
    cy.on('tap', 'node', evt => {
      evt.preventDefault();
      onNodeClick(evt.target.id());
    });

    // Cleanup
    return () => {
      cy.destroy();
    };
  }, [data, onNodeClick]);

  return (
    <div 
      ref={cyRef} 
      style={{ 
        width: '100%', 
        height: '600px',
        backgroundColor: '#f7fafc',
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
            color: '#718096'
          }}
        >
          Belge ilişkileri bulunamadı veya yüklenemiyor
        </div>
      )}
    </div>
  );
}