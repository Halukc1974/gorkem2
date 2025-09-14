import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { firebaseConfigService } from '../../../services/firebaseConfig';
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
  const { user } = useAuth();
  const [customization, setCustomization] = useState<GraphCustomization>(defaultCustomization);
  const [isLoading, setIsLoading] = useState(true);

  // Load saved settings from Firestore
  useEffect(() => {
    async function loadSavedSettings() {
      if (!user?.uid) {
        setIsLoading(false);
        return;
      }

      try {
        const userConfig = await firebaseConfigService.getUserConfig(user.uid);
        if (userConfig?.graph) {
          // Convert Firestore format to internal format
          // Helper function to ensure shape value is valid
          const validateShape = (shape: string): "roundrectangle" | "rectangle" | "circle" => {
            if (shape === "roundrectangle" || shape === "rectangle" || shape === "circle") {
              return shape;
            }
            return "roundrectangle"; // default value
          };

          // Helper function to ensure arrowShape value is valid
          const validateArrowShape = (shape: string): "triangle" | "circle" | "square" => {
            if (shape === "triangle" || shape === "circle" || shape === "square") {
              return shape;
            }
            return "triangle"; // default value
          };

          // Helper function to ensure lineStyle value is valid
          const validateLineStyle = (style: string): "solid" | "dashed" | "dotted" => {
            if (style === "solid" || style === "dashed" || style === "dotted") {
              return style;
            }
            return "solid"; // default value
          };

          const savedCustomization: GraphCustomization = {
            nodeStyle: {
              shape: validateShape(userConfig.graph.nodeStyles.shape),
              backgroundColor: userConfig.graph.nodeStyles.backgroundColor || defaultCustomization.nodeStyle.backgroundColor,
              borderColor: userConfig.graph.nodeStyles.borderColor || defaultCustomization.nodeStyle.borderColor,
              borderWidth: Number(userConfig.graph.nodeStyles.borderWidth) || defaultCustomization.nodeStyle.borderWidth,
              textColor: userConfig.graph.nodeStyles.fontColor || defaultCustomization.nodeStyle.textColor,
              fontSize: Number(userConfig.graph.nodeStyles.fontSize) || defaultCustomization.nodeStyle.fontSize,
              width: Number(userConfig.graph.nodeStyles.width) || defaultCustomization.nodeStyle.width,
              height: Number(userConfig.graph.nodeStyles.height) || defaultCustomization.nodeStyle.height,
              opacity: Number(userConfig.graph.nodeStyles.opacity) || defaultCustomization.nodeStyle.opacity
            },
            edgeStyle: {
              width: Number(userConfig.graph.edgeStyles.width) || defaultCustomization.edgeStyle.width,
              lineColor: userConfig.graph.edgeStyles.color || defaultCustomization.edgeStyle.lineColor,
              arrowColor: userConfig.graph.edgeStyles.arrowColor || defaultCustomization.edgeStyle.arrowColor,
              arrowShape: validateArrowShape(userConfig.graph.edgeStyles.arrowShape),
              lineStyle: validateLineStyle(userConfig.graph.edgeStyles.lineStyle),
              opacity: Number(userConfig.graph.edgeStyles.opacity) || defaultCustomization.edgeStyle.opacity
            },
            layout: {
              direction: userConfig.graph.layout.rankDir === "LR" ? "LR" : "TB",
              nodeSeparation: Number(userConfig.graph.layout.nodeSep) || defaultCustomization.layout.nodeSeparation,
              rankSeparation: Number(userConfig.graph.layout.rankSep) || defaultCustomization.layout.rankSeparation,
              animate: true
            }
          };
          setCustomization(savedCustomization);
        }
      } catch (error) {
        console.error('Error loading saved graph settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadSavedSettings();
  }, [user?.uid]);

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