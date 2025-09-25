// Server authentication utility - Firebase ID token to server session bridge
import { auth } from '../lib/firebase';

/**
 * Creates server session from Firebase ID token
 * This bridges Firebase client auth with server-side session auth
 */
export async function createServerSession(): Promise<boolean> {
  try {
    if (!auth.currentUser) {
      console.log('🔐 No Firebase user - cannot create server session');
      return false;
    }

    console.log('🔐 Creating server session from Firebase ID token...');
    
    // Get Firebase ID token
    const idToken = await auth.currentUser.getIdToken();
    
    // Send to server to create session
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Important: include cookies for session
      body: JSON.stringify({ idToken })
    });

    if (response.ok) {
      const user = await response.json();
      console.log('✅ Server session created successfully:', user.email);
      return true;
    } else {
      const error = await response.text();
      console.error('❌ Failed to create server session:', response.status, error);
      return false;
    }
  } catch (error) {
    console.error('❌ Error creating server session:', error);
    return false;
  }
}

/**
 * Ensures server session exists before making authenticated requests
 */
export async function ensureServerSession(): Promise<boolean> {
  try {
    // First check if session already exists
    const checkResponse = await fetch('/api/auth/user', {
      credentials: 'include'
    });
    
    if (checkResponse.ok) {
      console.log('✅ Server session already exists');
      return true;
    }
    
    // If no session, create one
    return await createServerSession();
  } catch (error) {
    console.error('❌ Error checking server session:', error);
    return false;
  }
}