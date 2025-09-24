import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { useUserSettings } from '../../hooks/useUserSettingsFirebase'

interface ColumnSettingsProps {
  open: boolean
  onClose: () => void
  title?: string
  dialogWidth?: string
  embedded?: boolean
}

const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = {
  inc_out: true,
  letter_no: true,
  letter_date: true,
  short_desc: true,
  ref_letters: true,
  severity_rate: true,
  keywords: true,
  preview: true,
  web_url: true,
}

export default function ColumnSettings({ open, onClose, title = 'Sütun Ayarları', dialogWidth = '28vw', embedded = false }: ColumnSettingsProps) {
  const { config, updateConfig } = useUserSettings()

  const visibleColumns = (config as any)?.infoCenter?.columns || DEFAULT_COLUMN_VISIBILITY
  const [editingColumns, setEditingColumns] = useState<Record<string, boolean>>(visibleColumns)

  useEffect(() => {
    setEditingColumns((config as any)?.infoCenter?.columns || DEFAULT_COLUMN_VISIBILITY)
  }, [config])

  const saveColumns = async () => {
    try {
      await updateConfig({ infoCenter: { columns: editingColumns } } as any)
      onClose()
    } catch (err) {
      console.error('Failed to save column settings', err)
    }
  }

  // If embedded, render inline controls instead of a modal dialog
  if (embedded) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{title}</h3>
        <div className="flex flex-col gap-2">
          {Object.keys(DEFAULT_COLUMN_VISIBILITY).map((key) => (
            <label key={key} className="flex items-center gap-3">
              <input type="checkbox" checked={!!editingColumns[key]} onChange={(e) => setEditingColumns(prev => ({ ...prev, [key]: e.target.checked }))} />
              <span className="capitalize">{key.replace('_', ' ')}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={() => { if (onClose) onClose(); }}>İptal</Button>
          <Button onClick={saveColumns}>Kaydet</Button>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl" style={{ width: dialogWidth }}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.keys(DEFAULT_COLUMN_VISIBILITY).map((key) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={!!editingColumns[key]} onChange={(e) => setEditingColumns(prev => ({ ...prev, [key]: e.target.checked }))} />
              <span style={{ textTransform: 'capitalize' }}>{key.replace('_', ' ')}</span>
            </label>
          ))}
        </div>

        <div className="flex justify-end mt-4 gap-2">
          <Button variant="outline" onClick={onClose}>İptal</Button>
          <Button onClick={saveColumns}>Kaydet</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
