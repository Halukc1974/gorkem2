import { createContext, useContext, useState, ReactNode } from 'react';
import {
  GraphCustomization,
  GraphCustomizationContextType,
  defaultCustomization
} from '../types/graph-customization';

const GraphCustomizationContext = createContext<GraphCustomizationContextType | null>(null);

interface Props {
  children: ReactNode;
}

export function GraphCustomizationProvider({ children }: Props) {
  const [customization, setCustomization] = useState<GraphCustomization>(defaultCustomization);

  const updateNodeStyle = (style: Partial<typeof customization.nodeStyle>) => {
    setCustomization(prev => ({
      ...prev,
      nodeStyle: { ...prev.nodeStyle, ...style }
    }));
  };

  const updateEdgeStyle = (style: Partial<typeof customization.edgeStyle>) => {
    setCustomization(prev => ({
      ...prev,
      edgeStyle: { ...prev.edgeStyle, ...style }
    }));
  };

  const updateLayout = (settings: Partial<typeof customization.layout>) => {
    setCustomization(prev => ({
      ...prev,
      layout: { ...prev.layout, ...settings }
    }));
  };

  const resetCustomization = () => {
    setCustomization(defaultCustomization);
  };

  return (
    <GraphCustomizationContext.Provider
      value={{
        customization,
        updateNodeStyle,
        updateEdgeStyle,
        updateLayout,
        resetCustomization
      }}
    >
      {children}
    </GraphCustomizationContext.Provider>
  );
}

export function useGraphCustomization() {
  const context = useContext(GraphCustomizationContext);
  if (!context) {
    throw new Error('useGraphCustomization must be used within a GraphCustomizationProvider');
  }
  return context;
}