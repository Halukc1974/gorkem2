// Belge ilişkilerinden belge haritası graph datası üretir
export interface StarMapNode {
  id: string;
}
export interface StarMapEdge {
  source: string;
  target: string;
}
export interface StarMapGraph {
  nodes: StarMapNode[];
  edges: StarMapEdge[];
}

// input: [{ letter_no, ref_letters }]
export function buildStarMapGraph(records: Array<{ letter_no: string; ref_letters: string }>): StarMapGraph {
  const nodeSet = new Set<string>();
  const edges: StarMapEdge[] = [];

  for (const rec of records) {
    if (!rec.letter_no) continue;
    nodeSet.add(rec.letter_no);
    // ref_letters: virgül veya noktalı virgül ile ayrılmış olabilir
    if (rec.ref_letters) {
      const refs = rec.ref_letters.split(/[,;]+/).map(r => r.trim()).filter(Boolean);
      for (const ref of refs) {
        nodeSet.add(ref);
        edges.push({ source: rec.letter_no, target: ref });
      }
    }
  }

  const nodes: StarMapNode[] = Array.from(nodeSet).map(id => ({ id }));
  return { nodes, edges };
}
