#!/usr/bin/env node
// Development helper: list Firebase Auth users using the server's firebaseAdmin initializer.
// Usage: DEBUG_ADMIN=true node scripts/list-firebase-users.mjs

import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

(async function main() {
  try {
    // Prefer importing TS source when running via `npx tsx` in dev. Fallback to built JS in dist.
    const tsPath = path.resolve(process.cwd(), 'server', 'firebaseAdmin.ts');
    const jsPath = path.resolve(process.cwd(), 'server', 'firebaseAdmin.js');
  const distPath = path.resolve(process.cwd(), 'dist', 'server', 'firebaseAdmin.js');
  const distIndex = path.resolve(process.cwd(), 'dist', 'index.js');

    let target;
    if (fs.existsSync(tsPath)) {
      target = tsPath;
    } else if (fs.existsSync(jsPath)) {
      target = jsPath;
    } else if (fs.existsSync(distPath)) {
      target = distPath;
    } else if (fs.existsSync(distIndex)) {
      target = distIndex;
    } else {
      console.error('Could not find server/firebaseAdmin.(ts|js) or dist/server/firebaseAdmin.js. Build the project or run with tsx.');
      process.exit(2);
    }

    const mod = await import(pathToFileURL(target).href);
    const getFirebaseAdmin = mod.getFirebaseAdmin || (mod.default && mod.default.getFirebaseAdmin);
    if (!getFirebaseAdmin) {
      console.error('getFirebaseAdmin not found in', target);
      process.exit(2);
    }

    const admin = getFirebaseAdmin();
    let nextPageToken;
    let total = 0;
    do {
      const listResult = await admin.auth().listUsers(1000, nextPageToken);
      for (const u of listResult.users) {
        console.log(u.uid, u.email || '<no-email>', u.displayName || '<no-name>');
        total++;
      }
      nextPageToken = listResult.pageToken;
    } while (nextPageToken);
    console.log(`\nTotal users: ${total}`);
  } catch (err) {
    console.error('Error listing Firebase users:', err);
    process.exit(1);
  }
})();
