import { GraphNode, GraphEdge } from '../../../services/graph-service';

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Komşuluk matrisi oluşturma yardımcı fonksiyonu
const createAdjacencyMatrix = (data: GraphData) => {
  const nodeMap = new Map<string, number>();
  const matrix: boolean[][] = [];
  const dates: Date[] = [];
  const letterNoMap = new Map<string, number[]>();  // letterNo -> node indeksleri
  const referenceMap = new Map<string, number[]>(); // referanslar -> node indeksleri

  // Node'ları indeksle ve matrisi başlat
  data.nodes.forEach((node, index) => {
    nodeMap.set(node.id, index);
    matrix[index] = new Array(data.nodes.length).fill(false);
    dates[index] = node.data.date ? new Date(node.data.date) : new Date();

    // letterNo ilişkilerini kaydet
    if (node.data.letterNo) {
      const letterNo = node.data.letterNo.toString();
      if (!letterNoMap.has(letterNo)) {
        letterNoMap.set(letterNo, []);
      }
      letterNoMap.get(letterNo)?.push(index);
    }

    // Referans ilişkilerini edge olarak ekle
    const references = node.data.references || [];
    if (Array.isArray(references)) {
      references.forEach((ref: string) => {
        const refStr = ref.toString();
        if (!referenceMap.has(refStr)) {
          referenceMap.set(refStr, []);
        }
        referenceMap.get(refStr)?.push(index);
      });
    }
  });

  // Edge'leri matrise ekle
  data.edges.forEach(edge => {
    const sourceIndex = nodeMap.get(edge.source);
    const targetIndex = nodeMap.get(edge.target);
    if (sourceIndex !== undefined && targetIndex !== undefined) {
      matrix[sourceIndex][targetIndex] = true;
      matrix[targetIndex][sourceIndex] = true;
    }
  });

  // letterNo ve referans ilişkilerini matrise ekle
  letterNoMap.forEach((nodeIndices, letterNo) => {
    // Bu letterNo'ya referans veren tüm belgeleri bul
    const referencingIndices = referenceMap.get(letterNo) || [];
    
    // İlişkileri matrise ekle
    nodeIndices.forEach(nodeIndex => {
      referencingIndices.forEach(refIndex => {
        matrix[nodeIndex][refIndex] = true;
        matrix[refIndex][nodeIndex] = true;
      });
    });
  });

  return { matrix, nodeMap, dates };
};

// DFS ile bağlantılı tüm node'ları bulma
const findConnectedNodes = (
  matrix: boolean[][],
  start: number,
  visited: boolean[],
  dates: Date[],
  condition?: (date: Date) => boolean
) => {
  const result = new Set<number>();
  const pendingNodes = new Set<number>();
  const stack = [start];

  // İlk düğümü işaretle
  result.add(start);
  visited[start] = true;

  while (stack.length > 0) {
    const current = stack.pop()!;
    
    // Tüm komşuları kontrol et
    for (let neighbor = 0; neighbor < matrix[current].length; neighbor++) {
      if (!matrix[current][neighbor] || visited[neighbor]) continue;

      visited[neighbor] = true;
      
      // Date koşulunu kontrol et
      if (!condition || condition(dates[neighbor])) {
        result.add(neighbor);
        stack.push(neighbor); // Koşulu sağlayan komşuları hemen ekle
      } else {
        pendingNodes.add(neighbor); // Koşulu sağlamayanları beklet
      }
    }

    // Stack boşaldığında, bekleyen düğümleri kontrol et
    if (stack.length === 0 && pendingNodes.size > 0) {
      // Bekleyen düğümlerden yeni bağlantılar var mı kontrol et
      pendingNodes.forEach(nodeIndex => {
        for (let i = 0; i < matrix[nodeIndex].length; i++) {
          if (matrix[nodeIndex][i] && !visited[i]) {
            if (!condition || condition(dates[i])) {
              result.add(i);
              stack.push(i);
              visited[i] = true;
            }
          }
        }
      });
      pendingNodes.clear();
    }
  }

  return result;
};

export const filterPreviousCorrespondence = (data: GraphData) => {
  const selectedNode = data.nodes[0];
  if (!selectedNode || !selectedNode.data.date) return { nodes: [], edges: [] };

  const selectedDate = new Date(selectedNode.data.date);
  const { matrix, nodeMap, dates } = createAdjacencyMatrix(data);
  const startIndex = nodeMap.get(selectedNode.id);

  if (startIndex === undefined) return { nodes: [], edges: [] };

  const visited = new Array(data.nodes.length).fill(false);
  const resultIndices = findConnectedNodes(
    matrix,
    startIndex,
    visited,
    dates,
    (date) => date <= selectedDate
  );

  // Node'ları ve edge'leri topla
  const resultNodes = new Set<string>();
  const resultEdges = new Set<string>();

  // İndeksleri node ID'lerine çevir
  Array.from(resultIndices).forEach(index => {
    const nodeId = data.nodes[index].id;
    resultNodes.add(nodeId);
  });

  // İlgili edge'leri bul
  data.edges.forEach(edge => {
    if (resultNodes.has(edge.source) && resultNodes.has(edge.target)) {
      resultEdges.add(edge.id);
    }
  });

  // Sonuçları Datee göre sırala
  const sortedNodes = Array.from(resultNodes)
    .map(id => data.nodes.find(n => n.id === id))
    .filter((node): node is GraphNode => node !== undefined)
    .sort((a, b) => {
      if (!a.data.date || !b.data.date) return 0;
      return new Date(a.data.date).getTime() - new Date(b.data.date).getTime();
    });

  const finalEdges = Array.from(resultEdges)
    .map(id => data.edges.find(e => e.id === id))
    .filter((edge): edge is GraphEdge => edge !== undefined);

  return {
    nodes: sortedNodes,
    edges: finalEdges
  };
};

