import { useState } from 'react';
import { graphService, GraphNode, GraphEdge } from '../services/graph-service';

export function useDocumentGraph() {
  const [graphData, setGraphData] = useState<{nodes: GraphNode[], edges: GraphEdge[]}>()
  const [selectedNode, setSelectedNode] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()

  const loadGraph = async (rootDocId: string) => {
    try {
      setLoading(true);
      setError(undefined);
      const data = await graphService.buildDocumentGraph(rootDocId);
      
      // Graf boş veya çok az düğüm içeriyorsa uyarı göster
      if (!data.nodes.length) {
        setError('Bu belge için ilişkili belgeler bulunamadı.');
        return;
      }
      
      setGraphData(data);
    } catch (err) {
      // Hata mesajını daha açıklayıcı hale getir
      let errorMessage = 'Graf yüklenirken bir hata oluştu';
      if (err instanceof Error) {
        if (err.message.includes('nonexistant target')) {
          errorMessage = 'Bazı referans belgeler bulunamadı. Lütfen belge numaralarını kontrol edin.';
        } else {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
      console.error('Graph yükleme hatası:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleNodeClick = async (nodeId: string) => {
    try {
      setSelectedNode(nodeId);
      const details = await graphService.getDocumentDetails(nodeId);
      
      // Eğer webUrl varsa, yeni sekmede aç
      if (details?.weburl) {
        window.open(details.weburl, '_blank');
      }
    } catch (err) {
      console.error('Düğüm tıklama hatası:', err);
    }
  }

  return { 
    graphData, 
    loading, 
    error,
    selectedNode, 
    loadGraph, 
    handleNodeClick 
  }
}