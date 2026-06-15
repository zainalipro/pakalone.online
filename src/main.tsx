import {StrictMode, useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import AdminDashboard from './AdminDashboard.tsx';
import GameDetailPage from './GameDetailPage.tsx';
import { reinitializeSupabase } from './supabase.ts';
import './index.css';

// Lightweight page for popup callback
function SupabaseCallbackPage() {
  useEffect(() => {
    // The redirect from Supabase carries session tokens in the URL hash, which
    // the client parser inside the popup detects and persists into shared LocalStorage.
    // We notify the opener window of completion and then close this popup cleanly.
    if (window.opener) {
      window.opener.postMessage({ type: 'SUPABASE_AUTH_SUCCESS' }, window.location.origin);
      setTimeout(() => {
        try {
          window.close();
        } catch (e) {
          console.error("Popup window self-close blocked:", e);
        }
      }, 800);
    } else {
      window.location.href = '/admin';
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4 animate-spin"></div>
      <p className="text-sm font-black text-blue-950">Validating Verified Mirror Session...</p>
      <p className="text-[11px] font-bold text-slate-400 mt-1">This pop-up will close automatically in a moment.</p>
    </div>
  );
}

// Bootstrap application once Supabase connection details are retrieved from backend
async function bootstrapAndRender() {
  try {
    const response = await fetch('/api/supabase-config');
    if (response.ok) {
      const config = await response.json();
      if (config.supabaseUrl && config.supabaseAnonKey) {
        reinitializeSupabase(config.supabaseUrl, config.supabaseAnonKey);
      }
    }
  } catch (error) {
    console.warn("Bootstrap Supabase connection config could not load, relying on client env vars:", error);
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/game/:id" element={<GameDetailPage />} />
          <Route path="/auth/supabase-callback" element={<SupabaseCallbackPage />} />
        </Routes>
      </BrowserRouter>
    </StrictMode>
  );
}

bootstrapAndRender();

