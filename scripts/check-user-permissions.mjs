#!/usr/bin/env node
// Check Firestore user permission docs under a collection (default: userPermissions)
// Usage: node scripts/check-user-permissions.mjs [collectionName]
// Or: COLLECTION=yourCollection node scripts/check-user-permissions.mjs

import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

async function main() {
  try {
    const collectionArg = process.argv[2];
    const docArg = process.argv[3];
    const collectionName = process.env.COLLECTION || collectionArg || 'userPermissions';
    const docId = process.env.DOC_ID || docArg || null;

    // locate server/firebaseAdmin.* similarly to other helper scripts
    const candidates = [
      path.resolve(process.cwd(), 'server', 'firebaseAdmin.ts'),
      path.resolve(process.cwd(), 'server', 'firebaseAdmin.js'),
      path.resolve(process.cwd(), 'dist', 'server', 'firebaseAdmin.js'),
      path.resolve(process.cwd(), 'dist', 'index.js')
    ];
    let target = null;
    for (const c of candidates) {
      if (fs.existsSync(c)) { target = c; break; }
    }
    if (!target) {
      console.error('Could not find server/firebaseAdmin.(ts|js) or dist build. Build the project or run with tsx.');
      process.exit(2);
    }

    const mod = await import(pathToFileURL(target).href);
    const getFirebaseAdmin = mod.getFirebaseAdmin || (mod.default && mod.default.getFirebaseAdmin);
    if (!getFirebaseAdmin) {
      console.error('getFirebaseAdmin not found in', target);
      process.exit(2);
    }

    const admin = getFirebaseAdmin();
    const db = admin.firestore();

    if (docId) {
      // Read a specific document which may contain a map of emails -> sidebar map
      console.log(`Reading document ${collectionName}/${docId}`);
      const docRef = db.collection(collectionName).doc(docId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        console.log('Document not found');
        process.exit(0);
      }
      const data = docSnap.data();
      // If data contains top-level keys that look like emails mapping to sidebar maps, print them
      console.log('Document fields:');
      const keys = Object.keys(data || {});
      for (const k of keys) {
        const val = data[k];
        // heuristic: if val is object and contains boolean values, treat as sidebar map
        if (val && typeof val === 'object') {
          const boolKeys = Object.keys(val).filter(x => typeof val[x] === 'boolean');
          if (boolKeys.length > 0) {
            console.log('-----');
            console.log('email (map key):', k);
            console.log('sidebar:');
            // print known keys first
            const knownKeys = [
              'settings',
              'projects-summary',
              'dashboard',
              'financial-dashboard',
              'document-search',
              'n8n-vector-search',
              'ai-search',
              'projects/info-center'
            ];
            for (const kk of knownKeys) {
              if (Object.prototype.hasOwnProperty.call(val, kk)) console.log(`  ${kk}: ${String(val[kk])}`);
            }
            const extra = Object.keys(val).filter(x => !knownKeys.includes(x)).sort();
            for (const ex of extra) console.log(`  ${ex}: ${String(val[ex])}`);
          }
        }
      }
      process.exit(0);
    } else {
      console.log(`Querying collection: ${collectionName}`);
      const snapshot = await db.collection(collectionName).get();
      if (snapshot.empty) {
        console.log('No documents found in collection.');
        process.exit(0);
      }

      let total = 0;
      for (const doc of snapshot.docs) {
        total++;
        const data = doc.data();
        const id = doc.id;
        const email = data.email || '<no-email>';
        const sidebar = data.sidebar || {};
        console.log('-----');
        console.log('docId:', id);
        console.log('email:', email);
        console.log('sidebar:');
        // Print known keys first in deterministic order
        const knownKeys = [
          'settings',
          'projects-summary',
          'dashboard',
          'financial-dashboard',
          'document-search',
          'n8n-vector-search',
          'ai-search',
          'projects/info-center'
        ];
        for (const k of knownKeys) {
          if (Object.prototype.hasOwnProperty.call(sidebar, k)) {
            console.log(`  ${k}: ${String(sidebar[k])}`);
          }
        }
        // Print any additional keys
        const extra = Object.keys(sidebar).filter(k => !knownKeys.includes(k)).sort();
        if (extra.length) {
          console.log('  (extra keys)');
          for (const k of extra) console.log(`  ${k}: ${String(sidebar[k])}`);
        }
      }
      console.log('-----');
      console.log(`Total documents: ${total}`);
    }
  } catch (err) {
    console.error('Error checking user permissions:', err);
    process.exit(1);
  }
}

main();
