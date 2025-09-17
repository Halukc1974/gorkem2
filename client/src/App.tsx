import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import Dashboard from "./pages/dashboard";
import SheetView from "./pages/sheet-view";
import { FinancialPage } from "./pages/financial";
import ProjectsPage from "./pages/projects";
import DocumentSearchPage from "./pages/document-search";
import AISearchPage from "./pages/ai-search";
import InfoCenterPage from "./pages/info-center";
import Login from "./pages/login";
import AdisIndexPage from "./pages/adis_index";
import Sidebar from "./components/sidebar";
import LoadingOverlay from "./components/loading-overlay";
import { useState, useEffect } from "react";
import { useIsMobile } from "./hooks/use-mobile";
import { useAuth } from "./hooks/useAuth";
import { useUserSettings } from "./hooks/useUserSettings";
import { useDocumentSearch } from "./hooks/useDocumentSearch";
import { DEV_SUPABASE_CONFIG } from "./dev-supabase-config";
import { Button } from "./components/ui/button";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/projects" component={ProjectsPage} />
      <Route path="/projects/info-center" component={InfoCenterPage} />
      <Route path="/ai-search/adis_index" component={AdisIndexPage} />
      <Route path="/financial" component={FinancialPage} />
      <Route path="/document-search" component={DocumentSearchPage} />
      <Route path="/ai-search" component={AISearchPage} />
      <Route path="/sheets/:id" component={SheetView} />
      <Route component={Dashboard} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true); // Sidebar görünürlüğü için state
  const [sidebarWidth, setSidebarWidth] = useState(320); // Sidebar genişliği için state
  const isMobile = useIsMobile();
  const { user, signOut } = useAuth();
  const { config } = useUserSettings();
  const { configureServices } = useDocumentSearch();

  // Global config watcher - Otomatik servis konfigürasyonu
  useEffect(() => {
    if (!config) return;
    
    console.log('🌐 Global: Config değişikliği tespit edildi, servisleri otomatik konfigüre ediliyor...');
    
    // Config'i eski formata çevir
    const serviceConfigs = {
      supabase: config.supabase?.url && config.supabase?.anonKey ? {
        url: config.supabase.url,
        anonKey: config.supabase.anonKey
      } : undefined,
      deepseek: config.apis?.deepseek ? {
        apiKey: config.apis.deepseek
      } : undefined,
      openai: config.apis?.openai ? {
        apiKey: config.apis.openai
      } : undefined
    };

    // Sadece geçerli config'ler varsa configure et
    if (serviceConfigs.supabase || serviceConfigs.deepseek || serviceConfigs.openai) {
      try {
        configureServices(serviceConfigs);
        console.log('✅ Global: Servisler başarıyla otomatik konfigüre edildi');
      } catch (error) {
        console.error('❌ Global: Otomatik servis konfigürasyonu başarısız:', error);
      }
    }
  }, [config, configureServices]);

  // Development-only: if no UI config provided but a dev config exists, configure services
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    // If user settings config doesn't include supabase, but we have a dev config, apply it
    if ((!config || !config.supabase) && DEV_SUPABASE_CONFIG.url && DEV_SUPABASE_CONFIG.anonKey) {
      try {
        console.log('🔧 Dev: Applying local Supabase test config from dev-supabase-config.ts');
        configureServices({ supabase: { url: DEV_SUPABASE_CONFIG.url, anonKey: DEV_SUPABASE_CONFIG.anonKey } });
      } catch (err) {
        console.error('❌ Dev: Failed to apply Supabase test config:', err);
      }
    }
  }, [config, configureServices]);

  const handleLogout = async () => {
    try {
      await signOut();
      window.location.reload();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        isMobile={isMobile}
        isVisible={isSidebarVisible}
        width={sidebarWidth}
      />
      
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex h-16 flex-shrink-0 items-center justify-between px-6 bg-card border-b border-border">
          <div className="flex items-center">
            {isMobile ? (
              <button 
                className="mr-4 p-2 rounded-md hover:bg-accent"
                onClick={() => setSidebarOpen(true)}
                data-testid="button-toggle-sidebar"
              >
                <i className="fas fa-bars h-5 w-5"></i>
              </button>
            ) : (
              <button 
                className="mr-4 p-2 rounded-md hover:bg-accent flex items-center gap-2"
                onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                data-testid="button-toggle-sidebar-desktop"
              >
                <i className={`fas fa-${isSidebarVisible ? 'times' : 'bars'} h-5 w-5`}></i>
                <span>{isSidebarVisible ? 'Menüyü Gizle' : 'Menüyü Göster'}</span>
              </button>
            )}
            <h2 className="text-xl font-semibold text-foreground" data-testid="text-page-title">
              Görkem İnşaat
            </h2>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                <span className="text-green-600">Bağlı</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="fas fa-envelope text-blue-500"></i>
                <span className="text-muted-foreground">{(user as any)?.email || 'Kullanıcı'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground" title="Son senkronizasyon zamanı">
                <i className="fas fa-sync-alt h-4 w-4 text-blue-500"></i>
                <span data-testid="text-last-sync">{new Date().toLocaleTimeString('tr-TR')}</span>
              </div>
            </div>
            
            {user && (
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleLogout}
                  data-testid="button-logout"
                >
                  Çıkış
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Main content area */}
        <main className="flex-1 overflow-auto bg-background">
          <Router />
        </main>
      </div>
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return isAuthenticated ? <AuthenticatedApp /> : <Login />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <LoadingOverlay />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
