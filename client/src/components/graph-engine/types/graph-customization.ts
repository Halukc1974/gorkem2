export interface NodeStyle {
  shape: 'roundrectangle' | 'rectangle' | 'circle';
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  textColor: string;
  fontSize: number;
  width: number;
  height: number;
  opacity: number;
  gradientStart?: string;
  gradientEnd?: string;
}

export interface EdgeStyle {
  width: number;
  lineColor: string;
  arrowColor: string;
  arrowShape: 'triangle' | 'circle' | 'square';
  lineStyle: 'solid' | 'dashed' | 'dotted';
  opacity: number;
}

export interface LayoutSettings {
  direction: 'LR' | 'TB';  // LR: Left to Right, TB: Top to Bottom
  nodeSeparation: number;
  rankSeparation: number;
  animate: boolean;
}

export interface GraphCustomization {
  nodeStyle: NodeStyle;
  edgeStyle: EdgeStyle;
  layout: LayoutSettings;
}

export interface GraphCustomizationContextType {
  customization: GraphCustomization;
  updateNodeStyle: (style: Partial<NodeStyle>) => void;
  updateEdgeStyle: (style: Partial<EdgeStyle>) => void;
  updateLayout: (settings: Partial<LayoutSettings>) => void;
  resetCustomization: () => void;
}

export const defaultCustomization: GraphCustomization = {
  nodeStyle: {
    shape: 'roundrectangle',
    backgroundColor: '#088cf8',
    borderColor: '#016df9',
    borderWidth: 1,
    textColor: '#ffffff',
    fontSize: 14,
    width: 120,
    height: 60,
    opacity: 1
  },
  edgeStyle: {
    width: 2,
    lineColor: '#fff305',
    arrowColor: '#016df9',
    arrowShape: 'triangle',
    lineStyle: 'solid',
    opacity: 1
  },
  layout: {
    direction: 'LR',
    nodeSeparation: 80,
    rankSeparation: 150,
    animate: false
  }
};