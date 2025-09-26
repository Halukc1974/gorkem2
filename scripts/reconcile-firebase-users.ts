#!/usr/bin/env node
/**
 * Reconcile Firebase Auth users with app storage users.
 * For each Firebase user, find storage user by email and ensure storage.googleId === firebase.uid
 * Run locally with DEBUG_ADMIN=true and proper GOOGLE/FIREBASE credentials available.
 */
import { getFirebaseAdmin } from '../server/firebaseAdmin';
import { storage } from '../server/storage';

async function run() {
  try {
    const admin = getFirebaseAdmin();
    console.log('Listing Firebase users...');
    let nextPageToken: string | undefined = undefined;
    let total = 0;
    do {
      const listResult = await admin.auth().listUsers(1000, nextPageToken);
      for (const u of listResult.users) {
        total++;
        const email = u.email;
        const uid = u.uid;
        if (!email) continue;
        const existing = await storage.getUserByEmail(email);
        if (existing) {
          if (!existing.googleId || existing.googleId !== uid) {
            console.log(`Updating storage user for email=${email}: setting googleId=${uid}`);
            await storage.updateUser(existing.id, { googleId: uid } as any);
          }
        } else {
          console.log(`No storage user for email=${email}, creating upsert with googleId=${uid}`);
          await storage.upsertUser({ googleId: uid, email, name: u.displayName || '', picture: u.photoURL || null, role: 'user' });
        }
      }
      nextPageToken = listResult.pageToken;
    } while (nextPageToken);

    console.log(`Reconciliation complete. Processed ${total} Firebase users.`);
  } catch (err) {
    console.error('Reconciliation error:', err);
    process.exit(1);
  }
}

run();
