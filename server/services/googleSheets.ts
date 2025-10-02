import { google } from 'googleapis';
import type { Sheet, SheetData } from '@shared/schema';

export class GoogleSheetsService {
  private sheets: any;
  private auth: any;

  constructor() {
    // Don't initialize auth in constructor to prevent startup failures
  }

  private async initializeAuth() {
    if (this.auth && this.sheets) {
      return; // Already initialized
    }

    try {
      // Get credentials from environment variables
      let creds: any = null;

      const credentialsEnv = process.env.GOOGLE_SHEETS_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

      if (credentialsEnv) {
        creds = JSON.parse(credentialsEnv);
      } else {
        // Fallback: read a JSON file from dist/credentials
        try {
          const fs = await import('fs');
          const path = await import('path');
          const fallbackDir = path.resolve(process.cwd(), 'dist', 'credentials');
          if (fs.existsSync(fallbackDir)) {
            const files = fs.readdirSync(fallbackDir).filter((f: string) => f.endsWith('.json'));
            if (files.length > 0) {
              const filePath = path.join(fallbackDir, files[0]);
              const raw = fs.readFileSync(filePath, 'utf8');
              creds = JSON.parse(raw);
            }
          }
        } catch (err) {
          console.warn('Google Sheets fallback credential read failed', err);
        }
      }

      if (!creds) {
        throw new Error('Google Sheets credentials not found in environment variables or dist/credentials');
      }
      
      this.auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      console.log('Google Sheets API initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Google Sheets authentication:', error);
      throw error;
    }
  }

  async getSpreadsheetInfo(spreadsheetId: string) {
    await this.initializeAuth();
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
        includeGridData: false
      });

      return {
        title: response.data.properties?.title,
        sheets: response.data.sheets?.map((sheet: any) => ({
          id: sheet.properties?.sheetId,
          title: sheet.properties?.title,
          index: sheet.properties?.index
        })) || []
      };
    } catch (error) {
      console.error('Error getting spreadsheet info:', error);
      throw new Error('Failed to get spreadsheet information');
    }
  }

  async getSheetData(spreadsheetId: string, sheetName: string): Promise<any[][]> {
    await this.initializeAuth();
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: sheetName,
      });

      return response.data.values || [];
    } catch (error) {
      console.error('Error getting sheet data:', error);
      throw new Error('Failed to get sheet data');
    }
  }

  async updateSheetData(spreadsheetId: string, sheetName: string, data: any[][]) {
    await this.initializeAuth();
    try {
      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: sheetName,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: data
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error updating sheet data:', error);
      throw new Error('Failed to update sheet data');
    }
  }

  async appendSheetData(spreadsheetId: string, sheetName: string, data: any[][]) {
    await this.initializeAuth();
    try {
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: sheetName,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: data
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error appending sheet data:', error);
      throw new Error('Failed to append sheet data');
    }
  }

  async createSheet(spreadsheetId: string, sheetName: string, headers: string[]) {
    await this.initializeAuth();
    try {
      // First create the sheet
      const addSheetResponse = await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
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

      return addSheetResponse.data;
    } catch (error) {
      console.error('Error creating sheet:', error);
      throw new Error('Failed to create sheet');
    }
  }

  async deleteSheet(spreadsheetId: string, sheetId: number) {
    await this.initializeAuth();
    try {
      const response = await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            deleteSheet: {
              sheetId
            }
          }]
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error deleting sheet:', error);
      throw new Error('Failed to delete sheet');
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

export const googleSheetsService = new GoogleSheetsService();
