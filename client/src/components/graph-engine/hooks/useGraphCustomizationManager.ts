import { useEffect, useCallback } from 'react';
import { Core, NodeSingular } from 'cytoscape';
import { useGraphCustomization } from '../context/GraphCustomizationContext';

export function useGraphCustomizationManager(cy: Core | null) {
  const { customization } = useGraphCustomization();

  // Node stilleri güncelleme
  const updateNodeStyles = useCallback(() => {
    if (!cy) return;

    const { nodeStyle } = customization;
    
    cy.style()
      .selector('node')
      .style({
        'background-color': nodeStyle.backgroundColor,
        'border-color': nodeStyle.borderColor,
        'border-width': `${nodeStyle.borderWidth}px`,
        'color': nodeStyle.textColor,
        'font-size': `${nodeStyle.fontSize}px`,
        'width': nodeStyle.width,
        'height': nodeStyle.height,
        // @ts-ignore - cytoscape.js tip tanımında eksik
        'shape': nodeStyle.shape,
        ...(nodeStyle.gradientStart && nodeStyle.gradientEnd ? {
          'background-gradient-stop-colors': `${nodeStyle.gradientStart} ${nodeStyle.gradientEnd}`,
          'background-gradient-direction': 'to-bottom'
        } : {})
      })
      .update();
  }, [cy, customization.nodeStyle]);

  // Ok stilleri güncelleme
  const updateEdgeStyles = useCallback(() => {
    if (!cy) return;

    const { edgeStyle } = customization;
    
    cy.style()
      .selector('edge')
      .style({
        'width': edgeStyle.width,
        'line-color': edgeStyle.lineColor,
        'target-arrow-color': edgeStyle.arrowColor,
        'target-arrow-shape': edgeStyle.arrowShape,
        'line-style': edgeStyle.lineStyle
      })
      .update();
  }, [cy, customization.edgeStyle]);

  // Layout güncelleme
  const updateLayout = useCallback(() => {
    if (!cy) return;

    const layout = cy.layout({
      name: 'dagre',
      // @ts-ignore - dagre layout tip tanımında eksik
      rankDir: customization.layout.direction,
      nodeSep: customization.layout.nodeSeparation,
      rankSep: customization.layout.rankSeparation,
      animate: customization.layout.animate,
      animationDuration: 300
    });

    layout.run();
  }, [cy, customization.layout]);

  // Node sürükle-bırak yönetimi
  const setupDragAndDrop = useCallback((cy: Core) => {
    cy.nodes().ungrabify(); // Önce tüm sürükleme işlemlerini devre dışı bırak
    
    // Sağ tık dışındaki durumlarda sürüklemeyi etkinleştir
    cy.on('mousedown', 'node', (event) => {
      if (event.originalEvent.button !== 2) { // 2 = sağ tık
        const node = event.target;
        node.grabify();
      }
    });

    // Sürükleme bittiğinde node'u tekrar kitle
    cy.on('mouseup', 'node', (event) => {
      const node = event.target;
      node.ungrabify();
    });

    // Node sürüklenirken bağlantıların güncellenmesi
    cy.on('drag', 'node', () => {
      cy.edges().style({
        'curve-style': 'bezier',
        'control-point-step-size': 40
      });
    });
  }, []);

  // Tüm güncellemeleri uygula
  useEffect(() => {
    if (!cy) return;
    
    updateNodeStyles();
    updateEdgeStyles();
    updateLayout();
    setupDragAndDrop(cy);
  }, [cy, updateNodeStyles, updateEdgeStyles, updateLayout, setupDragAndDrop]);

  return {
    updateNodeStyles,
    updateEdgeStyles,
    updateLayout
  };
}