export const filterNextCorrespondence = (data: GraphData) => {
  const selectedNode = data.nodes[0];
  if (!selectedNode || !selectedNode.data.date) return { nodes: [], edges: [] };

  const selectedDate = new Date(selectedNode.data.date);
  const { matrix, nodeMap, dates } = createAdjacencyMatrix(data);
  const startIndex = nodeMap.get(selectedNode.id);

  if (startIndex === undefined) return { nodes: [], edges: [] };

  // İlk geçişte sadece gelecek Dateli bağlantıları bul
  const visited = new Array(data.nodes.length).fill(false);
  const futureNodes = findConnectedNodes(
    matrix,
    startIndex,
    visited,
    dates,
    (date) => date >= selectedDate
  );

  // İkinci geçişte bulunan node'ların tüm bağlantılarını kontrol et
  const allVisited = new Array(data.nodes.length).fill(false);
  const allConnected = new Set<number>();

  // Her gelecek node için tüm bağlantılarını tara
  futureNodes.forEach(nodeIndex => {
    if (!allVisited[nodeIndex]) {
      const connected = findConnectedNodes(matrix, nodeIndex, allVisited, dates);
      connected.forEach(idx => allConnected.add(idx));
    }
  });

  // Son olarak sadece seçili Dateten sonraki node'ları filtrele
  const resultIndices = new Set<number>();
  allConnected.forEach(index => {
    if (dates[index] >= selectedDate) {
      resultIndices.add(index);
    }
  });

  // Node'ları ve edge'leri topla
  const resultNodes = new Set<string>();
  const resultEdges = new Set<string>();

  // İndeksleri node ID'lerine çevir
  Array.from(resultIndices).forEach(index => {
    const nodeId = data.nodes[index].id;
    resultNodes.add(nodeId);
  });

  // İlgili edge'leri bul
  data.edges.forEach(edge => {
    if (resultNodes.has(edge.source) && resultNodes.has(edge.target)) {
      resultEdges.add(edge.id);
    }
  });

  // Sonuçları Datee göre sırala
  const sortedNodes = Array.from(resultNodes)
    .map(id => data.nodes.find(n => n.id === id))
    .filter((node): node is GraphNode => node !== undefined)
    .sort((a, b) => {
      if (!a.data.date || !b.data.date) return 0;
      return new Date(a.data.date).getTime() - new Date(b.data.date).getTime();
    });

  const finalEdges = Array.from(resultEdges)
    .map(id => data.edges.find(e => e.id === id))
    .filter((edge): edge is GraphEdge => edge !== undefined);

  return {
    nodes: sortedNodes,
    edges: finalEdges
  };
};

export const filterAllCorrespondence = (data: GraphData) => {
  if (data.nodes.length === 0) return { nodes: [], edges: [] };

  const { matrix, nodeMap, dates } = createAdjacencyMatrix(data);
  const visited = new Array(data.nodes.length).fill(false);
  const allConnectedComponents = new Set<number>();
  
  // Tüm bağlantılı bileşenleri bul
  for (let i = 0; i < data.nodes.length; i++) {
    if (!visited[i]) {
      const component = findConnectedNodes(matrix, i, visited, dates);
      component.forEach(index => allConnectedComponents.add(index));
    }
  }

  // Node'ları ve edge'leri topla
  const resultNodes = new Set<string>();
  const resultEdges = new Set<string>();

  // İndeksleri node ID'lerine çevir
  Array.from(allConnectedComponents).forEach(index => {
    const nodeId = data.nodes[index].id;
    resultNodes.add(nodeId);
  });

  // İlgili edge'leri bul
  data.edges.forEach(edge => {
    if (resultNodes.has(edge.source) && resultNodes.has(edge.target)) {
      resultEdges.add(edge.id);
    }
  });

  // Sonuçları Datee göre sırala
  const sortedNodes = Array.from(resultNodes)
    .map(id => data.nodes.find(n => n.id === id))
    .filter((node): node is GraphNode => node !== undefined)
    .sort((a, b) => {
      if (!a.data.date || !b.data.date) return 0;
      return new Date(a.data.date).getTime() - new Date(b.data.date).getTime();
    });

  const finalEdges = Array.from(resultEdges)
    .map(id => data.edges.find(e => e.id === id))
    .filter((edge): edge is GraphEdge => edge !== undefined);

  return {
    nodes: sortedNodes,
    edges: finalEdges
  };
};