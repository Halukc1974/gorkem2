import React, { useState, useEffect } from 'react';
import { useUserSettings } from '../../hooks/useUserSettingsFirebase';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export default function VectorSearchSettings() {
  const { config, updateConfig } = useUserSettings();
  const [params, setParams] = useState({
    textScoreMethod: 'overlap' as 'overlap' | 'simple',
    textWeight: 0.7,
    vectorThreshold: 0.3,
    vectorWeight: 0.3,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (config?.search) {
      setParams({
  textScoreMethod: (config.search.textScoreMethod as 'overlap' | 'simple') || 'overlap',
  textWeight: config.search.textWeight ?? 0.7,
  vectorThreshold: config.search.vectorThreshold ?? 0.3,
  vectorWeight: config.search.vectorWeight ?? 0.3,
      });
    }
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      await updateConfig({
        search: {
          ...config?.search,
          textScoreMethod: params.textScoreMethod,
          textWeight: Number(params.textWeight),
          vectorThreshold: Number(params.vectorThreshold),
          vectorWeight: Number(params.vectorWeight),
          enableAI: typeof config?.search?.enableAI === 'boolean' ? config.search.enableAI : false,
        },
      });
      setMessage('Parametreler başarıyla kaydedildi.');
    } catch (err) {
      setMessage('Kaydetme hatası: ' + (typeof err === 'object' && err !== null && 'message' in err ? (err as any).message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-xl">
      <h3 className="text-lg font-semibold mb-2">Vector Arama Parametreleri</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>textScoreMethod</Label>
          <select
            value={params.textScoreMethod}
            onChange={e => setParams(p => ({ ...p, textScoreMethod: e.target.value as 'overlap' | 'simple' }))}
            className="w-full p-2 border rounded"
          >
            <option value="overlap">overlap</option>
            <option value="simple">simple</option>
          </select>
        </div>
        <div>
          <Label>textWeight</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={params.textWeight}
            onChange={e => setParams(p => ({ ...p, textWeight: Number(e.target.value) }))}
          />
        </div>
        <div>
          <Label>vectorThreshold</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={params.vectorThreshold}
            onChange={e => setParams(p => ({ ...p, vectorThreshold: Number(e.target.value) }))}
          />
        </div>
        <div>
          <Label>vectorWeight</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={params.vectorWeight}
            onChange={e => setParams(p => ({ ...p, vectorWeight: Number(e.target.value) }))}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button onClick={handleSave} disabled={saving}>Kaydet</Button>
      </div>
      {message && <div className="mt-2 text-sm text-green-700">{message}</div>}
    </div>
  );
}
