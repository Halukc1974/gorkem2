// Development-only Supabase configuration
// This file should NOT be included in production builds

export const DEV_SUPABASE_CONFIG = {
  url: process.env.VITE_SUPABASE_URL || '',
  anonKey: process.env.VITE_SUPABASE_ANON_KEY || ''
};