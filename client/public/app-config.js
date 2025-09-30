// Runtime konfigürasyon dosyası - GÜVENL İK SÜRÜMÜ
// Hassas veriler GitHub repository rules nedeniyle kaldırılmıştır
// Gerçek değerler Firestore'dan runtime'da yüklenir

window.__APP_CONFIG__ = {
  // Production server URL (public bilgi)
  API_BASE_URL: "http://gorkemprojetakip.com.tr",
  
  // Firebase configuration - DEVELOPMENT VALUES (Production'da Firestore'dan yüklenecek)
  FIREBASE_API_KEY: "AIzaSyAHQMI414Cpg9zzcZLMVPi8EXtx8YC_ZpU", // DEVELOPMENT ONLY
  FIREBASE_AUTH_DOMAIN: "gorkemapp.firebaseapp.com", 
  FIREBASE_PROJECT_ID: "gorkemapp", // public bilgi
  FIREBASE_APP_ID: "1:216254903525:web:bdd3e3de632fbe66b3900c", // DEVELOPMENT ONLY
  FIREBASE_MEASUREMENT_ID: "G-PRM08VZW5T", // DEVELOPMENT ONLY
  
  // Google Sheets configuration - DEVELOPMENT VALUES (Production'da Firestore'dan yüklenecek)
  GOOGLE_SHEETS_CLIENT_ID: "798083510172-itlqrd900a6a0mcq82ua4o6kimf42sil.apps.googleusercontent.com", // DEVELOPMENT ONLY
  GOOGLE_SHEETS_PROJECT_ID: "gorkeminsaat", 
  GOOGLE_SHEETS_SPREADSHEET_ID: "1gOjceZ4DxORlbD1rTiGxgxoATvmKLVsIhyeE8UPtdlU", // DEVELOPMENT ONLY
  
  // Permissions configuration
  PERMISSIONS_DOC_ID: "BCAwiuzRcwOMYrwS6hQiCNnFMN33",
  PERMISSIONS_COLLECTION: "userConfigs",
  
  // Deployment Info
  VERSION: '1.0.0',
  BUILD_TIME: new Date().toISOString(),
  
  // Config yükleme durumu
  CONFIG_LOADED: false,
  CONFIG_SOURCE: 'placeholder' // placeholder | firestore | user-settings
};

// Convenience runtime flag to hide specific sidebar items without removing pages.
// Set to an array of keys to hide. Supported keys: 'projects-summary', 'dashboard', 'financial-dashboard'
// Example to hide: window.__APP_CONFIG__.HIDE_SIDEBAR_ITEMS = ['dashboard'];
// Default: hide the three requested sidebar items. Change this array to re-enable any item.
window.__APP_CONFIG__.HIDE_SIDEBAR_ITEMS = window.__APP_CONFIG__.HIDE_SIDEBAR_ITEMS || [
  'projects-summary',
  'dashboard',
  'financial-dashboard'
];
