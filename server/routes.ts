import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { googleSheetsService } from "./services/googleSheets";
import { setupAuth, requireAuth, requireAdmin } from "./auth";
import { 
  insertSheetSchema, 
  addRecordFormSchema, 
  createSheetFormSchema,
  insertTransactionSchema,
  type SheetData,
  type User 
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || process.env.SPREADSHEET_ID;

  if (!SPREADSHEET_ID) {
    console.warn('Warning: GOOGLE_SPREADSHEET_ID not found in environment variables');
  }

  // General request logging for debugging
  app.use('/api/admin/permissions-doc', (req, res, next) => {
    console.log('🌐 [DEBUG] Request to permissions-doc:', req.method, req.url);
    console.log('🌐 [DEBUG] Request headers (auth):', {
      authorization: req.headers.authorization,
      cookie: req.headers.cookie?.substring(0, 100) + '...',
      'content-type': req.headers['content-type']
    });
    next();
  });

  // Setup authentication
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });

  // Get all sheets
  app.get("/api/sheets", requireAuth, async (req, res) => {
    try {
      const sheets = await storage.getSheets();
      
      // If no sheets in storage, try to sync from Google Sheets
      if (sheets.length === 0 && SPREADSHEET_ID) {
        try {
          const spreadsheetInfo = await googleSheetsService.getSpreadsheetInfo(SPREADSHEET_ID);
          
          // Create sheet records for each Google Sheet tab
          for (const sheetInfo of spreadsheetInfo.sheets) {
            await storage.createSheet({
              name: sheetInfo.title,
              googleSheetId: SPREADSHEET_ID,
              sheetTabId: sheetInfo.id,
              headers: []
            });
          }
          
          const updatedSheets = await storage.getSheets();
          res.json(updatedSheets);
        } catch (error) {
          console.error('Error syncing sheets from Google:', error);
          res.json(sheets); // Return empty array if sync fails
        }
      } else {
        res.json(sheets);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to get sheets" });
    }
  });

    // Admin-only endpoints: list auth users and read/update userConfigs via Firebase Admin
    app.get('/api/admin/list-users', requireAdmin, async (req, res) => {
      try {
        const { getFirebaseAdmin } = await import('./firebaseAdmin');
        const admin = getFirebaseAdmin();
        const users: Array<{ uid: string; email?: string; name?: string }> = [];
        // paginate through users
        let nextPageToken: string | undefined = undefined;
        do {
          const listResult = await admin.auth().listUsers(1000, nextPageToken);
          listResult.users.forEach(u => users.push({ uid: u.uid, email: u.email, name: u.displayName }));
          nextPageToken = listResult.pageToken;
        } while (nextPageToken);
        res.json(users);
      } catch (err) {
        console.error('Admin list-users error:', err);
        res.status(500).json({ message: 'Failed to list users' });
      }
    });

    // DEV-only debug route: list users using Firebase Admin without requiring app admin session.
    // Enabled only when DEBUG_ADMIN === 'true' and not in production. Useful for debugging credentials.
    if (process.env.DEBUG_ADMIN === 'true' && app.get('env') !== 'production') {
      app.get('/api/debug/admin/list-users', async (req, res) => {
        try {
          const { getFirebaseAdmin } = await import('./firebaseAdmin');
          const admin = getFirebaseAdmin();
          const users: Array<{ uid: string; email?: string; name?: string }> = [];
          let nextPageToken: string | undefined = undefined;
          do {
            const listResult = await admin.auth().listUsers(1000, nextPageToken);
            listResult.users.forEach(u => users.push({ uid: u.uid, email: u.email, name: u.displayName }));
            nextPageToken = listResult.pageToken;
          } while (nextPageToken);
          res.json({ debug: true, users });
        } catch (err) {
          console.error('Debug admin list-users error:', err);
          res.status(500).json({ message: 'Failed to list users (debug)' });
        }
      });

      // Dev-only: promote a user in storage to admin role (no Firebase/Admin checks)
      app.post('/api/debug/admin/promote/:uid', async (req, res) => {
        try {
          const { uid } = req.params;
          // Try to find by googleId (Firebase UID) first
          let existing = await storage.getUserByGoogleId(uid as string);
          if (existing) {
            const updated = await storage.updateUser(existing.id, { role: 'admin' } as any);
            if (!updated) return res.status(500).json({ message: 'Failed to promote user' });
            return res.json({ success: true, updated });
          }

          // If not exists, upsert using googleId so it's linked to the Firebase UID
          const upserted = await storage.upsertUser({ googleId: uid as string, email: '', name: '', picture: null, role: 'admin' });
          return res.json({ success: true, upserted });
        } catch (err) {
          console.error('Debug promote error:', err);
          res.status(500).json({ message: 'Failed to promote user' });
        }
      });
    }

    app.get('/api/admin/user-config/:uid', requireAdmin, async (req, res) => {
      try {
        const { uid } = req.params;
        const { getFirebaseAdmin } = await import('./firebaseAdmin');
        const admin = getFirebaseAdmin();
        const docRef = admin.firestore().doc(`userConfigs/${uid}`);
        const snap = await docRef.get();
        if (!snap.exists) return res.json(null);
        res.json(snap.data());
      } catch (err) {
        console.error('Admin get user-config error:', err);
        res.status(500).json({ message: 'Failed to get user config' });
      }
    });

    app.put('/api/admin/user-config/:uid', requireAdmin, async (req, res) => {
      try {
        const { uid } = req.params;
        const payload = req.body || {};
        const { getFirebaseAdmin } = await import('./firebaseAdmin');
        const admin = getFirebaseAdmin();
        const docRef = admin.firestore().doc(`userConfigs/${uid}`);
        // merge update
        await docRef.set(payload, { merge: true });
        res.json({ success: true });
      } catch (err) {
        console.error('Admin update user-config error:', err);
        res.status(500).json({ message: 'Failed to update user config' });
      }
    });

    // Admin endpoints for userPermissions (boolean map for sidebar visibility)
    app.get('/api/admin/permissions/:uid', requireAdmin, async (req, res) => {
      try {
        const { uid } = req.params;
        const { getFirebaseAdmin } = await import('./firebaseAdmin');
        const admin = getFirebaseAdmin();
        const docRef = admin.firestore().doc(`userPermissions/${uid}`);
        const snap = await docRef.get();
        if (!snap.exists) return res.json(null);
        res.json(snap.data());
      } catch (err) {
        console.error('Admin get permissions error:', err);
        res.status(500).json({ message: 'Failed to get permissions' });
      }
    });

    app.put('/api/admin/permissions/:uid', requireAdmin, async (req, res) => {
      try {
        const { uid } = req.params;
        const payload = req.body || {};
        const { getFirebaseAdmin } = await import('./firebaseAdmin');
        const admin = getFirebaseAdmin();
        // If a centralized permissions document is configured, write into its `users` map
        const PERMISSIONS_DOC_ID = process.env.PERMISSIONS_DOC_ID || null;
        if (PERMISSIONS_DOC_ID) {
          const docRef = admin.firestore().doc(`userConfigs/${PERMISSIONS_DOC_ID}`);
          const snap = await docRef.get();
          const existing = snap.exists ? (snap.data() || {}) : {};
          const usersMap = existing.users && typeof existing.users === 'object' ? existing.users : {};

          // write the user's sidebar map into usersMap[uid]
          usersMap[uid] = payload.sidebar || payload;

          await docRef.set({ users: usersMap }, { merge: true });
          return res.json({ success: true, wroteTo: `userConfigs/${PERMISSIONS_DOC_ID}.users.${uid}` });
        }

        // Default behavior: per-user document under userPermissions
        const docRef = admin.firestore().doc(`userPermissions/${uid}`);
        await docRef.set(payload, { merge: true });
        res.json({ success: true });
      } catch (err) {
        console.error('Admin update permissions error:', err);
        res.status(500).json({ message: 'Failed to update permissions' });
      }
    });

    // Admin endpoint to write into a single permissions document's users map
    // PUT /api/admin/permissions-doc/:docId/user/:email
    app.put('/api/admin/permissions-doc/:docId/user/:email', requireAuth, async (req, res) => {
      try {
        const { docId, email } = req.params;
        const payload = req.body || {};
        const { getFirebaseAdmin } = await import('./firebaseAdmin');
        const admin = getFirebaseAdmin();
        // Allow if session user is admin, is gorkeminsaat1@gmail.com, or if session user's email matches target email
        const sessionUser: any = (req as any).user;
        // check env driven ADMIN_EMAILS (case-insensitive); fall back to exact match if env not set
        const adminEmailsEnv = (process.env.ADMIN_EMAILS || '');
        const adminEmails = adminEmailsEnv.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        const isSuperAdmin = sessionUser && sessionUser.email && adminEmails.includes((sessionUser.email || '').toLowerCase());
        if (!(sessionUser && (sessionUser.role === 'admin' || isSuperAdmin || sessionUser.email === email))) {
          return res.status(403).json({ message: 'Admin access required or can only modify your own settings' });
        }
        const docRef = admin.firestore().doc(`userConfigs/${docId}`);

        // Read existing doc, safely update users map to avoid field-path issues with emails
        const snap = await docRef.get();
        const existing = snap.exists ? (snap.data() || {}) : {};
        const usersMap = existing.users && typeof existing.users === 'object' ? existing.users : {};

        // Set the user's sidebar map (payload.sidebar expected)
        usersMap[email] = payload.sidebar || payload;

        // persist and log
        await docRef.set({ users: usersMap }, { merge: true });
        console.log('Permissions doc updated by', sessionUser?.email || 'unknown', { docId, email });
        return res.json({ success: true, users: usersMap });
      } catch (err) {
        console.error('Admin update permissions-doc error:', err);
        res.status(500).json({ message: 'Failed to update permissions doc' });
      }
    });
    // POST alias for environments that block PUT
    app.post('/api/admin/permissions-doc/:docId/user/:email', requireAuth, async (req, res) => {
      console.log('🔍 [DEBUG] POST /api/admin/permissions-doc/:docId/user/:email - START');
      console.log('🔍 [DEBUG] Request params:', { docId: req.params.docId, email: req.params.email });
      console.log('🔍 [DEBUG] Request body:', JSON.stringify(req.body, null, 2));
      
      try {
        const { docId, email } = req.params;
        const payload = req.body || {};
        
        console.log('🔍 [DEBUG] Processing payload:', JSON.stringify(payload, null, 2));
        
        // Check session user first
        const sessionUser2: any = (req as any).user;
        console.log('🔍 [DEBUG] Session user:', {
          exists: !!sessionUser2,
          email: sessionUser2?.email,
          role: sessionUser2?.role,
          id: sessionUser2?.id
        });

        const adminEmailsEnv2 = (process.env.ADMIN_EMAILS || '');
        const adminEmails2 = adminEmailsEnv2.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        const isSuperAdmin2 = sessionUser2 && sessionUser2.email && adminEmails2.includes((sessionUser2.email || '').toLowerCase());
        const hasPermission = sessionUser2 && (sessionUser2.role === 'admin' || isSuperAdmin2 || sessionUser2.email === email);
        
        console.log('🔍 [DEBUG] Permission check:', {
          isSuperAdmin: isSuperAdmin2,
          hasPermission,
          reason: !hasPermission ? 'No admin role, not super admin, and email mismatch' : 'Permission granted'
        });
        
        if (!hasPermission) {
          console.log('❌ [DEBUG] Permission denied - returning 403');
          return res.status(403).json({ message: 'Admin access required or can only modify your own settings' });
        }
        
        // Try to initialize Firebase Admin
        console.log('🔍 [DEBUG] Initializing Firebase Admin...');
        const { getFirebaseAdmin } = await import('./firebaseAdmin');
        const admin = getFirebaseAdmin();
        console.log('🔍 [DEBUG] Firebase Admin initialized successfully');
        
        const docRef = admin.firestore().doc(`userConfigs/${docId}`);
        console.log('🔍 [DEBUG] Document reference created:', `userConfigs/${docId}`);

        // Read existing doc, safely update users map to avoid field-path issues with emails
        console.log('🔍 [DEBUG] Reading existing document...');
        const snap = await docRef.get();
        console.log('🔍 [DEBUG] Document exists:', snap.exists);
        
        const existing = snap.exists ? (snap.data() || {}) : {};
        console.log('🔍 [DEBUG] Existing document keys:', Object.keys(existing));
        
        const usersMap = existing.users && typeof existing.users === 'object' ? existing.users : {};
        console.log('🔍 [DEBUG] Current users map keys:', Object.keys(usersMap));
        console.log('🔍 [DEBUG] Current user data for', email, ':', JSON.stringify(usersMap[email], null, 2));

        // Set the user's sidebar map (payload.sidebar expected)
        const newUserData = payload.sidebar || payload;
        usersMap[email] = newUserData;
        
        console.log('🔍 [DEBUG] Updated users map keys:', Object.keys(usersMap));
        console.log('🔍 [DEBUG] New user data for', email, ':', JSON.stringify(newUserData, null, 2));
        
        console.log('🔍 [DEBUG] Writing to Firestore...');
        await docRef.set({ users: usersMap }, { merge: true });
        console.log('✅ [DEBUG] Firestore write successful');
        
        console.log('🔍 [DEBUG] Permissions doc POST updated by', sessionUser2?.email || 'unknown', { docId, email });
        
        const response = { success: true, users: usersMap };
        console.log('🔍 [DEBUG] Sending response:', JSON.stringify(response, null, 2));
        
        return res.json(response);
      } catch (err: any) {
        console.error('❌ [DEBUG] Admin update permissions-doc (POST) error:', err);
        console.error('❌ [DEBUG] Error stack:', err.stack);
        console.error('❌ [DEBUG] Error message:', err.message);
        console.error('❌ [DEBUG] Error code:', err.code);
        
        res.status(500).json({ message: 'Failed to update permissions doc', error: err.message });
      } finally {
        console.log('🔍 [DEBUG] POST /api/admin/permissions-doc/:docId/user/:email - END');
      }
    });
    // Admin: get the full permissions doc (useful for admin UI to list users)
    app.get('/api/admin/permissions-doc/:docId', requireAdmin, async (req, res) => {
      try {
        const { docId } = req.params;
        const { getFirebaseAdmin } = await import('./firebaseAdmin');
        const admin = getFirebaseAdmin();
        const docRef = admin.firestore().doc(`userConfigs/${docId}`);
        const snap = await docRef.get();
        if (!snap.exists) return res.json(null);
        // Return the full document data (including users map)
        return res.json(snap.data());
      } catch (err) {
        console.error('Admin get permissions-doc error:', err);
        res.status(500).json({ message: 'Failed to read permissions doc' });
      }
    });

    // Note: POST handler for permissions-doc is defined above with requireAuth and returns updated users map.
  
  // Update sheet metadata (rename, headers update)
  app.put("/api/sheets/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, headers } = req.body;
      const sheet = await storage.getSheet(id);
      if (!sheet) {
        return res.status(404).json({ message: "Sheet not found" });
      }

      const updateData: any = {};
      if (typeof name === 'string' && name.trim().length > 0) updateData.name = name.trim();
      if (Array.isArray(headers)) updateData.headers = headers;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      await storage.updateSheet(id, updateData);
      const updated = await storage.getSheet(id);
      res.json(updated);
    } catch (error) {
      console.error('Failed to update sheet:', error);
      res.status(500).json({ message: "Failed to update sheet" });
    }
  });

  // Authenticated user: get your own permissions/config
  app.get('/api/permissions/me', requireAuth, async (req, res) => {
    try {
      const user: any = (req as any).user;
      const email: string | undefined = user?.email;
      const uid: string | undefined = user?.id || user?.uid;

      const { getFirebaseAdmin } = await import('./firebaseAdmin');
      const admin = getFirebaseAdmin();

      // If a single permissions doc is configured, try to read user's map from it first
      try {
        const docId = process.env.PERMISSIONS_DOC_ID || (global as any).__PERMISSIONS_DOC_ID || 'BCAwiuzRcwOMYrwS6hQiCNnFMN33';
        if (docId && email) {
          try {
            const docRef = admin.firestore().doc(`userConfigs/${docId}`);
            const snap = await docRef.get();
            if (snap.exists) {
              const data = snap.data() || {};
              const usersMap = data.users && typeof data.users === 'object' ? data.users : null;
              if (email && usersMap && Object.prototype.hasOwnProperty.call(usersMap, email)) {
                return res.json(usersMap[email]);
              }
            }
          } catch (e) {
            console.warn('Failed to read permissions doc for /api/permissions/me', e);
          }
        }
      } catch (e) {
        // ignore and continue with existing logic
      }

      // Try by UID document first (preferred if docs keyed by UID)
      if (uid) {
        try {
          const docRef = admin.firestore().doc(`userPermissions/${uid}`);
          const snap = await docRef.get();
          if (snap.exists) return res.json(snap.data());
        } catch (e) {
          // continue to email-based lookup
          console.error('permissions by uid lookup failed', e);
        }
      }

      // Fallback: query by email field in userPermissions collection
      if (email) {
        try {
          const col = admin.firestore().collection('userPermissions');
          const q = await col.where('email', '==', email).limit(1).get();
          if (!q.empty) {
            return res.json(q.docs[0].data());
          }
        } catch (e) {
          console.error('permissions by email lookup failed', e);
        }
      }

      // Additional fallback: check a single permissions document that contains a users map
      // Useful when permissions are stored under userConfigs/{PERMISSIONS_DOC_ID}.users[email]
      try {
        const PERM_DOC_ID = process.env.PERMISSIONS_DOC_ID || 'BCAwiuzRcwOMYrwS6hQiCNnFMN33';
        const permRef = admin.firestore().doc(`userConfigs/${PERM_DOC_ID}`);
        const permSnap = await permRef.get();
        if (permSnap.exists) {
          const permData = permSnap.data() || {};
          // First check users wrapper (guard email before indexing)
          if (email && permData.users && typeof permData.users === 'object' && Object.prototype.hasOwnProperty.call(permData.users, email)) {
            return res.json(permData.users[email]);
          }
          // Then check flat email keys at top-level (guard email)
          if (email && Object.prototype.hasOwnProperty.call(permData, email)) {
            return res.json(permData[email]);
          }
        }
      } catch (e) {
        console.error('permissions doc lookup failed', e);
      }

      // Final fallback: if existing userConfigs collection is used, try that
      if (uid) {
        try {
          const oldRef = admin.firestore().doc(`userConfigs/${uid}`);
          const oldSnap = await oldRef.get();
          if (oldSnap.exists) return res.json(oldSnap.data());
        } catch (e) {
          console.error('fallback userConfigs lookup failed', e);
        }
      }

      // Additional fallback: single permissions document that contains a users map
      try {
        const docId = process.env.PERMISSIONS_DOC_ID || 'BCAwiuzRcwOMYrwS6hQiCNnFMN33';
        const singleRef = admin.firestore().doc(`userConfigs/${docId}`);
        const singleSnap = await singleRef.get();
        if (singleSnap.exists) {
          const data = singleSnap.data() || {};
          const usersMap = data.users && typeof data.users === 'object' ? data.users : null;
          if (email && usersMap && Object.prototype.hasOwnProperty.call(usersMap, email)) {
            return res.json(usersMap[email]);
          }
        }
      } catch (e) {
        console.error('permissions single-doc lookup failed', e);
      }

      // Nothing found
      res.json(null);
    } catch (err) {
      console.error('GET /api/permissions/me error:', err);
      res.status(500).json({ message: 'Failed to get permissions' });
    }
  });

  // Get sheet data
  app.get("/api/sheets/:id/data", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const sheet = await storage.getSheet(id);
      
      if (!sheet) {
        return res.status(404).json({ message: "Sheet not found" });
      }

      let data: any[][] = [];
      let headers: string[] = sheet.headers;

      // Try to get data from Google Sheets
      if (SPREADSHEET_ID && sheet.name) {
        try {
          const sheetData = await googleSheetsService.getSheetData(SPREADSHEET_ID, sheet.name);
          
          if (sheetData.length > 0) {
            headers = sheetData[0]; // First row as headers
            data = sheetData.slice(1); // Rest as data
            
            // Update headers in storage
            await storage.updateSheet(id, { headers });
          }
        } catch (error) {
          console.error('Error getting data from Google Sheets:', error);
        }
      }

      const sheetData: SheetData = {
        sheet,
        records: data,
        headers
      };

      res.json(sheetData);
    } catch (error) {
      res.status(500).json({ message: "Failed to get sheet data" });
    }
  });

  // Add record to sheet
  app.post("/api/sheets/:id/records", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = addRecordFormSchema.parse(req.body);
      
      const sheet = await storage.getSheet(id);
      if (!sheet) {
        return res.status(404).json({ message: "Sheet not found" });
      }

      // Convert form data to row array
      const rowData = [
        validatedData.date,
        validatedData.description,
        validatedData.amount.toString(),
        validatedData.type,
        validatedData.category
      ];

      // Add to Google Sheets
      if (SPREADSHEET_ID && sheet.name) {
        try {
          await googleSheetsService.appendSheetData(SPREADSHEET_ID, sheet.name, [rowData]);
        } catch (error) {
          console.error('Error adding record to Google Sheets:', error);
          return res.status(500).json({ message: "Failed to add record to Google Sheets" });
        }
      }

      // Also create a transaction record if this is an accounting sheet
      if (sheet.name.toLowerCase().includes('muhasebe') || sheet.name.toLowerCase().includes('accounting')) {
        try {
          await storage.createTransaction({
            date: new Date(validatedData.date),
            description: validatedData.description,
            amount: validatedData.amount.toString(),
            type: validatedData.type === 'Gelir' ? 'income' : 'expense',
            category: validatedData.category
          });
        } catch (error) {
          console.error('Error creating transaction record:', error);
        }
      }

      res.json({ success: true, message: "Record added successfully" });
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  // Update sheet record
  app.put("/api/sheets/:id/records/:rowIndex", async (req, res) => {
    try {
      const { id, rowIndex } = req.params;
      const rowData = req.body.data;
      
      const sheet = await storage.getSheet(id);
      if (!sheet) {
        return res.status(404).json({ message: "Sheet not found" });
      }

      // Update in Google Sheets
      if (SPREADSHEET_ID && sheet.name) {
        try {
          const range = `${sheet.name}!A${parseInt(rowIndex) + 2}:${String.fromCharCode(65 + rowData.length - 1)}${parseInt(rowIndex) + 2}`;
          await googleSheetsService.updateSheetData(SPREADSHEET_ID, range, [rowData]);
        } catch (error) {
          console.error('Error updating record in Google Sheets:', error);
          return res.status(500).json({ message: "Failed to update record in Google Sheets" });
        }
      }

      res.json({ success: true, message: "Record updated successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update record" });
    }
  });

  // Create new sheet
  app.post("/api/sheets", requireAuth, async (req, res) => {
    try {
      const validatedData = createSheetFormSchema.parse(req.body);
      const headers = googleSheetsService.getTemplateHeaders(validatedData.template);

      let sheetTabId = 0;

      // Create in Google Sheets
      if (SPREADSHEET_ID) {
        try {
          const result = await googleSheetsService.createSheet(SPREADSHEET_ID, validatedData.name, headers);
          sheetTabId = result.replies?.[0]?.addSheet?.properties?.sheetId || 0;
        } catch (error) {
          console.error('Error creating sheet in Google Sheets:', error);
          return res.status(500).json({ message: "Failed to create sheet in Google Sheets" });
        }
      }

      // Create in storage
      const sheet = await storage.createSheet({
        name: validatedData.name,
        googleSheetId: SPREADSHEET_ID || '',
        sheetTabId,
        headers
      });

      res.json(sheet);
    } catch (error) {
      res.status(400).json({ message: "Invalid data" });
    }
  });

  // Delete sheet
  app.delete("/api/sheets/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const sheet = await storage.getSheet(id);
      
      if (!sheet) {
        return res.status(404).json({ message: "Sheet not found" });
      }

      // Delete from Google Sheets
      if (SPREADSHEET_ID && sheet.sheetTabId) {
        try {
          await googleSheetsService.deleteSheet(SPREADSHEET_ID, sheet.sheetTabId);
        } catch (error) {
          console.error('Error deleting sheet from Google Sheets:', error);
          return res.status(500).json({ message: "Failed to delete sheet from Google Sheets" });
        }
      }

      // Delete from storage
      await storage.deleteSheet(id);
      await storage.deleteSheetRecords(id);

      res.json({ success: true, message: "Sheet deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete sheet" });
    }
  });

  // Get dashboard data
  app.get("/api/dashboard", requireAuth, async (req, res) => {
    try {
      const dashboardData = await storage.getDashboardData();
      res.json(dashboardData);
    } catch (error) {
      res.status(500).json({ message: "Failed to get dashboard data" });
    }
  });

  // Sync data from Google Sheets
  app.post("/api/sync", requireAuth, async (req, res) => {
    try {
      if (!SPREADSHEET_ID) {
        return res.status(400).json({ message: "Google Spreadsheet ID not configured" });
      }

      const sheets = await storage.getSheets();
      let syncedCount = 0;

      for (const sheet of sheets) {
        try {
          const sheetData = await googleSheetsService.getSheetData(SPREADSHEET_ID, sheet.name);
          
          if (sheetData.length > 0) {
            const headers = sheetData[0];
            await storage.updateSheet(sheet.id, { headers });
            syncedCount++;
          }
        } catch (error) {
          console.error(`Error syncing sheet ${sheet.name}:`, error);
        }
      }

      res.json({ 
        success: true, 
        message: `Synced ${syncedCount} sheets successfully`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to sync data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
