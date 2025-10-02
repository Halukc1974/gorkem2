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
  
  // Scopes needed for Sheets API
  private readonly SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
  
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('Initializing Google Sheets client with GIS...');
    
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
    
    console.log('Google Sheets client initialized with GIS');
    this.isInitialized = true;
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
    
    return new Promise((resolve, reject) => {
      try {
        // Use Google Identity Services for OAuth2
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: config.GOOGLE_CLIENT_ID,
          scope: this.SCOPES,
          callback: (tokenResponse: any) => {
            console.log('GIS token response:', tokenResponse);
            if (tokenResponse.error) {
              console.error('GIS authentication error:', tokenResponse.error);
              reject(new Error('Google authentication failed: ' + tokenResponse.error));
              return;
            }
            
            this.accessToken = tokenResponse.access_token;
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
    }
  }
  
  isAuthenticated(): boolean {
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

  getTemplateHeaders(template: string): string[] {
    switch (template) {
      case 'income-expense':
        return ['Date', 'Açıklama', 'Tutar', 'Tür', 'Kategori'];
      case 'project-tracking':
        return ['Proje Adı', 'Başlangıç', 'Bitiş', 'Durum', 'Sorumlu', 'Bütçe'];
      case 'inventory':
        return ['Ürün Adı', 'Miktar', 'Birim', 'Fiyat', 'Toplam', 'Date'];
      case 'client-management':
        return ['Müşteri Adı', 'Email', 'Telefon', 'Şirket', 'Adres', 'Notlar'];
      case 'employee-records':
        return ['Ad Soyad', 'Pozisyon', 'Maaş', 'İşe Başlama', 'Telefon', 'Email'];
      default:
        return ['Kolon 1', 'Kolon 2', 'Kolon 3'];
    }
  }
}

export const googleSheetsClient = new ClientGoogleSheetsService();
