// Deprecated client-side Google Sheets stub
// The real Google Sheets integration has been removed from the client
// and replaced by Supabase-based Info Center. This stub keeps the
// same exported symbol so imports don't break, but methods are no-ops
// or throw informative errors.

class ClientGoogleSheetsServiceStub {
  async initialize() {
    console.warn('googleSheetsClient.initialize() called, but Google Sheets client is deprecated in client code.');
  }

  async signIn() {
    throw new Error('Google Sheets sign-in is deprecated in this client. Use server-side or remove calls.');
  }

  async signOut() {
    console.warn('googleSheetsClient.signOut() called on deprecated stub.');
  }

  isAuthenticated() {
    return false;
  }

  async getSpreadsheetInfo(_id: string) {
    return { title: 'deprecated', sheets: [] };
  }

  async getSheetData(_spreadsheetId: string, _sheetName: string) {
    return [] as any[][];
  }

  async appendSheetData(..._args: any[]): Promise<void> {
    // accept any args but remain a no-op for client
    return Promise.resolve();
  }

  async updateSheetData(..._args: any[]): Promise<void> {
    return Promise.resolve();
  }

  async createSheet(..._args: any[]): Promise<void> {
    return Promise.resolve();
  }

  async deleteSheet(..._args: any[]): Promise<void> {
    return Promise.resolve();
  }

  async renameSheet(..._args: any[]): Promise<void> {
    return Promise.resolve();
  }

  getTemplateHeaders(_template: string) {
    return ['Kolon 1', 'Kolon 2'];
  }
}

export const googleSheetsClient = new ClientGoogleSheetsServiceStub();
// Client-side Google Sheets API service using Google Identity Services (GIS)
// Updated for new Google Identity Services to replace deprecated GAPI Auth2

declare global {
  interface Window {
    google: any;
    gapi: any;
    __APP_CONFIG__: any;
  }
}

interface SheetInfo {
  id: number;
  title: string;
  index: number;
}

interface SpreadsheetInfo {
  title: string;
  sheets: SheetInfo[];
}

export class ClientGoogleSheetsService {
  private isInitialized = false;
  private accessToken: string | null = null;
  private readonly TOKEN_KEY = 'google_sheets_access_token';
  private readonly TOKEN_EXPIRY_KEY = 'google_sheets_token_expiry';
  
  // Scopes needed for Sheets API
  private readonly SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
  
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('Initializing Google Sheets client with GIS...');
    
    // Check for stored token first
    this.loadStoredToken();
    
    // Load Google Identity Services and GAPI
    await Promise.all([
      this.loadGoogleIdentityServices(),
      this.loadGoogleAPI()
    ]);
    
    // Initialize GAPI client for Sheets API
    await new Promise<void>((resolve) => {
      window.gapi.load('client', resolve);
    });

    const config = window.__APP_CONFIG__;
    console.log('App config:', config);
    
    if (!config?.GOOGLE_CLIENT_ID) {
      throw new Error('Google Client ID not found in app config');
    }

    console.log('Initializing GAPI client with GIS approach');

    // Initialize the GAPI client for API calls
    await window.gapi.client.init({
      discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4']
    });
    
    // If we have a stored token, set it in GAPI
    if (this.accessToken) {
      window.gapi.client.setToken({
        access_token: this.accessToken
      });
      console.log('Restored authentication from stored token');
    }
    
