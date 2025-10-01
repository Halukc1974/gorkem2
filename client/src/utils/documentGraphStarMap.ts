// Belge ilişkilerinden belge haritası graph datası üretir
export interface StarMapNode {
  id: string;
  letter_date?: string;
  content?: string;
  ref_letters?: string;
}
export interface StarMapEdge {
  source: string;
  target: string;
}
export interface StarMapGraph {
  nodes: StarMapNode[];
  edges: StarMapEdge[];
}

// input: [{ letter_no, ref_letters, letter_date, content }]
export function buildStarMapGraph(records: Array<{ letter_no: string; ref_letters?: string; letter_date?: string; content?: string }>): StarMapGraph {
  const nodeSet = new Set<string>();
  const nodeData = new Map<string, { letter_date?: string; content?: string; ref_letters?: string }>();
  const edges: StarMapEdge[] = [];

  for (const rec of records) {
    if (!rec.letter_no) continue;
    
    // Ana node'u ekle
    nodeSet.add(rec.letter_no);
    nodeData.set(rec.letter_no, {
      letter_date: rec.letter_date,
      content: rec.content,
      ref_letters: rec.ref_letters
    });
    
    // ref_letters: virgül veya noktalı virgül ile ayrılmış olabilir
    if (rec.ref_letters) {
      const refs = rec.ref_letters.split(/[,;]+/).map(r => r.trim()).filter(Boolean);
      for (const ref of refs) {
        nodeSet.add(ref);
        edges.push({ source: rec.letter_no, target: ref });
      }
    }
  }

  const nodes: StarMapNode[] = Array.from(nodeSet).map(id => ({
    id,
    letter_date: nodeData.get(id)?.letter_date,
    content: nodeData.get(id)?.content,
    ref_letters: nodeData.get(id)?.ref_letters
  }));
  
  return { nodes, edges };
}
