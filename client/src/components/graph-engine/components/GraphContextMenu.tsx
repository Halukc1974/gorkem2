import React, { useRef, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { useAuth } from '../../../hooks/useAuth';
import { firebaseConfigService } from '../../../services/firebaseConfig';
import { useGraphCustomization } from '../context/GraphCustomizationContext';
import { toast } from '../../../hooks/use-toast';

interface ContextMenuProps {
  selectedNodeId: string | null;
  onClose: () => void;
}

export function GraphContextMenu({ selectedNodeId, onClose }: ContextMenuProps) {
  const {
    customization,
    updateNodeStyle,
    updateEdgeStyle,
    updateLayout,
    resetCustomization
  } = useGraphCustomization();
  
  const { user } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]" aria-describedby="graph-customization-desc">
        <DialogHeader>
          <DialogTitle>Graf Özelleştirmeleri</DialogTitle>
        </DialogHeader>
        <p id="graph-customization-desc" className="text-sm text-gray-500 mb-4">
          Graf görünümü ve davranışı için özelleştirme ayarlarını yapabilirsiniz.
        </p>

        <Tabs defaultValue="nodes">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="nodes">Node Ayarları</TabsTrigger>
            <TabsTrigger value="edges">Ok Ayarları</TabsTrigger>
            <TabsTrigger value="layout">Düzen Ayarları</TabsTrigger>
          </TabsList>

          <TabsContent value="nodes" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Şekil</Label>
                <Select 
                  value={customization.nodeStyle.shape}
                  onValueChange={(value: any) => updateNodeStyle({ shape: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Şekil seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="roundrectangle">Yuvarlak Köşeli</SelectItem>
                    <SelectItem value="rectangle">Kare</SelectItem>
                    <SelectItem value="circle">Daire</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Arka Plan Rengi</Label>
                <Input
                  type="color"
                  value={customization.nodeStyle.backgroundColor}
                  onChange={(e) => updateNodeStyle({ backgroundColor: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Kenarlık Rengi</Label>
                <Input
                  type="color"
                  value={customization.nodeStyle.borderColor}
                  onChange={(e) => updateNodeStyle({ borderColor: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Metin Rengi</Label>
                <Input
                  type="color"
                  value={customization.nodeStyle.textColor}
                  onChange={(e) => updateNodeStyle({ textColor: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Genişlik</Label>
                <Input
                  type="number"
                  value={customization.nodeStyle.width}
                  onChange={(e) => updateNodeStyle({ width: Number(e.target.value) })}
                  min={60}
                  max={300}
                />
              </div>

              <div className="space-y-2">
                <Label>Yükseklik</Label>
                <Input
                  type="number"
                  value={customization.nodeStyle.height}
                  onChange={(e) => updateNodeStyle({ height: Number(e.target.value) })}
                  min={40}
                  max={200}
                />
              </div>

              <div className="space-y-2">
                <Label>Opaklık</Label>
                <Input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={customization.nodeStyle.opacity}
                  onChange={(e) => updateNodeStyle({ opacity: Number(e.target.value) })}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="edges" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ok Rengi</Label>
                <Input
                  type="color"
                  value={customization.edgeStyle.arrowColor}
                  onChange={(e) => updateEdgeStyle({ arrowColor: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Çizgi Rengi</Label>
                <Input
                  type="color"
                  value={customization.edgeStyle.lineColor}
                  onChange={(e) => updateEdgeStyle({ lineColor: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Ok Şekli</Label>
                <Select 
                  value={customization.edgeStyle.arrowShape}
                  onValueChange={(value: any) => updateEdgeStyle({ arrowShape: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ok şekli seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="triangle">Üçgen</SelectItem>
                    <SelectItem value="circle">Daire</SelectItem>
                    <SelectItem value="square">Kare</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Çizgi Stili</Label>
                <Select 
                  value={customization.edgeStyle.lineStyle}
                  onValueChange={(value: any) => updateEdgeStyle({ lineStyle: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Çizgi stili seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">Düz</SelectItem>
                    <SelectItem value="dashed">Kesikli</SelectItem>
                    <SelectItem value="dotted">Noktalı</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Opaklık</Label>
                <Input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={customization.edgeStyle.opacity}
                  onChange={(e) => updateEdgeStyle({ opacity: Number(e.target.value) })}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="layout" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Yönlendirme</Label>
                <Select 
                  value={customization.layout.direction}
                  onValueChange={(value: any) => updateLayout({ direction: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Yön seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LR">Soldan Sağa</SelectItem>
                    <SelectItem value="TB">Yukarıdan Aşağı</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Node Aralığı</Label>
                <Input
                  type="number"
                  value={customization.layout.nodeSeparation}
                  onChange={(e) => updateLayout({ nodeSeparation: Number(e.target.value) })}
                  min={20}
                  max={200}
                />
              </div>

              <div className="space-y-2">
                <Label>Seviye Aralığı</Label>
                <Input
                  type="number"
                  value={customization.layout.rankSeparation}
                  onChange={(e) => updateLayout({ rankSeparation: Number(e.target.value) })}
                  min={50}
                  max={300}
                />
              </div>

              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  checked={customization.layout.animate}
                  onCheckedChange={(checked) => updateLayout({ animate: checked })}
                />
                <Label>Animasyonu Etkinleştir</Label>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={resetCustomization}>
            Varsayılana Dön
          </Button>
          <div className="space-x-2">
            <Button 
              variant="default" 
              onClick={useCallback(async () => {
                if (!user?.uid) {
                  toast({
                    variant: "destructive",
                    title: "Hata",
                    description: "Ayarları kaydetmek için giriş yapmanız gerekiyor"
                  });
                  return;
                }

                try {
                  console.log('Saving graph settings...');
                  const graphConfig = {
                    layout: {
                      name: 'dagre',
                      rankDir: customization.layout.direction,
                      nodeSep: customization.layout.nodeSeparation,
                      rankSep: customization.layout.rankSeparation
                    },
                    nodeStyles: {
                      shape: customization.nodeStyle.shape,
                      width: customization.nodeStyle.width,
                      height: customization.nodeStyle.height,
                      fontSize: customization.nodeStyle.fontSize,
                      fontColor: customization.nodeStyle.textColor,
                      backgroundColor: customization.nodeStyle.backgroundColor,
                      borderColor: customization.nodeStyle.borderColor,
                      borderWidth: customization.nodeStyle.borderWidth,
                      opacity: customization.nodeStyle.opacity
                    },
                    edgeStyles: {
                      width: customization.edgeStyle.width,
                      color: customization.edgeStyle.lineColor,
                      arrowColor: customization.edgeStyle.arrowColor,
                      arrowShape: customization.edgeStyle.arrowShape,
                      lineStyle: customization.edgeStyle.lineStyle,
                      opacity: customization.edgeStyle.opacity
                    },
                    interaction: {
                      draggable: true,
                      selectable: true,
                      zoomable: true,
                      pannable: true
                    }
                  };

                  console.log('Graph config to save:', graphConfig);
                  await firebaseConfigService.updateGraphConfig(user.uid, graphConfig);
                  console.log('Graph settings saved successfully');
                  toast({
                    title: "Başarılı",
                    description: "Ayarlar başarıyla kaydedildi",
                    variant: "default"
                  });
                } catch (error) {
                  console.error('Save error:', error);
                  toast({
                    variant: "destructive",
                    title: "Hata",
                    description: `Ayarlar kaydedilirken bir hata oluştu: ${(error as Error).message}`
                  });
                }
              }, [customization, user])}
            >
              Ayarları Kaydet
            </Button>
            <Button onClick={onClose}>
              Kapat
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}