    console.log('Google Sheets client initialized with GIS');
    this.isInitialized = true;
  }
  
  private loadStoredToken(): void {
    try {
      const storedToken = localStorage.getItem(this.TOKEN_KEY);
      const storedExpiry = localStorage.getItem(this.TOKEN_EXPIRY_KEY);
      
      if (storedToken && storedExpiry) {
        const expiryTime = parseInt(storedExpiry);
        const now = Date.now();
        
        // Check if token is still valid (with 5 minute buffer)
        if (now < expiryTime - (5 * 60 * 1000)) {
          this.accessToken = storedToken;
          console.log('Loaded stored access token');
        } else {
          console.log('Stored token expired, clearing...');
          this.clearStoredToken();
        }
      }
    } catch (error) {
      console.warn('Error loading stored token:', error);
      this.clearStoredToken();
    }
  }
  
  private saveToken(token: string, expiresIn: number = 3600): void {
    try {
      const expiryTime = Date.now() + (expiresIn * 1000);
      localStorage.setItem(this.TOKEN_KEY, token);
      localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiryTime.toString());
      console.log('Access token saved to localStorage');
    } catch (error) {
      console.warn('Error saving token:', error);
    }
  }
  
  private clearStoredToken(): void {
    try {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.TOKEN_EXPIRY_KEY);
    } catch (error) {
      console.warn('Error clearing stored token:', error);
    }
  }
  
  private async loadGoogleIdentityServices(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.google?.accounts) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
      document.head.appendChild(script);
    });
  }
  
  private async loadGoogleAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.gapi) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google API'));
      document.head.appendChild(script);
    });
  }
  
  async signIn(): Promise<boolean> {
    console.log('Attempting Google Sheets sign-in with GIS...');
    await this.initialize();
    
    const config = window.__APP_CONFIG__;
    console.log('Using client ID:', config?.GOOGLE_CLIENT_ID);
    
    if (!config?.GOOGLE_CLIENT_ID) {
      console.error('GOOGLE_CLIENT_ID is missing in app config!');
      throw new Error('Google Client ID yapılandırması eksik.');
    }
    
    if (!window.google?.accounts?.oauth2) {
      console.error('Google Identity Services is not initialized properly!');
      throw new Error('Google Identity Services başlatılamadı. Tarayıcıyı yenileyin veya farklı bir tarayıcı deneyin.');
    }
    
    return new Promise((resolve, reject) => {
      try {
        // Get current URL for redirect
        const currentOrigin = window.location.origin;
        console.log('Current origin for redirect:', currentOrigin);
        
        // Use Google Identity Services for OAuth2
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: config.GOOGLE_CLIENT_ID,
          scope: this.SCOPES,
          redirect_uri: currentOrigin, // Explicitly set redirect URI
          prompt: 'consent',
          callback: (tokenResponse: any) => {
            console.log('GIS token response received');
            if (tokenResponse.error) {
              console.error('GIS authentication error:', tokenResponse.error);
              reject(new Error('Google kimlik doğrulama hatası: ' + tokenResponse.error));
              return;
            }
            
            this.accessToken = tokenResponse.access_token;

            // Save token to localStorage with expiry (only if we have a token)
            const expiresIn = tokenResponse.expires_in || 3600;
            if (this.accessToken) {
              this.saveToken(this.accessToken, expiresIn);
            }
            
            console.log('Successfully authenticated with GIS');
            
            // Set the access token for GAPI
            window.gapi.client.setToken({
              access_token: this.accessToken
            });
            
            resolve(true);
          },
        });
        
        console.log('Starting GIS OAuth flow...');
        client.requestAccessToken();
        
      } catch (error) {
        console.error('GIS sign-in setup failed:', error);
        reject(error);
      }
    });
  }
  
  async signOut(): Promise<void> {
    if (this.accessToken) {
      // Revoke the token
      window.google.accounts.oauth2.revoke(this.accessToken);
      this.accessToken = null;
      window.gapi.client.setToken(null);
      
      // Clear stored token
      this.clearStoredToken();
      console.log('Signed out and cleared stored token');
    }
  }
  
  isAuthenticated(): boolean {
    // If we don't have a token in memory, try to load from storage
    if (!this.accessToken) {
      this.loadStoredToken();
    }
    return !!this.accessToken;
  }
  
  async getSpreadsheetInfo(spreadsheetId: string): Promise<SpreadsheetInfo> {
    console.log('Getting spreadsheet info for:', spreadsheetId);
    await this.ensureAuthenticated();
    
    try {
      console.log('Making API call to get spreadsheet...');
      const response = await window.gapi.client.sheets.spreadsheets.get({
        spreadsheetId,
        includeGridData: false
      });
      
      console.log('Spreadsheet API response:', response);
      const data = response.result;
      
      const result = {
        title: data.properties?.title || 'Untitled',
        sheets: data.sheets?.map((sheet: any) => ({
          id: sheet.properties?.sheetId || 0,
          title: sheet.properties?.title || 'Untitled Sheet',
          index: sheet.properties?.index || 0
        })) || []
      };
      
      console.log('Processed spreadsheet info:', result);
      return result;
    } catch (error: any) {
      console.error('Error getting spreadsheet info:', error);
      throw new Error('Spreadsheet bilgileri alınamadı: ' + (error?.message || 'Bilinmeyen hata'));
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    console.log('Ensuring authentication...');
    await this.initialize();
    
    if (!this.isAuthenticated()) {
      console.log('Not authenticated, attempting sign-in...');
      try {
        await this.signIn();
        console.log('Sign-in successful');
      } catch (error: any) {
        console.error('Sign-in failed:', error);
        throw new Error('Google Sheets erişimi için giriş yapılamadı: ' + (error?.message || 'Bilinmeyen hata'));
      }
    }
    
    console.log('Authentication verified');
  }

  async getSheetData(spreadsheetId: string, sheetName: string): Promise<any[][]> {
    await this.ensureAuthenticated();
    
    try {
      const response = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: sheetName,
      });
      
      return response.result.values || [];
    } catch (error) {
      console.error('Error getting sheet data:', error);
      throw new Error('Sheet verileri alınamadı');
    }
  }

  async appendSheetData(spreadsheetId: string, sheetName: string, data: any[][]): Promise<void> {
    await this.ensureAuthenticated();
    
    try {
      await window.gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: sheetName,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: data
        }
      });
    } catch (error) {
      console.error('Error appending sheet data:', error);
      throw new Error('Veri eklenemedi');
    }
  }

  async updateSheetData(spreadsheetId: string, range: string, data: any[][]): Promise<void> {
    await this.ensureAuthenticated();
    
    try {
      console.log('Updating sheet data:', { spreadsheetId, range, dataPreview: data.slice(0, 3) });
      
      // Ensure data is properly formatted as string arrays
      const values = data.map(row => 
        row.map(cell => cell !== null && cell !== undefined ? String(cell) : '')
      );
      
      console.log('Formatted values preview:', values.slice(0, 3));
      
      const response = await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: values
        }
      });
      
      console.log('Update response:', response);
      
    } catch (error: any) {
      console.error('Error updating sheet data:', error);
      console.error('Error details:', error?.result?.error || error);
      throw new Error('Veri güncellenemedi: ' + (error?.result?.error?.message || error?.message || 'Bilinmeyen hata'));
    }
  }

  async createSheet(spreadsheetId: string, sheetName: string, headers: string[]): Promise<void> {
    await this.ensureAuthenticated();
    
    try {
      // First create the sheet
      await window.gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: sheetName
              }
            }
          }]
        }
      });

      // Then add headers if provided
      if (headers.length > 0) {
        await this.appendSheetData(spreadsheetId, sheetName, [headers]);
      }
    } catch (error) {
      console.error('Error creating sheet:', error);
      throw new Error('Sheet oluşturulamadı');
    }
  }

  async deleteSheet(spreadsheetId: string, sheetId: number): Promise<void> {
    await this.ensureAuthenticated();
    
    try {
      await window.gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [{
            deleteSheet: {
              sheetId: sheetId
            }
          }]
        }
      });
    } catch (error) {
      console.error('Error deleting sheet:', error);
      throw new Error('Sheet silinemedi');
    }
  }

  async renameSheet(spreadsheetId: string, sheetId: number, newName: string): Promise<void> {
    await this.ensureAuthenticated();
    
    try {
      await window.gapi.client.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [{
            updateSheetProperties: {
              properties: {
                sheetId: sheetId,
                title: newName
              },
              fields: 'title'
            }
          }]
        }
      });
    } catch (error) {
      console.error('Error renaming sheet:', error);
      throw new Error('Sheet adı değiştirilemedi');
    }
  }

  getTemplateHeaders(template: string): string[] {
    switch (template) {
      case 'income-tracking':
        return ['Date', 'Proje ID', 'Gelir Türü', 'Açıklama', 'Tutar', 'Para Birimi', 'Ödeme Durumu', 'Fatura No', 'Müşteri', 'Kategori'];
      case 'expense-tracking':
        return ['Date', 'Proje ID', 'Kategori', 'Alt Kategori', 'Açıklama', 'Tutar', 'Para Birimi', 'Ödeme Durumu', 'Tedarikçi', 'Fatura No'];
      case 'project-tracking':
        return ['Proje ID', 'Proje Adı', 'Toplam Bütçe', 'Başlangıç Datei', 'Bitiş Datei', 'Durum', 'Sorumlu Kişi', 'Lokasyon', 'Proje Tipi'];
      case 'bank-accounts':
        return ['Hesap Adı', 'Banka', 'Hesap No', 'Bakiye', 'Para Birimi', 'Date', 'Hesap Türü', 'Durum'];
      case 'upcoming-payments':
        return ['Vade Datei', 'Açıklama', 'Tutar', 'Kategori', 'Öncelik', 'Durum', 'Sorumlu', 'Notlar'];
      case 'subsidiaries':
        return ['İştirak Adı', 'Sektör', 'Aylık Gelir', 'Aylık Gider', 'Net Kar', 'Date', 'Aktif Projeler', 'Durum'];
      case 'income-expense':
        return ['Date', 'Açıklama', 'Tutar', 'Tür', 'Kategori'];
      default:
        return ['Kolon 1', 'Kolon 2', 'Kolon 3'];
    }
  }

  // Finansal sheet oluşturma helper'ı
  async createFinancialSheet(sheetName: string, template: string): Promise<void> {
    const spreadsheetId = window.__APP_CONFIG__.GOOGLE_SPREADSHEET_ID;
    const headers = this.getTemplateHeaders(template);
    
    try {
      await this.createSheet(spreadsheetId, sheetName, headers);
      console.log(`Financial sheet created: ${sheetName} with template: ${template}`);
    } catch (error) {
      console.error(`Failed to create financial sheet: ${sheetName}`, error);
      throw error;
    }
  }
}

// The client-side Google Sheets implementation is intentionally not exported
// alongside the stub to avoid duplicate symbol declarations. The stub above
// (`googleSheetsClient`) should be used by client code. If server-side or
// full GIS-based client is required, import the implementation from the
// legacy files explicitly (not exported here to keep types clean).

// NOTE: Do NOT export a second `googleSheetsClient` here. The stub at the top
// of this file provides the single exported symbol for client usage.
