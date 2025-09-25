import React, { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import firebaseConfigService from '../../services/firebaseConfig';
import { ensureServerSession } from '../../utils/serverAuth';

const SIDEBAR_ITEMS = [
  'settings',
  'projects-summary',
  'dashboard',
  'financial-dashboard',
  'document-search',
  'n8n-vector-search',
  'ai-search',
  'projects/info-center'
];

export default function UserPermissions() {
  const [users, setUsers] = useState<Array<{ uid: string; email?: string; name?: string }>>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [visibleItems, setVisibleItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [permissionsDoc, setPermissionsDoc] = useState<Record<string, any> | null>(null);
  const [fetching, setFetching] = useState(false);
  const loadUsers = async () => {
    setFetching(true);
    setMessage(null);
    try {
      // 1) Try reading a single permissions document that contains a `users` map (primary: userConfigs collection)
      try {
        const appConfig = (window as any).__APP_CONFIG__ || {};
        const docId = appConfig?.PERMISSIONS_DOC_ID || 'BCAwiuzRcwOMYrwS6hQiCNnFMN33';
        const tryCollections = [appConfig?.PERMISSIONS_COLLECTION || 'userConfigs', 'userPermissions', 'settings', 'appSettings'];
        let permDoc = null;
        for (const col of tryCollections) {
          try {
            permDoc = await firebaseConfigService.getPermissionsDoc(docId, col);
            if (permDoc) {
              setPermissionsDoc(permDoc);
              break;
            }
          } catch (e) {
            // ignore and try next collection
          }
        }

        if (permDoc) {
          // Two supported shapes:
          // A) { users: { 'email': { ... } } }
          // B) flat: { 'email': { ... }, otherField: ... }
          const usersMap = (permDoc.users && typeof permDoc.users === 'object') ? permDoc.users : permDoc;
          // Only treat as users map if keys look like emails or object values are object of booleans
          if (usersMap && typeof usersMap === 'object') {
            const keys = Object.keys(usersMap);
            // heuristic: at least one key contains '@' or at least one value is an object with boolean properties
            const looksLikeUsers = keys.some(k => k.includes('@')) || keys.some(k => {
              const v = usersMap[k];
              return v && typeof v === 'object' && Object.values(v).some(x => typeof x === 'boolean');
            });
            if (looksLikeUsers) {
              const mapped = keys.map(k => ({ uid: k, email: k, name: '' }));
              setUsers(mapped);
              setMessage(null);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Single permissions doc (users map) read failed, will try collection/userConfigs fallback', err);
      }
      // 2) Try listing from userConfigs via firebaseConfigService
      try {
        const docs = await firebaseConfigService.listUserConfigs();
        const mapped = docs.map(d => ({ uid: d.id, email: (d.data as any)?.email || d.id, name: (d.data as any)?.meta?.displayName || '' }));
        setUsers(mapped);
        setMessage(null);
        return;
      } catch (err) {
        console.warn('Firestore userConfigs listing failed, falling back to admin API', err);
      }

      // Fallback: call the server admin endpoint
      const res = await fetch('/api/admin/list-users', { credentials: 'include' });
      if (res.status === 401) {
        setMessage('Yetkilendirme gerekli: lütfen giriş yapın.');
        setUsers([]);
        return;
      }
      if (res.status === 403) {
        setMessage('Erişim reddedildi: admin değilsiniz.');
        setUsers([]);
        return;
      }
      const ct = res.headers.get('content-type') || '';
      if (!res.ok) {
        const text = await res.text();
        console.error('Admin list-users error, non-OK response:', res.status, text);
        setMessage('Kullanıcı listesi alınamadı (sunucu hata). Konsolu kontrol edin.');
        setUsers([]);
        return;
      }
      if (!ct.includes('application/json')) {
        const text = await res.text();
        console.error('Admin list-users returned non-JSON (body):', text);
        setMessage('Sunucu JSON yerine HTML döndürdü; ağ yanıtını kontrol edin.');
        setUsers([]);
        return;
      }
      const list = await res.json();
      setUsers(list || []);
      setMessage(null);
    } catch (err) {
      console.error('Failed to fetch users', err);
      setMessage('Kullanıcılar yüklenemedi; konsolu kontrol edin');
      setUsers([]);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);
  useEffect(() => {
    const handler = () => { loadUsers(); };
    window.addEventListener('settings:users-tab-activated', handler);
    return () => { window.removeEventListener('settings:users-tab-activated', handler); };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let canceled = false;
    (async () => {
      try {
        setLoading(true);
        // If we previously loaded a single permissions document containing a `users` map (or flat map),
        // prefer its in-memory value for the selected user. This avoids extra reads.
        try {
          if (permissionsDoc) {
            const usersMap = (permissionsDoc.users && typeof permissionsDoc.users === 'object') ? permissionsDoc.users : permissionsDoc;
            if (usersMap && usersMap[selected]) {
              const sidebar = usersMap[selected] as Record<string, boolean>;
              const keys = Object.keys(sidebar || {}).filter(k => !!sidebar[k]);
              if (!canceled) setVisibleItems(keys);
              return;
            }
          }
        } catch (e) {
          console.warn('Error reading selected user from in-memory permissionsDoc', e);
        }

        // Try to load permissions directly from Firestore user config doc
        try {
          const cfg = await firebaseConfigService.getUserConfig(selected);
          if (cfg && (cfg as any).sidebar) {
            const sidebar = (cfg as any).sidebar as Record<string, boolean>;
            const keys = Object.keys(sidebar).filter(k => !!sidebar[k]);
            if (!canceled) setVisibleItems(keys);
            return;
          }
          // backward-compatible: old ui.sidebarVisible array
          if (cfg && (cfg as any).ui && Array.isArray((cfg as any).ui.sidebarVisible)) {
            const vis = (cfg as any).ui.sidebarVisible as string[];
            if (!canceled) setVisibleItems(vis);
            return;
          }
        } catch (e) {
          console.warn('Failed to read permissions from Firestore, will try server endpoints', e);
        }

        // Fallback to admin endpoints
        try {
          const res = await fetch(`/api/admin/permissions/${encodeURIComponent(selected)}`, { credentials: 'include' });
          if (res.ok) {
            const ct = res.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
              const perm = await res.json();
              if (perm?.sidebar) {
                const keys = Object.keys(perm.sidebar).filter(k => !!perm.sidebar[k]);
                if (!canceled) setVisibleItems(keys);
                return;
              }
            }
          }
        } catch (e) {
          console.warn('admin permissions endpoint failed', e);
        }

        // Final fallback: old user-config endpoint
        try {
          const oldRes = await fetch(`/api/admin/user-config/${encodeURIComponent(selected)}`, { credentials: 'include' });
          if (oldRes.ok) {
            const ct2 = oldRes.headers.get('content-type') || '';
            if (ct2.includes('application/json')) {
              const cfg = await oldRes.json();
              const vis = cfg?.ui?.sidebarVisible || [];
              if (!canceled) setVisibleItems(vis);
              return;
            }
          }
        } catch (e) {
          console.warn('fallback user-config load failed', e);
        }

        if (!canceled) setVisibleItems([]);
      } catch (err) {
        console.error('Failed to load user config', err);
        if (!canceled) setVisibleItems([]);
      } finally {
        setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [selected]);

  const toggleItem = (key: string) => {
    setVisibleItems(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const save = async () => {
    if (!selected) return;
    setLoading(true);
    setMessage(null);
    try {
      // Ensure server session exists before making authenticated request
      console.log('🔐 Ensuring server session before save...');
      const sessionReady = await ensureServerSession();
      if (!sessionReady) {
        setMessage('Oturum açma hatası - lütfen sayfayı yenileyin');
        return;
      }
      console.log('✅ Server session ready, proceeding with save...');

      // Build permissions payload as boolean map
      const sidebarMap: Record<string, boolean> = {};
      SIDEBAR_ITEMS.forEach(item => { sidebarMap[item] = visibleItems.includes(item); });
      const payload = { sidebar: sidebarMap, updatedAt: new Date().toISOString() } as any;
      let putRes: Response | null = null;
      // If we have loaded a single permissions doc into state, prefer writing directly with Firebase client
      // This avoids needing the server/session bridge when running in the browser environment.
      const appConfig = (window as any).__APP_CONFIG__ || {};
      const docId = appConfig?.PERMISSIONS_DOC_ID || 'BCAwiuzRcwOMYrwS6hQiCNnFMN33';
      if (permissionsDoc) {
        try {
          await firebaseConfigService.setPermissionsDocEntry(docId, selected, payload.sidebar || payload, 'userConfigs');
          // Simulate a successful Response object for downstream handling
          // (so existing code that reads putRes.json() still works)
          // Create a small object with users map
          const usersMap = { ...(permissionsDoc.users || {}), [selected]: payload.sidebar || payload };
          setPermissionsDoc(prev => ({ ...(prev || {}), users: usersMap }));
          // update visibleItems
          const keys = Object.keys(payload.sidebar || payload).filter(k => !!(payload.sidebar || payload)[k]);
          setVisibleItems(keys);
          setMessage('Kaydedildi');
          try { window.dispatchEvent(new Event('permissions:changed')); } catch (e) { /* ignore */ }
          return;
        } catch (err) {
          console.error('Direct Firestore write failed, falling back to server endpoint', err);
          // fall through to server call below
        }
      }

      putRes = await fetch(`/api/admin/permissions/${encodeURIComponent(selected)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      // Check server response for success and surface errors if any
      if (!putRes) {
        setMessage('Sunucuya bağlanılamadı');
        return;
      }

      if (putRes.status === 401) {
        setMessage('Yetkilendirme gerekli: lütfen oturum açın.');
        return;
      }
      if (putRes.status === 403) {
        setMessage('Erişim reddedildi: admin değilsiniz veya kendi ayarlarınızı düzenleyemezsiniz.');
        return;
      }

      if (!putRes.ok) {
        // Try to parse error body for a helpful message
        let bodyText = '';
        try {
          const json = await putRes.json().catch(() => null);
          if (json && json.message) bodyText = String(json.message);
          else if (json && json.error) bodyText = String(json.error);
        } catch (e) {
          // fallback to text
          try { bodyText = await putRes.text(); } catch (e) { bodyText = ''; }
        }
        setMessage(bodyText ? `Kaydetme başarısız: ${bodyText}` : 'Kaydetme başarısız (sunucu hatası)');
        return;
      }

      try {
        const json = await putRes.json().catch(() => null);
        if (json && json.users) {
          setPermissionsDoc(prev => ({ ...(prev || {}), users: json.users }));
          // if we just saved the currently selected user, update visibleItems from returned map
          const usersMap = json.users;
          if (usersMap && usersMap[selected]) {
            const sidebar = usersMap[selected] as Record<string, boolean>;
            const keys = Object.keys(sidebar || {}).filter(k => !!sidebar[k]);
            setVisibleItems(keys);
          }
        }
      } catch (e) {
        // ignore parse errors
      }

      setMessage('Kaydedildi');
      // Notify other parts of the app (Sidebar) that permissions changed so they can reload
      try { window.dispatchEvent(new Event('permissions:changed')); } catch (e) { /* ignore */ }
    } catch (err) {
      console.error('Save error', err);
      setMessage('Kaydetme hatası; konsolu kontrol edin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="col-span-1">
        <h4 className="font-semibold mb-2">Kullanıcılar</h4>
        <div className="flex gap-2 mb-2">
          <button className="btn" onClick={() => loadUsers()} disabled={fetching}>{fetching ? 'Yenileniyor...' : 'Yenile'}</button>
          <div className="text-sm text-muted-foreground self-center">{message}</div>
        </div>

        <div className="space-y-1 max-h-72 overflow-auto">
          {users.length === 0 && <div className="text-sm text-muted-foreground">Kullanıcı listesi boş. Yukarıdan 'Yenile' ile yeniden deneyin. (Kullanıcılar Firestore'daki `users` map'inden çekilir.)</div>}
          {users.map(u => (
            <button key={u.uid} className={`w-full text-left px-3 py-2 rounded ${selected===u.uid? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'}`} onClick={() => setSelected(u.uid)}>
              <div className="text-sm font-medium">{u.email || u.uid}</div>
              <div className="text-xs text-muted-foreground">{u.name || ''}</div>
            </button>
          ))}
        </div>

        {/* Manual UID add removed — users are loaded directly from Firestore `users` map */}
      </div>

      <div className="col-span-2">
        <h4 className="font-semibold mb-2">Sidebar Görünürlük Ayarları</h4>
        {!selected && <div className="text-sm text-muted-foreground">Soldan bir kullanıcı seçin.</div>}
        {selected && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {SIDEBAR_ITEMS.map(item => (
                <label key={item} className="flex items-center gap-2 p-2 border rounded">
                  <input type="checkbox" checked={visibleItems.includes(item)} onChange={() => toggleItem(item)} />
                  <span className="truncate">{item}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={save} disabled={loading}>{loading ? 'Kaydediliyor...' : 'Kaydet'}</Button>
              <Button variant="outline" onClick={() => { setSelected(null); setVisibleItems([]); }}>Vazgeç</Button>
            </div>
            {message && <div className="mt-2 text-sm">{message}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
