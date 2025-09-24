import React, { useState, useEffect } from 'react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { Card, CardContent } from '../ui/card'
import { useUserSettingsLegacy } from '../../hooks/useUserSettings'
import { useDocumentSearch } from '../../hooks/use-document-search'

export default function ConfigSettings() {
  const { settings, isLoading, saveUserSettings } = useUserSettingsLegacy();
  const { configureServices } = useDocumentSearch();

  const [configs, setConfigs] = useState({
    supabase: { url: '', anonKey: '' },
    deepseek: { apiKey: '' },
    openai: { apiKey: '' }
  });

  useEffect(() => {
    if (settings) {
      setConfigs({
        supabase: { url: settings.supabase?.url || '', anonKey: settings.supabase?.anonKey || '' },
        deepseek: { apiKey: settings.deepseek?.apiKey || '' },
        openai: { apiKey: settings.openai?.apiKey || '' }
      });
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      // save via legacy adapter
      if (saveUserSettings) {
        await saveUserSettings({
          supabase: configs.supabase,
          deepseek: { apiKey: configs.deepseek.apiKey },
          openai: { apiKey: configs.openai.apiKey },
          enableAI: true
        });
      } else {
        // fallback to global helper if present
        await (window as any).saveUserSettings?.(configs);
      }
      // Reconfigure runtime services to pick up new keys
      try { await configureServices(); } catch (e) { /* ignore */ }
      alert('Konfigürasyon kaydedildi');
    } catch (err) {
      console.error('Config save failed', err);
      alert('Konfigürasyon kaydedilemedi');
    }
  }

  return (
    <Card>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Supabase URL</Label>
            <Input value={configs.supabase.url} onChange={(e: any) => setConfigs(prev => ({ ...prev, supabase: { ...prev.supabase, url: e.target.value } }))} />
          </div>
          <div className="space-y-2">
            <Label>Supabase Anon Key</Label>
            <Input type="password" value={configs.supabase.anonKey} onChange={(e: any) => setConfigs(prev => ({ ...prev, supabase: { ...prev.supabase, anonKey: e.target.value } }))} />
          </div>
          <div className="space-y-2">
            <Label>DeepSeek API Key</Label>
            <Input type="password" value={configs.deepseek.apiKey} onChange={(e: any) => setConfigs(prev => ({ ...prev, deepseek: { apiKey: e.target.value } }))} />
          </div>
          <div className="space-y-2">
            <Label>OpenAI API Key</Label>
            <Input type="password" value={configs.openai.apiKey} onChange={(e: any) => setConfigs(prev => ({ ...prev, openai: { apiKey: e.target.value } }))} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => window.location.reload()}>Varsayılanları Yükle</Button>
          <Button onClick={handleSave}>Kaydet ve Test Et</Button>
        </div>
      </CardContent>
    </Card>
  )
}
