// Firebase-first User Settings Hook
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import firebaseConfigService, { UserConfig } from '../services/firebaseConfig';

// Hook dönüş tipi
interface UseUserSettingsReturn {
  config: UserConfig | null;
  isLoading: boolean;
  error: string | null;
  // Actions
  updateConfig: (updates: Partial<Omit<UserConfig, 'meta'>>) => Promise<void>;
  saveConfig: (config: UserConfig) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  // Status
  isConfigured: boolean;
  hasValidSupabase: boolean;
  hasValidApis: boolean;
  hasValidFirebase: boolean;
  hasValidGoogleSheets: boolean;
}

export function useUserSettings(): UseUserSettingsReturn {
  const { user, isLoading: authLoading } = useAuth();
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Config'i yükle - Sadece authenticated kullanıcılar için
  const loadConfig = useCallback(async () => {
    const currentUserId = user?.uid;
    
    // GÜVENLİK: Kullanıcı giriş yapmamışsa config yükleme
    if (!currentUserId) {
      console.log('🔒 Güvenlik: Kullanıcı authenticate olmamış, config yüklenmiyor');
      setConfig(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('🔍 Authenticated kullanıcı için Firebase config yükleniyor...');

      // Sadece Firebase'dan yükle - güvenli yöntem
      let userConfig = null;
      
      try {
        userConfig = await firebaseConfigService.getUserConfig(currentUserId);
      } catch (firebaseError: any) {
        console.error('❌ Firebase\'den config yükleme hatası:', firebaseError);
        setError('Konfigürasyon yüklenemedi. Lütfen tekrar deneyin.');
        setIsLoading(false);
        return;
      }

      if (!userConfig) {
        // GÜVENLİK: LocalStorage migration sadece authenticated kullanıcılar için
        const hasLocalStorage = localStorage.getItem('doc_search_configs_json');
        
        if (hasLocalStorage) {
          try {
            console.log('🔄 GÜVENLİ: Authenticated kullanıcı için localStorage migration başlatılıyor...');
            const localSettings = JSON.parse(hasLocalStorage);
            userConfig = await firebaseConfigService.migrateFromLocalStorage(currentUserId, localSettings);
            
            // GÜVENLİK: Migration başarılıysa localStorage'ı hemen temizle
            localStorage.removeItem('doc_search_configs_json');
            console.log('🧹 GÜVENLİK: LocalStorage temizlendi - hassas veriler kaldırıldı');
            
            // Diğer olası localStorage key'lerini de temizle
            const keysToClean = [
              'supabase_url', 'supabase_anon_key', 
              'openai_api_key', 'deepseek_api_key',
              'user_settings', 'api_keys'
            ];
            keysToClean.forEach(key => {
              if (localStorage.getItem(key)) {
                localStorage.removeItem(key);
                console.log(`🧹 GÜVENLİK: ${key} localStorage'dan temizlendi`);
              }
            });
            
          } catch (migrationError) {
            console.error('❌ Güvenli migration hatası:', migrationError);
            userConfig = await firebaseConfigService.createDefaultUserConfig(currentUserId);
          }
        } else {
          // Tamamen yeni kullanıcı - sadece Firestore'dan default config
          console.log('🏗️ Yeni kullanıcı için güvenli Firestore config oluşturuluyor...');
          userConfig = await firebaseConfigService.createDefaultUserConfig(currentUserId);
        }
      } else {
        // Mevcut kullanıcı - config'i app-config.js ile tamamla
        console.log('🔄 Mevcut kullanıcı tespit edildi, config enhancement kontrol ediliyor...');
        const enhancedConfig = await firebaseConfigService.enhanceExistingConfig(currentUserId);
        if (enhancedConfig) {
          userConfig = enhancedConfig;
        }
      }

      setConfig(userConfig);
      console.log('🎯 useUserSettings: Config başarıyla yüklendi ve set edildi');
      
    } catch (err: any) {
      console.error('❌ useUserSettings: Config yükleme hatası:', err);
      setError(err.message || 'Config yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]); // user?.uid dependency'si gerekli

  // Config güncelle (kısmi)
  const updateConfig = useCallback(async (updates: Partial<Omit<UserConfig, 'meta'>>) => {
    const currentUserId = user?.uid;
    if (!currentUserId || !config) {
      throw new Error('Kullanıcı giriş yapmamış veya config yok');
    }

    try {
      await firebaseConfigService.updateUserConfig(currentUserId, updates);
      
      // Local state'i de güncelle
      setConfig(prev => prev ? { ...prev, ...updates } : null);
    } catch (err: any) {
      setError(err.message || 'Config güncellenemedi');
      throw err;
    }
  }, [user?.uid, config]);

  // Tam config kaydet
  const saveConfig = useCallback(async (newConfig: UserConfig) => {
    const currentUserId = user?.uid;
    if (!currentUserId) {
      throw new Error('Kullanıcı giriş yapmamış');
    }

    try {
      await firebaseConfigService.saveUserConfig(currentUserId, newConfig);
      setConfig(newConfig);
    } catch (err: any) {
      setError(err.message || 'Config kaydedilemedi');
      throw err;
    }
  }, [user?.uid]);

  // Default ayarlara sıfırla
  const resetToDefaults = useCallback(async () => {
    const currentUserId = user?.uid;
    if (!currentUserId) {
      throw new Error('Kullanıcı giriş yapmamış');
    }

    try {
      const defaultConfig = await firebaseConfigService.createDefaultUserConfig(currentUserId);
      setConfig(defaultConfig);
    } catch (err: any) {
      setError(err.message || 'Config sıfırlanamadı');
      throw err;
    }
  }, [user?.uid]);

  // Auth değişikliklerinde config'i yükle - sadece bir kez
  useEffect(() => {
    if (!authLoading && user?.uid) {
      loadConfig();
    } else if (!authLoading && !user?.uid) {
      // User logged out - clear config
      setConfig(null);
      setIsLoading(false);
    }
  }, [authLoading, user?.uid, loadConfig]);

  // Real-time Firebase listener - sadece gerektiğinde
  useEffect(() => {
    if (!user?.uid || !config) return; // Config yüklenmeden listener başlatma
    let unsubscribe: (() => void) | null = null;

    // Allow pausing remote sync while user edits locally
    const pausedRef = (useRef as any)('_unused_paused_ref');
    // If firebaseConfigService exposes an on-change subscribe, we'll use a local paused flag
    try {
      // create a pausedRef on module-level (memoized via ref stored on this hook instance)
      const localPausedRef = (useRef as any)({ current: false });

      // attach to firebaseConfigService if not present (back-compat)
      (firebaseConfigService as any)._pausedRef = localPausedRef;

      unsubscribe = firebaseConfigService.onUserConfigChange(user.uid, (updatedConfig) => {
        try {
          if ((firebaseConfigService as any)._pausedRef?.current) {
            // skip applying remote updates while paused
            return;
          }
        } catch (e) {
          // ignore
        }

        if (updatedConfig) {
          setConfig(prev => {
            // Sadece gerçekten değişmişse güncelle
            if (prev && JSON.stringify(prev) !== JSON.stringify(updatedConfig)) {
              console.log('🔄 Firebase\'den config değişikliği alındı');
              return updatedConfig;
            }
            return prev;
          });
        }
      });
    } catch (firebaseError) {
      // Firebase offline durumunda listener olmadan devam et
      console.log('📴 Firebase listener başlatılamadı, offline mode');
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.uid]); // Sadece user ID'ye bağlı

  // Expose functions to pause/resume remote sync (useful while editing forms)
  const suspendRemoteSync = useCallback(() => {
    try {
      if ((firebaseConfigService as any)._pausedRef) (firebaseConfigService as any)._pausedRef.current = true;
    } catch (e) {
      // ignore
    }
  }, []);

  const resumeRemoteSync = useCallback(() => {
    try {
      if ((firebaseConfigService as any)._pausedRef) (firebaseConfigService as any)._pausedRef.current = false;
    } catch (e) {
      // ignore
    }
  }, []);

  // Computed properties
  const isConfigured = Boolean(config);
  const hasValidSupabase = Boolean(config?.supabase.url && config?.supabase.anonKey);
  const hasValidApis = Boolean(config?.apis.openai || config?.apis.deepseek);
  const hasValidFirebase = Boolean(config?.firebase?.apiKey && config?.firebase?.projectId);
  const hasValidGoogleSheets = Boolean(config?.googleSheets?.clientId && config?.googleSheets?.spreadsheetId);

  return {
    config,
    isLoading,
    error,
    updateConfig,
    saveConfig,
    resetToDefaults,
    isConfigured,
    hasValidSupabase,
    hasValidApis,
    hasValidFirebase,
    hasValidGoogleSheets,
    // Controls for pausing/resuming remote sync
    suspendRemoteSync,
    resumeRemoteSync
  } as any;
}

// Convenience hook - sadece değerlere erişim için
export function useUserConfig() {
  const { config } = useUserSettings();
  return config;
}

// Backwards compatibility - eski UserSettings interface için adapter
export function useUserSettingsLegacy() {
  const { config, updateConfig, saveConfig, isLoading, error } = useUserSettings();
  
  // Eski format'a dönüştür (backward compatibility için)
  const settings = config ? {
    supabase: config.supabase,
    deepseek: { apiKey: config.apis.deepseek },
    openai: { apiKey: config.apis.openai },
    enableAI: config.search.enableAI,
    vectorThreshold: config.search.vectorThreshold,
    vectorWeight: config.search.vectorWeight,
    textWeight: config.search.textWeight,
    textScoreMethod: config.search.textScoreMethod
  } : null;

  // Yeni config formatları için helper'lar
  const getFirebaseConfig = () => config?.firebase;
  const getGoogleSheetsConfig = () => config?.googleSheets;
  const getServerConfig = () => config?.server;

  const saveUserSettings = async (newSettings: any) => {
    if (!config) return;
    
    const updatedConfig: UserConfig = {
      ...config,
      supabase: newSettings.supabase,
      apis: {
        openai: newSettings.openai?.apiKey || '',
        deepseek: newSettings.deepseek?.apiKey || ''
      },
      search: {
        enableAI: newSettings.enableAI ?? true,
        vectorThreshold: newSettings.vectorThreshold ?? 0.3,
        vectorWeight: newSettings.vectorWeight ?? 0.3,
        textWeight: newSettings.textWeight ?? 0.7,
        textScoreMethod: newSettings.textScoreMethod || 'overlap'
      }
    };
    
    await saveConfig(updatedConfig);
  };

  return {
    settings,
    isLoading,
    error,
    saveUserSettings,
    // Yeni config helper'ları
    getFirebaseConfig,
    getGoogleSheetsConfig,
    getServerConfig,
    // Tam config erişimi
    fullConfig: config
  };
}
