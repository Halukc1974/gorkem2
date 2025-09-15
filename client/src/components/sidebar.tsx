import { useLocation } from "wouter";
import { Button } from "../components/ui/button";
import CreateSheetModal from "./create-sheet-modal";
import { useState } from "react";
import { useToast } from "../hooks/use-toast";
import { Brain } from "lucide-react";
// Google Sheets integration removed for Info Center migration
import { apiRequest } from "../lib/queryClient";
import RenameSheetModal from "./rename-sheet-modal";

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
    if (!confirm(`"${sheetName}" adlı sheet'i silmek istediğinizden emin misiniz?`)) return;
    try {
      // If a delete mutation exists, call it; otherwise show a toast explaining deprecation.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const maybeDelete: any = (globalThis as any).deleteSheetMutation;
      if (maybeDelete && typeof maybeDelete.mutate === 'function') {
        maybeDelete.mutate({ sheetTabId }, {
          onSuccess: () => {
            toast({ title: 'Sheet Silindi', description: 'Sheet başarıyla silindi.' });
          },
          onError: () => {
            toast({ title: 'Silme Hatası', description: 'Sheet silinirken bir hata oluştu.', variant: 'destructive' });
          }
        });
      } else {
        toast({ title: 'İşlem Desteklenmiyor', description: 'Client-side sheet silme artık desteklenmiyor.' });
      }
    } catch (err) {
      toast({ title: 'Hata', description: 'Sheet silme sırasında bir hata oluştu.', variant: 'destructive' });
    }
  };

  const handleRenameSheet = async (sheetId: string, currentName: string) => {
    setShowRenameModal(true);
    setContextMenu({ ...contextMenu, visible: false });
  };

  // Read runtime hide-list from `window.__APP_CONFIG__` (set in client/public/app-config.js)
  // This allows hiding sidebar items without deleting pages.
  const hideSidebarItems: string[] =
    (typeof window !== "undefined" && (window as any).__APP_CONFIG__?.HIDE_SIDEBAR_ITEMS) || [];

  const sidebarContent = (
    <div className="flex h-full flex-col bg-card border-r border-border">
      {/* Header */}
      <div className="flex h-16 flex-shrink-0 items-center px-6 border-b border-border">
        <div className="flex items-center">
          <i className="fas fa-building text-primary text-2xl mr-3"></i>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Görkem İnşaat</h1>
            <p className="text-sm text-muted-foreground">Proje Takip Sistemi</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
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
            🏗️ Projeler Özet Tablosu
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
            Finansal Dashboard
          </button>
        )}

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
          🔍 Belge Arama
        </button>

        <button
          onClick={() => handleNavigation("/ai-search")}
          className={`w-full group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            location === "/ai-search" 
              ? "bg-primary text-primary-foreground" 
              : "text-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
          data-testid="nav-ai-search"
        >
          <Brain className="mr-3 h-5 w-5 stroke-2" strokeLinejoin="round" />
          Yapay Zeka İle Ara
        </button>
        
        {/* Info Center link (replaces Google Sheets list) */}
        <div className="mt-6">
          <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Projeler
          </h3>
          <div className="mt-2">
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
