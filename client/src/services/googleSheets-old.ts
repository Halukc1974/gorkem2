// Client-side Google Sheets API service using OAuth2
// This replaces server-side service account authentication for cPanel static hosting

declare global {
  interface Window {
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
  private isSignedIn = false;
  
  // Scopes needed for Sheets API
  private readonly SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
  
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('Initializing Google Sheets client...');
    
    // Load Google API
    await this.loadGoogleAPI();
    
    // Initialize gapi
    await new Promise<void>((resolve) => {
      window.gapi.load('client:auth2', resolve);
    });

    const config = window.__APP_CONFIG__;
    console.log('App config:', config);
    
    if (!config?.GOOGLE_CLIENT_ID) {
      throw new Error('Google Client ID not found in app config');
    }

    console.log('Initializing GAPI client with:', {
      clientId: config.GOOGLE_CLIENT_ID,
      scopes: this.SCOPES
    });

    // Initialize the client
    await window.gapi.client.init({
      apiKey: '', // Not needed for OAuth2 flow
      clientId: config.GOOGLE_CLIENT_ID,
      discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
      scope: this.SCOPES
    });
    
    const authInstance = window.gapi.auth2.getAuthInstance();
    this.isSignedIn = authInstance.isSignedIn.get();
    
    console.log('Google Sheets client initialized. Signed in:', this.isSignedIn);
    this.isInitialized = true;
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
    console.log('Attempting Google Sheets sign-in...');
    await this.initialize();
    
    const authInstance = window.gapi.auth2.getAuthInstance();
    console.log('Auth instance:', authInstance);
    console.log('Currently signed in:', authInstance.isSignedIn.get());
    
    if (!authInstance.isSignedIn.get()) {
      try {
        console.log('Starting sign-in flow...');
        const result = await authInstance.signIn();
        console.log('Sign-in result:', result);
        this.isSignedIn = true;
        console.log('Successfully signed in to Google Sheets');
      } catch (error) {
        console.error('Google sign-in failed:', error);
        throw new Error('Google hesabı ile giriş başarısız');
      }
    } else {
      console.log('Already signed in to Google');
      this.isSignedIn = true;
    }
    
    return this.isSignedIn;
  }
  
  async signOut(): Promise<void> {
    if (this.isInitialized) {
      const authInstance = window.gapi.auth2.getAuthInstance();
      await authInstance.signOut();
      this.isSignedIn = false;
    }
  }
  
  isAuthenticated(): boolean {
    return this.isSignedIn;
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
    } catch (error) {
      console.error('Error getting spreadsheet info:', error);
  throw new Error('Spreadsheet bilgileri alınamadı: ' + ((error as any)?.message || 'Bilinmeyen hata'));
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    console.log('Ensuring authentication...');
    await this.initialize();
    
    if (!this.isAuthenticated()) {
      console.log('Not authenticated, need to sign in...');
      throw new Error('Google Sheets erişimi için önce giriş yapmanız gerekiyor');
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
      await window.gapi.client.sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: data
        }
      });
    } catch (error) {
      console.error('Error updating sheet data:', error);
      throw new Error('Veri güncellenemedi');
    }
  }
  
  async createSheet(spreadsheetId: string, sheetName: string, headers: string[]): Promise<number> {
    await this.ensureAuthenticated();
    
    try {
      // Create the sheet
      const response = await window.gapi.client.sheets.spreadsheets.batchUpdate({
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
      
      const sheetId = response.result.replies?.[0]?.addSheet?.properties?.sheetId || 0;
      
      // Add headers if provided
      if (headers.length > 0) {
        await this.appendSheetData(spreadsheetId, sheetName, [headers]);
      }
      
      return sheetId;
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
              sheetId
            }
          }]
        }
      });
    } catch (error) {
      console.error('Error deleting sheet:', error);
      throw new Error('Sheet silinemedi');
    }
  }
  
  getTemplateHeaders(template: string): string[] {
    switch (template) {
      case 'accounting':
        return ['Date', 'Açıklama', 'Tutar', 'Tür', 'Kategori'];
      case 'project':
        return ['Proje Adı', 'Başlangıç', 'Bitiş', 'Durum', 'Harcama', 'Tamamlanma (%)'];
      case 'personnel':
        return ['Ad Soyad', 'Pozisyon', 'Maaş', 'İşe Başlama', 'Telefon', 'Email'];
      default:
        return ['Kolon 1', 'Kolon 2', 'Kolon 3'];
    }
  }
}

export const googleSheetsClient = new ClientGoogleSheetsService();
