import { createClient } from '@supabase/supabase-js';

// Load baseline config from Vite env variables
const metaEnv = (import.meta as any).env || {};
let supabaseUrl = metaEnv.VITE_SUPABASE_URL || '';
let supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';

// If client-side env is not injected during build, inspect session/window global variables
if (typeof window !== 'undefined') {
  supabaseUrl = supabaseUrl || (window as any)._SUPABASE_URL || '';
  supabaseAnonKey = supabaseAnonKey || (window as any)._SUPABASE_ANON_KEY || '';
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

// Helper function to update config at runtime once loaded from our API
export function reinitializeSupabase(url: string, key: string) {
  if (typeof window !== 'undefined') {
    (window as any)._SUPABASE_URL = url;
    (window as any)._SUPABASE_ANON_KEY = key;
  }
  
  try {
    const updatedClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    
    // Smoothly re-assign methods and credentials
    Object.assign(supabase, updatedClient);
    supabase.auth = updatedClient.auth;
    console.log("Supabase Client updated and ready with dynamic backend secrets! 🚀");
  } catch (err) {
    console.error("Failed to reinitialize Supabase Client:", err);
  }
}
