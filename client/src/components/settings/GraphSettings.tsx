import React, { useCallback } from 'react'
import { useGraphCustomization } from '../../components/graph-engine/context/GraphCustomizationContext'
import { Button } from '../ui/button'
import { useAuth } from '../../hooks/useAuth'
import { firebaseConfigService } from '../../services/firebaseConfig'
import { toast } from '../../hooks/use-toast'

export default function GraphSettings() {
  const { customization, updateNodeStyle, updateEdgeStyle, updateLayout, resetCustomization } = useGraphCustomization()
  const { user } = useAuth()

  const handleSave = useCallback(async () => {
    if (!user?.uid) {
      toast({ variant: 'destructive', title: 'Hata', description: 'Ayarları kaydetmek için giriş yapmanız gerekiyor' })
      return
    }

    try {
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
      }

      await firebaseConfigService.updateGraphConfig(user.uid, graphConfig)
      toast({ title: 'Başarılı', description: 'Ayarlar başarıyla kaydedildi', variant: 'default' })
    } catch (error: any) {
      console.error('Graph save error:', error)
      toast({ variant: 'destructive', title: 'Hata', description: `Ayarlar kaydedilirken bir hata oluştu: ${error?.message || String(error)}` })
    }
  }, [user?.uid, customization])

  return (
    <div className="space-y-4 max-w-4xl">
      <h2 className="text-lg font-semibold">Graf Ayarları</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Node Shape</label>
          <select value={customization.nodeStyle.shape} onChange={(e) => updateNodeStyle({ shape: e.target.value as any })} className="mt-1 w-full p-2 border rounded">
            <option value="roundrectangle">Yuvarlak Köşeli</option>
            <option value="rectangle">Kare</option>
            <option value="circle">Daire</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Node Width</label>
          <input type="number" value={customization.nodeStyle.width} onChange={(e) => updateNodeStyle({ width: Number(e.target.value) })} min={40} max={400} className="mt-1 w-full p-2 border rounded" />
        </div>

        <div>
          <label className="block text-sm font-medium">Edge Color</label>
          <input type="color" value={customization.edgeStyle.lineColor} onChange={(e) => updateEdgeStyle({ lineColor: e.target.value })} className="mt-1 p-1 w-16 h-10 border rounded" />
        </div>

        <div>
          <label className="block text-sm font-medium">Layout Direction</label>
          <select value={customization.layout.direction} onChange={(e) => updateLayout({ direction: e.target.value as any })} className="mt-1 w-full p-2 border rounded">
            <option value="LR">Soldan Sağa</option>
            <option value="TB">Yukarıdan Aşağı</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={resetCustomization}>Varsayılanlara Dön</Button>
        <Button onClick={handleSave}>Ayarları Kaydet</Button>
      </div>
    </div>
  )
}
