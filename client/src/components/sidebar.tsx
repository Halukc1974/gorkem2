import { useLocation } from "wouter";
import { Button } from "../components/ui/button";
import CreateSheetModal from "./create-sheet-modal";
import { useState, useEffect } from "react";
import { useToast } from "../hooks/use-toast";
// Google Sheets integration removed for Info Center migration
import { apiRequest } from "../lib/queryClient";
import firebaseConfigService from '../services/firebaseConfig';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import RenameSheetModal from "./rename-sheet-modal";
import { 
  Search, Network, Brain, Cpu, CircuitBoard, Sparkles, Settings 
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
  width?: number;
  isVisible?: boolean;
}

export default function Sidebar({ isOpen, onClose, isMobile, isVisible = true, width = 320 }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { toast } = useToast();
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const ADMIN_EMAIL = 'gorkeminsaat1@gmail.com'; // Only admin can see Settings

  // sheets list removed; Info Center will use Supabase instead
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    sheetId?: string;
    sheetName?: string;
  }>({ visible: false, x: 0, y: 0 });
  const [showRenameModal, setShowRenameModal] = useState(false);

  const handleNavigation = (path: string) => {
    setLocation(path);
    if (isMobile) {
      onClose();
    }
  };

  const handleDeleteSheet = (sheetTabId: number, sheetName: string) => {
    // Client-side sheet deletion is deprecated; this is a safe no-op.
    if (!confirm(`Are you sure you want to delete the sheet "${sheetName}"?`)) return;
    try {
      // If a delete mutation exists, call it; otherwise show a toast explaining deprecation.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const maybeDelete: any = (globalThis as any).deleteSheetMutation;
      if (maybeDelete && typeof maybeDelete.mutate === 'function') {
        maybeDelete.mutate({ sheetTabId }, {
          onSuccess: () => {
            toast({ title: 'Sheet Deleted', description: 'Sheet was successfully deleted.' });
          },
          onError: () => {
            toast({ title: 'Delete Error', description: 'An error occurred while deleting the sheet.', variant: 'destructive' });
          }
        });
      } else {
        toast({ title: 'Operation Not Supported', description: 'Client-side sheet deletion is no longer supported.' });
      }
    } catch (e: any) {
      toast({ title: 'Error', description: 'An error occurred while deleting the sheet.', variant: 'destructive' });
    }
  };

  const handleRenameSheet = async (sheetId: string, currentName: string) => {
    setShowRenameModal(true);
    setContextMenu({ ...contextMenu, visible: false });
  };

  // Runtime hide-list (default from runtime config)
  // This value can be augmented by per-user permissions fetched from the server.
  const defaultHideList: string[] = (typeof window !== "undefined" && (window as any).__APP_CONFIG__?.HIDE_SIDEBAR_ITEMS) || [];
  const [hideSidebarItems, setHideSidebarItems] = useState<string[]>(defaultHideList);

  useEffect(() => {
    let mounted = true;

    const computeAndSet = (entry: any) => {
      console.log('[SIDEBAR DEBUG] computeAndSet called with entry:', JSON.stringify(entry, null, 2));
      
      const knownKeys = [
        'settings','projects-summary','dashboard','financial-dashboard','document-search','n8n-vector-search','ai-search','projects/info-center','decision-support'
      ];
      console.log('[SIDEBAR DEBUG] knownKeys:', knownKeys);
      
      let expectedHide: string[] = defaultHideList;
      console.log('[SIDEBAR DEBUG] defaultHideList:', defaultHideList);
      
      try {
        const mapSrc = (entry?.sidebar && typeof entry.sidebar === 'object') ? entry.sidebar : (typeof entry === 'object' ? entry : null);
        console.log('[SIDEBAR DEBUG] mapSrc:', JSON.stringify(mapSrc, null, 2));
        
        if (mapSrc && Object.values(mapSrc).some(v => typeof v === 'boolean')) {
          console.log('[SIDEBAR DEBUG] Using boolean map logic');
          expectedHide = knownKeys.filter(k => {
            const inMap = k in mapSrc;
            const mapValue = mapSrc[k];
            const shouldHide = !(k in mapSrc) || !mapSrc[k];
            console.log(`[SIDEBAR DEBUG] Key '${k}': inMap=${inMap}, mapValue=${mapValue}, shouldHide=${shouldHide}`);
            return shouldHide;
          });
        } else if (entry?.ui && Array.isArray(entry.ui.sidebarVisible)) {
          console.log('[SIDEBAR DEBUG] Using sidebarVisible array logic');
          const visible = entry.ui.sidebarVisible as string[];
          console.log('[SIDEBAR DEBUG] sidebarVisible array:', visible);
          expectedHide = knownKeys.filter(k => {
            const isVisible = visible.includes(k);
            console.log(`[SIDEBAR DEBUG] Key '${k}': isVisible=${isVisible}`);
            return !isVisible;
          });
        } else {
          console.log('[SIDEBAR DEBUG] No valid permission structure found, using default');
        }
      } catch (e) {
        console.log('[SIDEBAR DEBUG] Error in computeAndSet:', e);
        expectedHide = defaultHideList;
      }
      
      console.log('[SIDEBAR DEBUG] Final expectedHide:', expectedHide);
      setHideSidebarItems(expectedHide);
    };    const load = async () => {
      try {
        console.log('[SIDEBAR DEBUG] Starting permission load...');
        
        // First, try client-side Firestore read of the centralized permissions document (if configured)
        try {
          const appConfig = (window as any).__APP_CONFIG__ || {};
          const docId = appConfig?.PERMISSIONS_DOC_ID || null;
          const coll = appConfig?.PERMISSIONS_COLLECTION || 'userConfigs';
          console.log('[SIDEBAR DEBUG] App config:', { docId, coll });
          
          if (docId) {
            const doc = await firebaseConfigService.getPermissionsDoc(docId, coll).catch(() => null);
            console.log('[SIDEBAR DEBUG] Firestore doc result:', doc ? 'found' : 'not found');
            
            if (doc) {
              // If doc contains a users map, prefer that map for the currently logged-in user
              if (doc.users && typeof doc.users === 'object') {
                const usersMap = doc.users as Record<string, any>;
                console.log('[SIDEBAR DEBUG] Found users map with keys:', Object.keys(usersMap));

                // Try to obtain the current user's email from client-side auth. If auth isn't
                // initialized yet, wait briefly (up to 2s) for onAuthStateChanged to fire.
                const getEmail = () => new Promise<string | null>(async (resolve) => {
                  try {
                    const cur = auth && (auth.currentUser as any);
                    if (cur && cur.email) return resolve(cur.email);

                    // Wait briefly for client-side auth state to initialize (up to 4s)
                    let unsub: (() => void) | null = null;
                    const waited = new Promise<string | null>((res) => {
                      try {
                        unsub = onAuthStateChanged(auth as any, (u) => {
                          if (unsub) unsub();
                          res((u as any)?.email || null);
                        });
                      } catch (e) {
                        res(null);
                      }
                    });

                    const timeout = new Promise<string | null>((res) => setTimeout(() => { if (unsub) unsub(); res(null); }, 4000));
                    const fromClient = await Promise.race([waited, timeout]);
                    if (fromClient) return resolve(fromClient);

                    // If client-side auth not available, try server session endpoint as a fallback
                    try {
                      const r = await fetch('/api/auth/user', { credentials: 'include' });
                      if (r.ok) {
                        const j = await r.json().catch(() => null) as any;
                        // Try common shapes: { email } or { user: { email } }
                        const maybe = j?.email || j?.user?.email || null;
                        if (maybe) return resolve(maybe);
                      }
                    } catch (e) {
                      // ignore and return null
                    }

                    return resolve(null);
                  } catch (e) { resolve(null); }
                });

                const email = await getEmail();
                console.log('[SIDEBAR DEBUG] Current user email:', email);
                
                // Set current user email for Settings visibility check
                if (mounted) {
                  setCurrentUserEmail(email);
                }
                
                let entry = null as any;
                // Try direct email key
                if (email && usersMap[email]) {
                  entry = usersMap[email];
                  console.log('[SIDEBAR DEBUG] Found entry by email key:', email);
                }
                // Try direct uid key
                const cur = auth && (auth.currentUser as any);
                const uid = cur?.uid || null;
                console.log('[SIDEBAR DEBUG] Current user uid:', uid);
                
                if (!entry && uid && usersMap[uid]) {
                  entry = usersMap[uid];
                  console.log('[SIDEBAR DEBUG] Found entry by uid key:', uid);
                }
                // Try case-insensitive match
                if (!entry && email) {
                  const lower = email.toLowerCase().trim();
                  const foundKey = Object.keys(usersMap).find(k => String(k).toLowerCase().trim() === lower);
                  if (foundKey) {
                    entry = usersMap[foundKey];
                    console.log('[SIDEBAR DEBUG] Found entry by case-insensitive email match:', foundKey);
                  }
                }
                // Try normalized gmail local-part (remove dots and +suffix)
                if (!entry && email && email.includes('@')) {
                  const [local, domain] = email.split('@');
                  if (domain && domain.toLowerCase().includes('gmail')) {
                    const normalized = local.split('+')[0].replace(/\./g, '').toLowerCase();
                    const foundKey = Object.keys(usersMap).find(k => {
                      try {
                        const kk = String(k).toLowerCase();
                        return kk.includes(normalized) && kk.includes(domain.toLowerCase());
                      } catch (e) { return false; }
                    });
                    if (foundKey) {
                      entry = usersMap[foundKey];
                      console.log('[SIDEBAR DEBUG] Found entry by Gmail normalization:', foundKey);
                    }
                  }
                }
                // Last resort: try any key whose value looks like a per-user object (has boolean sidebar or ui)
                if (!entry) {
                  for (const k of Object.keys(usersMap)) {
                    const v = usersMap[k];
                    if (v && typeof v === 'object' && (v.sidebar || v.ui)) {
                      // Skip if the key obviously is an email different than current email
                      if (email && String(k).toLowerCase().trim() === String(email).toLowerCase().trim()) { 
                        entry = v; 
                        console.log('[SIDEBAR DEBUG] Found entry by last resort match:', k);
                        break; 
                      }
                    }
                  }
                }
                // Guard: ensure we didn't accidentally pick the entire users map as the entry
                if (entry && typeof entry === 'object') {
                  // If entry looks like a users map (many keys that look like emails), ignore it
                  const entryKeys = Object.keys(entry || {});
                  const looksLikeUsersMap = entryKeys.length > 5 && entryKeys.every(ek => ek.includes('@'));
                  if (looksLikeUsersMap) {
                    console.log('[SIDEBAR DEBUG] Entry looks like users map, ignoring');
                    entry = null;
                  }
                }
                if (entry) {
                  console.log('[SIDEBAR DEBUG] Using entry:', JSON.stringify(entry, null, 2));
                  computeAndSet(entry);
                  return;
                } else {
                  console.log('[SIDEBAR DEBUG] No entry found in users map');
                }
                // If we couldn't resolve client-side email or no entry exists, fall back to server endpoint.
              } else {
                console.log('[SIDEBAR DEBUG] No users map found in doc, using doc directly');
                // Document is already the per-user map or a flat permissions object
                computeAndSet(doc);
                return;
              }
            }
          }
        } catch (e) {
          console.log('[SIDEBAR DEBUG] Client-side Firestore read failed:', e);
          // ignore and fall back to server endpoint
        }

        console.log('[SIDEBAR DEBUG] Falling back to server endpoint /api/permissions/me');
  // Fallback to server endpoint which requires a server session
        const res = await fetch('/api/permissions/me', { credentials: 'include' });
        if (!res.ok) {
          console.log('[SIDEBAR DEBUG] Server endpoint failed:', res.status, res.statusText);
          computeAndSet(null);
          return;
        }
        const data = await res.json();
        console.log('[SIDEBAR DEBUG] Server endpoint returned:', JSON.stringify(data, null, 2));
        computeAndSet(data);
      } catch (err) {
        console.log('[SIDEBAR DEBUG] Load error:', err);
        computeAndSet(null);
      }
    };

    load();

    // Re-run loading when permissions change and when Firebase auth state changes (so client-side email becomes available)
    const listener = () => load();
    window.addEventListener('permissions:changed', listener);
    let unsubAuth: (() => void) | null = null;
    try {
      unsubAuth = onAuthStateChanged(auth as any, () => load());
    } catch (e) {
      // ignore if auth not available
    }

    return () => { mounted = false; window.removeEventListener('permissions:changed', listener); if (unsubAuth) unsubAuth(); };
  }, [defaultHideList]);

  const sidebarContent = (
    <div className="flex h-full flex-col bg-card border-r border-border">
      {/* Header */}
      <div className="flex h-16 flex-shrink-0 items-center px-6 border-b border-border">
        <div className="flex items-center">
          <i className="fas fa-building text-primary text-2xl mr-3"></i>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Görkem Construction</h1>
            <p className="text-sm text-muted-foreground">Document Management System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {/* Settings - Only visible to admin user (gorkeminsaat1@gmail.com) */}
        {currentUserEmail === ADMIN_EMAIL && (
          <button
            onClick={() => handleNavigation('/settings')}
            className={`w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              location === "/settings"
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
            data-testid="nav-settings"
          >
            <i className="fas fa-cog mr-3 h-5 w-5"></i>
            <Settings className="h-5 w-5 mr-3" />
            Settings
          </button>
        )}

        {!hideSidebarItems.includes("projects-summary") && (
          <button
            onClick={() => handleNavigation("/projects")}
            className={`w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              location === "/projects" 
                ? "bg-primary text-primary-foreground" 
                : "text-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
            data-testid="nav-projects"
          >
            <i className="fas fa-building mr-3 h-5 w-5"></i>
            🏗️ Projects Summary
          </button>
        )}

        {!hideSidebarItems.includes("dashboard") && (
          <button
            onClick={() => handleNavigation("/")}
            className={`w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              location === "/" 
                ? "bg-primary text-primary-foreground" 
                : "text-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
            data-testid="nav-dashboard"
          >
            <i className="fas fa-chart-line mr-3 h-5 w-5"></i>
            📊 Dashboard
          </button>
        )}

        {!hideSidebarItems.includes("financial-dashboard") && (
          <button
            onClick={() => handleNavigation("/financial")}
            className={`w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              location === "/financial" 
                ? "bg-primary text-primary-foreground" 
                : "text-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
            data-testid="nav-financial"
          >
            <i className="fas fa-chart-bar mr-3 h-5 w-5"></i>
            Financial Dashboard
          </button>
        )}

        {!hideSidebarItems.includes("document-search") && (
          <button
            onClick={() => handleNavigation("/document-search")}
            className={`w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              location === "/document-search" 
                ? "bg-primary text-primary-foreground" 
                : "text-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
            data-testid="nav-document-search"
          >
            <i className="fas fa-search mr-3 h-5 w-5"></i>
            🔍 Document Search
          </button>
        )}

        {/* Decision Support System - Commented out for all users
        {!hideSidebarItems.includes("decision-support") && (
          <button
            onClick={() => handleNavigation("/decision-support")}
            className={`w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              location === "/decision-support" 
                ? "bg-primary text-primary-foreground" 
                : "text-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
            data-testid="nav-decision-support"
          >
            <i className="fas fa-brain mr-3 h-5 w-5"></i>
            🧠 Decision Support System
          </button>
        )}
        */}

        {/* {!hideSidebarItems.includes("decision-support-template") && (
          <button
            onClick={() => handleNavigation("/decision-support-template")}
            className={`w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              location === "/decision-support-template"
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
            data-testid="nav-decision-support-template"
          >
            <i className="fas fa-file-alt mr-3 h-5 w-5"></i>
            📋 Decision Support Template
          </button>
        )} */}

        {!hideSidebarItems.includes('n8n-vector-search') && (
          <button
            onClick={() => handleNavigation('/n8n-vector-search')}
            className={`w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              location === "/n8n-vector-search"
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
            data-testid="nav-n8n-vector-search"
          >
            {/* Red magnifier icon for N-starting item */}
            <i className="fas fa-search mr-3 h-5 w-5 text-destructive"></i>
            <span className="truncate inline-flex items-center">
      <span className="text-red-500 mr-1">🔍</span>
      n8n-vector-search
    </span>
          </button>
        )}

        {!hideSidebarItems.includes("ai-search") && (
          <button
  onClick={() => handleNavigation("/ai-search")}
  className={`w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
    ${location === "/ai-search" 
      ? "bg-primary text-primary-foreground" 
      : "text-foreground hover:bg-accent hover:text-accent-foreground"} pl-[5ch]`}
  data-testid="nav-ai-search"
>
  <Search className="h-5 w-5 mr-3" />
  <span className="truncate">Document Search & Analysis</span>
</button>
        )}
        
        {/* Nested links for AI Search */}
        <div className="ml-6 mt-1 space-y-1"> 
          <button
            onClick={() => handleNavigation('/ai-search/adis_index')}
            className={`w-full flex items-center px-3 py-2 text-sm rounded-md transition-colors pl-[1ch] ${
              location === '/ai-search/adis_index' ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
            data-testid="nav-ai-adis"
          >
            <span className="pl-[1.5ch]">📤</span>
            <span className="ml-[1ch] truncate">Upload Document</span>
          </button>
        </div>

        {/* Info Center link (replaces Google Sheets list) */}
        <div className="mt-6">
          <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Projects
          </h3>
          <div className="mt-2">
            {!hideSidebarItems.includes("projects/info-center") && (
              <div
                className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  location === "/projects/info-center" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <button
                  onClick={() => handleNavigation('/projects/info-center')}
                  className="flex items-center flex-1 text-left"
                  data-testid={`nav-info-center`}
                >
                  <i className="fas fa-info-circle mr-3 h-4 w-4 text-muted-foreground"></i>
                  <span className="truncate">INFO CENTER</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Create Sheet Modal */}
      {showCreateModal && (
        <CreateSheetModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
          }}
        />
      )}

      {/* Context menu */}
          {contextMenu.visible && (
        <div
          className="fixed z-50 bg-card border border-border rounded shadow-md p-2"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={() => setContextMenu({ ...contextMenu, visible: false })}
        >
          <button
            className="block w-full text-left px-3 py-1 hover:bg-accent rounded"
            onClick={() => {
              if (contextMenu.sheetId) handleNavigation(`/sheets/${contextMenu.sheetId}`);
              setContextMenu({ ...contextMenu, visible: false });
            }}
          >
            Aç
          </button>
          <button
            className="block w-full text-left px-3 py-1 hover:bg-accent rounded"
            onClick={() => {
              if (contextMenu.sheetId && contextMenu.sheetName) handleRenameSheet(contextMenu.sheetId, contextMenu.sheetName);
              setContextMenu({ ...contextMenu, visible: false });
            }}
          >
            Yeniden Adlandır
          </button>
                <button
            className="block w-full text-left px-3 py-1 hover:bg-destructive rounded"
            onClick={() => {
              try {
                // sheets may not exist in the client anymore; attempt to access safely
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const maybeSheets: any[] = (globalThis as any).sheets || [];
                if (contextMenu.sheetId) {
                  const s = maybeSheets.find(s => s.id === contextMenu.sheetId);
                  if (s) handleDeleteSheet(s.sheetTabId, s.name);
                }
              } catch (err) {
                // ignore
              }
              setContextMenu({ ...contextMenu, visible: false });
            }}
          >
            Sil
          </button>
        </div>
      )}

      {/* Rename Modal */}
      <RenameSheetModal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        sheetId={contextMenu.sheetId || null}
        currentName={contextMenu.sheetName || ''}
        onSuccess={() => {
          setShowRenameModal(false);
          // navigate to sheet to reflect changes
          if (contextMenu.sheetId) setLocation(`/sheets/${contextMenu.sheetId}`);
        }}
      />
    </div>
  );

  if (isMobile) {
    return (
      <>
        {/* Mobile Sidebar Overlay */}
        {isOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div 
              className="fixed inset-0 bg-black bg-opacity-50" 
              onClick={onClose}
              data-testid="overlay-mobile-sidebar"
            ></div>
            <div className="fixed inset-y-0 left-0 w-80">
              {sidebarContent}
            </div>
          </div>
        )}
      </>
    );
  }

  // Desktop sidebar görünürlük kontrolü
  if (!isVisible) {
    return null;
  }

  return (
    <div className="hidden md:flex md:flex-col" style={{ width: width || 320 }}>
      {sidebarContent}
    </div>
  );
}
