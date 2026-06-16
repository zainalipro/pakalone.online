import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabase';
import { AppReview } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, Plus, Trash2, Edit, LogOut, Loader2, Save, X, Smartphone, CheckCircle2, AlertCircle, Sparkles, Mail, Send, Users, Settings, Calendar, Share2 } from 'lucide-react';
import { applyTheme } from './theme';

export default function AdminDashboard() {
  const [user, setUser] = useState<any | null>(null);
  const [loadingApp, setLoadingApp] = useState(true);
  const [apps, setApps] = useState<AppReview[]>([]);
  const navigate = useNavigate();

  // Tab State
  const [activeTab, setActiveTab] = useState<'games' | 'smtp' | 'subscribers' | 'messages' | 'admins' | 'database'>('games');

  // Admin access validation state
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const [isVerifyingAdmin, setIsVerifyingAdmin] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Additional Admins State
  const [adminsList, setAdminsList] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // Supabase Database Config State
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [isConnectedSupabase, setIsConnectedSupabase] = useState(false);
  const [savingSupabase, setSavingSupabase] = useState(false);

  // Active Database Provider Configuration (Supabase vs Firebase)
  const [dbProvider, setDbProvider] = useState<'supabase' | 'firebase'>('supabase');
  const [switchingProvider, setSwitchingProvider] = useState(false);

  // SMTP and portal customization settings state
  const [smtpSettings, setSmtpSettings] = useState({
    smtp_host: 'smtp.gmail.com',
    smtp_port: '465',
    smtp_secure: 'true',
    smtp_user: '',
    smtp_pass: '',
    smtp_from: '',
    community_facebook: '',
    community_twitter: '',
    community_telegram: '',
    portal_theme_mode: 'light',
    gemini_api_key: ''
  });

  // User subscription lists
  interface Subscriber {
    id: number;
    email: string;
    subscribedAt: string;
  }
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);

  // Submitted contact messages
  interface UserMessage {
    id: number;
    name: string;
    email: string;
    subject: string;
    message: string;
    submittedAt: string;
  }
  const [userMessages, setUserMessages] = useState<UserMessage[]>([]);

  // Email Notification Broadcast form state
  const [announceForm, setAnnounceForm] = useState({
    targetType: 'all', // 'all' | 'specific'
    toEmail: '',
    subject: '',
    messageHtml: ''
  });
  const [sendingAnnounce, setSendingAnnounce] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [smtpSimulation, setSmtpSimulation] = useState(true);
  const [simulatedMailContent, setSimulatedMailContent] = useState<string | null>(null);

  // Dialog State
  const [isEditing, setIsEditing] = useState(false);
  const [editApp, setEditApp] = useState<Partial<AppReview>>({});
  const [editAppId, setEditAppId] = useState<string | null>(null);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  // Login Options State
  const [loginMode, setLoginMode] = useState<'google' | 'email' | 'recovery'>('email');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [localhostUrlInput, setLocalhostUrlInput] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleGenerateAI = async () => {
    if (!editApp.name) {
      showToast('Please enter an App Name first to generate AI content.', 'error');
      return;
    }
    try {
      setIsGeneratingAI(true);
      const response = await fetch('/api/gemini/seo-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          gameName: editApp.name, 
          gameDescription: editApp.detailedReview || editApp.tagline || ''
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate content');
      setAiResult(data);

      if (data.draft) {
        setEditApp(prev => ({
          ...prev,
          logo: prev.logo || data.draft.logo || '🎮',
          rating: prev.rating || data.draft.rating || 4.7,
          downloads: prev.downloads || data.draft.downloads || '100K+',
          apkSize: prev.apkSize || data.draft.apkSize || '25 MB',
          minCashout: prev.minCashout || data.draft.minCashout || 'Rs. 100',
          methods: prev.methods && prev.methods.length > 0 ? prev.methods : (data.draft.methods || ['EasyPaisa', 'JazzCash']),
          tagline: prev.tagline || data.draft.tagline || '',
          detailedReview: prev.detailedReview || data.draft.detailedReview || '',
          detailedReviewUrdu: prev.detailedReviewUrdu || data.draft.detailedReviewUrdu || '',
          pros: prev.pros && prev.pros.length > 0 ? prev.pros : (data.draft.pros || []),
          cons: prev.cons && prev.cons.length > 0 ? prev.cons : (data.draft.cons || []),
          badge: prev.badge || data.draft.badge || 'HOT',
          dailyUsers: prev.dailyUsers || data.draft.dailyUsers || '5,000+',
        }));
        showToast('AI Draft successfully applied to form fields! ⚡');
      } else {
        showToast('AI Content generated successfully! ✨');
      }
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Error generating AI content', 'error');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  useEffect(() => {
    applyTheme('saas-light');
  }, []);

  useEffect(() => {
    // 1. Check if we have a valid custom passcode-based session in storage (instant, bulletproof bypass)
    const customSessionStr = localStorage.getItem('pakalone_custom_admin_session');
    if (customSessionStr) {
      try {
        const stored = JSON.parse(customSessionStr);
        if (stored && stored.email) {
          setUser({ email: stored.email } as any);
          setIsAdminVerified(true);
          setLoadingApp(false);
          // Return non-op cleanup so we don't activate Supabase check loops or signout
          return () => {};
        }
      } catch (err) {
        console.warn("Stale custom admin session:", err);
      }
    }

    // 2. Listen for Supabase session changes manually
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Avoid overriding if we successfully authenticated via direct passcode
      if (localStorage.getItem('pakalone_custom_admin_session')) {
        return;
      }
      
      const usr = session?.user || null;
      setUser(usr ? { email: usr.email } as any : null);
      setVerificationError(null);
      
      if (usr && usr.email) {
        setIsVerifyingAdmin(true);
        try {
          const res = await fetch('/api/admin/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: usr.email })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.allowed) {
              setIsAdminVerified(true);
              setVerificationError(null);
            } else {
              setIsAdminVerified(false);
              setVerificationError(`Access Denied: The Google Account "${usr.email}" is not authorized on this admin panel.`);
              await supabase.auth.signOut();
            }
          } else {
            setIsAdminVerified(false);
            setVerificationError("Failed to check authorization settings on the backend server.");
          }
        } catch (e) {
          console.error("Admin verification error:", e);
          setIsAdminVerified(false);
          setVerificationError("Connection failure during server admin verification.");
        } finally {
          setIsVerifyingAdmin(false);
          setLoadingApp(false);
        }
      } else {
        setIsAdminVerified(false);
        setIsVerifyingAdmin(false);
        setLoadingApp(false);
      }
    });

    // Support same-origin cross-window popups redirect flow for iframes (OAuth spec)
    const handlePopupMessage = async (event: MessageEvent) => {
      if (localStorage.getItem('pakalone_custom_admin_session')) {
        return;
      }
      if (!event.origin.endsWith('.run.app') && !event.origin.includes('localhost') && event.origin !== window.location.origin) {
        return;
      }
      if (event.data?.type === 'SUPABASE_AUTH_SUCCESS') {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser({ email: session.user.email } as any);
        }
      }
    };
    window.addEventListener('message', handlePopupMessage);

    // Load active session immediately on startup if already authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (localStorage.getItem('pakalone_custom_admin_session')) {
        return;
      }
      if (session?.user) {
        setUser({ email: session.user.email } as any);
      } else {
        setLoadingApp(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('message', handlePopupMessage);
    };
  }, []);

  const loadApps = async () => {
    try {
      const response = await fetch('/api/apps');
      if (response.ok) {
        const data = await response.json();
        setApps(data || []);
      }
    } catch (e) {
      console.error("Failed to fetch apps:", e);
    }
  };

  const fetchSmtpSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setSmtpSettings(data || {
          smtp_host: 'smtp.gmail.com',
          smtp_port: '465',
          smtp_secure: 'true',
          smtp_user: '',
          smtp_pass: '',
          smtp_from: '',
          community_facebook: '',
          community_twitter: '',
          community_telegram: '',
          portal_theme_mode: 'light',
          gemini_api_key: ''
        });
      }
    } catch (e) {
      console.error("Failed to read SMTP settings:", e);
    }
  };

  const fetchDbSubscribers = async () => {
    try {
      const res = await fetch('/api/admin/subscribers');
      if (res.ok) {
        const data = await res.json();
        setSubscribers(data || []);
      }
    } catch (e) {
      console.error("Failed to load subscribers list:", e);
    }
  };

  const fetchDbMessages = async () => {
    try {
      const res = await fetch('/api/admin/messages');
      if (res.ok) {
        const data = await res.json();
        setUserMessages(data || []);
      }
    } catch (e) {
      console.error("Failed to load user inquiries:", e);
    }
  };

  const fetchAdminsConfig = async () => {
    try {
      const res = await fetch('/api/admin/admins-list');
      if (res.ok) {
        const data = await res.json();
        setAdminsList(data || []);
      }
    } catch (e) {
      console.error("Failed to load admins list:", e);
    }
  };

  const fetchSupabaseSettings = async () => {
    try {
      const res = await fetch('/api/admin/supabase-url');
      if (res.ok) {
        const data = await res.json();
        setSupabaseUrl(data.url || '');
        setIsConnectedSupabase(data.connected || false);
      }
    } catch (e) {
      console.error("Failed to load Supabase settings:", e);
    }
  };

  const fetchDbProvider = async () => {
    try {
      const res = await fetch('/api/admin/db-provider');
      if (res.ok) {
        const data = await res.json();
        if (data.provider) {
          setDbProvider(data.provider);
        }
      }
    } catch (e) {
      console.error("Failed to load active database provider:", e);
    }
  };

  const handleSwitchProvider = async (provider: 'supabase' | 'firebase') => {
    try {
      setSwitchingProvider(true);
      const res = await fetch('/api/admin/db-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider })
      });
      if (res.ok) {
        setDbProvider(provider);
        showToast(`Switched active database and storage engine to ${provider === 'supabase' ? 'Supabase PostgreSQL' : 'Firebase Firestore'}! 🚀`);
        loadApps();
        fetchSupabaseSettings();
      } else {
        showToast('Failed to switch database provider.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error switching active database', 'error');
    } finally {
      setSwitchingProvider(false);
    }
  };

  // Automatically sync dashboards on login and tab selection
  useEffect(() => {
    if (user && isAdminVerified) {
      loadApps();
      fetchSmtpSettings();
      fetchDbSubscribers();
      fetchDbMessages();
      fetchAdminsConfig();
      fetchSupabaseSettings();
      fetchDbProvider();
    }
  }, [user, isAdminVerified, activeTab]);

  const handleLogin = async () => {
    try {
      setVerificationError(null);
      // Initiate secure, iframe-compatible pop-up Google OAuth flow via Supabase
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/supabase-callback`,
          skipBrowserRedirect: true
        }
      });
      if (error) throw error;
      if (data?.url) {
        const authWindow = window.open(data.url, 'Supabase_Google_Login', 'width=630,height=720');
        if (!authWindow) {
          setVerificationError("Your browser blocked the login pop-up. Please enable pop-ups for this site and try again.");
          showToast("Pop-up blocked. Please enable pop-ups.", "error");
        }
      } else {
        throw new Error("No OAuth URL returned from Supabase.");
      }
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Login initiation failed', 'error');
    }
  };

  const handleLocalhostLinkPaste = async (e: FormEvent) => {
    e.preventDefault();
    if (!localhostUrlInput) {
      showToast('Please paste a redirect URL.', 'error');
      return;
    }
    try {
      setVerificationError(null);
      
      // Extract the hash part from either complete URL or just hash
      let hash = localhostUrlInput.trim();
      if (hash.includes('#')) {
        hash = hash.substring(hash.indexOf('#'));
      }
      
      const params = new URLSearchParams(hash.replace('#', '?'));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      
      if (!accessToken) {
        throw new Error("Could not find a valid access_token in the URL. Please copy the complete URL from the address bar of the error page (including the part after the #) and paste it here.");
      }
      
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || ''
      });
      
      if (error) throw error;
      
      if (data?.user) {
        showToast("Authenticated successfully via Link Recovery! 🎉");
        setLocalhostUrlInput('');
      }
    } catch (e: any) {
      console.error(e);
      setVerificationError(e.message || "Failed to process the redirect URL.");
      showToast(e.message || "Failed to process the redirect URL.", "error");
    }
  };

  const handleEmailPasswordLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) {
      showToast('Email and password are required.', 'error');
      return;
    }
    try {
      setVerificationError(null);
      
      // 1. Try bespoke direct backend admin login first
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: emailInput.trim(),
          password: passwordInput
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.email) {
          localStorage.setItem('pakalone_custom_admin_session', JSON.stringify({ email: result.email }));
          setUser({ email: result.email } as any);
          setIsAdminVerified(true);
          showToast(`Logged in successfully as ${result.email}! 🔑`);
          setEmailInput('');
          setPasswordInput('');
          return;
        }
      }

      // 2. Fallback to Supabase native email/password auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailInput.trim(),
        password: passwordInput,
      });
      if (error) throw error;
      if (data?.user) {
        showToast("Logged in successfully via Supabase! 🔑");
        setEmailInput('');
        setPasswordInput('');
      }
    } catch (e: any) {
      console.error(e);
      setVerificationError(e.message || "Invalid email or passcode. Ensure your email is added to the Authorized Admins list.");
      showToast(e.message || "Failed to authenticate.", "error");
    }
  };

  const handleAddAdmin = async (e: FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail || !newAdminEmail.includes('@')) {
      showToast('A valid email address is required.', 'error');
      return;
    }
    try {
      const res = await fetch('/api/admin/admins-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newAdminEmail })
      });
      if (res.ok) {
        showToast('Administrator email registered successfully!');
        setNewAdminEmail('');
        fetchAdminsConfig();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to add administrator', 'error');
      }
    } catch (err) {
      showToast('Could not register administrator.', 'error');
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    const isRootAdmin = adminsList.indexOf(email) < 3;
    if (isRootAdmin) {
      showToast('Root administrator accounts cannot be deleted.', 'error');
      return;
    }
    if (!confirm(`Are you sure you want to remove ${email} from authorized administrators?`)) return;
    try {
      const res = await fetch(`/api/admin/admins-list/${encodeURIComponent(email)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Administrator removed successfully.');
        fetchAdminsConfig();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to delete admin', 'error');
      }
    } catch (err) {
      showToast('Error removing administrator.', 'error');
    }
  };

  const handleSaveSupabase = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabaseUrl || !supabaseUrl.startsWith('postgresql://')) {
      showToast('Please enter a valid PostgreSQL connection URL starting with "postgresql://".', 'error');
      return;
    }
    try {
      setSavingSupabase(true);
      const res = await fetch('/api/admin/supabase-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: supabaseUrl })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Supabase integration swapped successfully! 🎉');
        fetchSupabaseSettings();
        loadApps();
      } else {
        showToast(data.error || 'Connection failed: settings not applied.', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Error switching database settings', 'error');
    } finally {
      setSavingSupabase(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('pakalone_custom_admin_session');
    setUser(null);
    setIsAdminVerified(false);
    await supabase.auth.signOut();
  };

  const handleSaveSmtp = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smtpSettings)
      });
      if (res.ok) {
        showToast('SMTP Mail Settings saved successfully! 📧');
        fetchSmtpSettings();
      } else {
        showToast('Failed to save SMTP Settings', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error updating SMTP configuration', 'error');
    }
  };

  const handlePresetGmail = () => {
    setSmtpSettings(prev => ({
      ...prev,
      smtp_host: 'smtp.gmail.com',
      smtp_port: '465',
      smtp_secure: 'true',
      smtp_from: prev.smtp_from || 'Pakalone Games <your-address@gmail.com>',
      smtp_user: prev.smtp_user || 'your-address@gmail.com'
    }));
    showToast('Applied Gmail configurations. Enter your authorized username and App Password! 💡');
  };

  const handleSendTestEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!testEmailAddress || !testEmailAddress.includes('@')) {
      showToast('Please specify a valid test recipient email address.', 'error');
      return;
    }
    const htmlBody = `
      <div style="font-family: sans-serif; padding: 24px; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1e293b;">
        <h2 style="color: #10b981; margin-top: 0; border-bottom: 2px solid #10b981; padding-bottom: 8px;">✔️ SMTP Connection Confirmed!</h2>
        <p>Excellent! Your custom SMTP system settings are correctly registered and connected onto <strong>Pakalone Games</strong> database repository nodes.</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px;">
          <tr style="background-color: #f8fafc;">
            <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold; width: 140px;">SMTP Host</td>
            <td style="padding: 10px; border: 1px solid #e2e8f0; font-family: monospace;">${smtpSettings.smtp_host}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">SMTP Port</td>
            <td style="padding: 10px; border: 1px solid #e2e8f0; font-family: monospace;">${smtpSettings.smtp_port}</td>
          </tr>
          <tr style="background-color: #f8fafc;">
            <td style="padding: 10px; border: 1px solid #e2e8f0; font-weight: bold;">Sender Header</td>
            <td style="padding: 10px; border: 1px solid #e2e8f0;">${smtpSettings.smtp_from || smtpSettings.smtp_user}</td>
          </tr>
        </table>
        <p style="margin-top: 20px; font-size: 12px; color: #64748b;">This verification message was sent successfully. You may close this notification safely.</p>
      </div>
    `;

    try {
      setSendingTestEmail(true);
      const saveRes = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smtpSettings)
      });
      if (!saveRes.ok) throw new Error("Could not serialize parameters.");

      const testRes = await fetch('/api/admin/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'specific',
          toEmail: testEmailAddress,
          subject: '🎰 Pakalone SMTP Live Connection Test',
          messageHtml: htmlBody,
          simulate: smtpSimulation
        })
      });

      const data = await testRes.json();
      if (testRes.ok && data.success) {
        if (data.simulated) {
          setSimulatedMailContent(htmlBody);
          showToast('Sandbox mode: Credentials saved. Simulated email success! 🌟 (Preview generated below)');
        } else {
          showToast('Success! Verification email successfully sent. Check your inbox! 💌');
        }
      } else {
        throw new Error(data.error || 'The mail agent rejected login parameters.');
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'SMTP Handshake failed. Check your App Passwords.', 'error');
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleRemoveSubscriber = async (email: string) => {
    if (!confirm(`Are you sure you want to delete subscriber ${email}?`)) return;
    try {
      const res = await fetch(`/api/admin/subscribers/${email}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Subscriber unsubscribed permanently. 🗑️');
        fetchDbSubscribers();
      } else {
        showToast('Could not remove subscriber', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error contacting subscription service', 'error');
    }
  };

  const handleSendAnnounce = async (e: FormEvent) => {
    e.preventDefault();
    if (!announceForm.subject || !announceForm.messageHtml) {
      showToast('Subject and HTML template body are REQUIRED.', 'error');
      return;
    }
    try {
      setSendingAnnounce(true);
      const res = await fetch('/api/admin/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(announceForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Broadcast action failed");

      if (data.sentSuccess !== undefined) {
        showToast(`Broadcasting completed: ${data.sentSuccess} delivered, ${data.sentFail} failed. 🚀`);
      } else {
        showToast('Email notification dispatched successfully! 📬');
      }
      setAnnounceForm({
        targetType: 'all',
        toEmail: '',
        subject: '',
        messageHtml: ''
      });
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to dispatch email campaign.', 'error');
    } finally {
      setSendingAnnounce(false);
    }
  };

  const handleCreateNew = () => {
    setEditApp({
      name: '', logo: '', rating: 5, downloads: '', apkSize: '',
      minCashout: '', methods: [], tagline: '', detailedReview: '',
      detailedReviewUrdu: '', pros: [], cons: [], badge: '', apkUrl: '', dailyUsers: '',
      previewImages: [], videoUrl: ''
    });
    setEditAppId(null);
    setIsEditing(true);
  };

  const handleEdit = (app: AppReview) => {
    setEditApp({ 
      ...app,
      previewImages: app.previewImages || [],
      videoUrl: app.videoUrl || ''
    });
    setEditAppId(app.id!);
    setIsEditing(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        ...editApp,
      };
      
      // clean arrays
      if (typeof payload.methods === 'string') {
        payload.methods = payload.methods.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (typeof payload.pros === 'string') {
        payload.pros = payload.pros.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (typeof payload.cons === 'string') {
        payload.cons = payload.cons.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      if (typeof payload.previewImages === 'string') {
        payload.previewImages = payload.previewImages.split(',').map((s: string) => s.trim()).filter(Boolean);
      }

      payload.rating = Number(payload.rating) || 5;

      const docId = editAppId || (payload.name as string).toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 30) + '-' + Date.now().toString().slice(-4);
      delete payload.id;

      const response = await fetch(`/api/apps/${docId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("Failed to save changes inside DB");
      }

      showToast(editAppId ? 'App updated successfully! 🚀' : 'New app created successfully! 🎉');
      setIsEditing(false);
      // reload lists
      loadApps();
    } catch (error) {
       console.error("Save error details: ", error);
       showToast('Failed to save app changes.', 'error');
    }
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 200;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // compress heavily to stay well within firestore limit
        const dataUrl = canvas.toDataURL('image/webp', 0.82);
        setEditApp(prev => ({ ...prev, logo: dataUrl }));
      };
      if (event.target?.result) {
        img.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePortalLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 450; // crisp and wide enough for website logo
        const scaleSize = Math.min(1, MAX_WIDTH / img.width);
        canvas.width = img.width * scaleSize;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL('image/webp', 0.82);
        setSmtpSettings(prev => ({ ...prev, portal_logo_url: dataUrl }));
        showToast('Website logo loaded. Click save below to apply! 🖼️');
      };
      if (event.target?.result) {
        img.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGamePreviewsChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    showToast('Processing uploaded screenshots... 📱');
    
    const readAndCompress = (file: File): Promise<string> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 550; // Optimized size for sharp, compact previews
            const scaleSize = Math.min(1, MAX_WIDTH / img.width);
            canvas.width = img.width * scaleSize;
            canvas.height = img.height * scaleSize;

            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.75));
          };
          if (event.target?.result) {
            img.src = event.target.result as string;
          }
        };
        reader.readAsDataURL(file);
      });
    };

    try {
      const compressedResults: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const dataUrl = await readAndCompress(files[i]);
        compressedResults.push(dataUrl);
      }

      // Merge with any current ones
      const current = Array.isArray(editApp.previewImages) ? editApp.previewImages : [];
      setEditApp(prev => ({
        ...prev,
        previewImages: [...current, ...compressedResults]
      }));
      showToast(`Successfully uploaded ${files.length} screenshots!`);
    } catch (err) {
      console.error(err);
      showToast('Failed to process preview screenshots.', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this app?')) return;
    try {
      const response = await fetch(`/api/apps/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error("Delete failed");
      showToast('App deleted permanently. 🗑️');
      loadApps();
    } catch (error) {
      console.error(error);
      showToast('Failed to delete app.', 'error');
    }
  };

  if (loadingApp || isVerifyingAdmin) {
    return <div className="min-h-screen flex items-center justify-center text-gold-400"><Loader2 className="animate-spin h-8 w-8" /></div>;
  }

  if (!user || !isAdminVerified) {
    return (
      <div className="min-h-screen gradient-radial flex items-center justify-center p-4">
        <div className="bg-charcoal-900 border border-zinc-800 p-8 rounded-3xl max-w-sm w-full space-y-6 text-center shadow-2xl">
          <ShieldAlert className="h-12 w-12 text-gold-400 mx-auto" />
          <div>
            <h1 className="font-display text-2.5xl font-black text-white tracking-tight">Admin Console</h1>
            <p className="text-zinc-400 mt-1.5 text-xs">Authorized Gmail & PIN Credentials Verification</p>
          </div>

          {verificationError && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-left text-xs font-semibold text-rose-400 leading-relaxed">
              {verificationError}
            </div>
          )}

          <form onSubmit={handleEmailPasswordLogin} className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 font-mono">Gmail Address</label>
              <input
                type="email"
                required
                placeholder="admin@pakalone.online"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full bg-black/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold-500 font-medium placeholder-zinc-700 transition-all font-sans"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 font-mono">Access Passcode</label>
              <input
                type="password"
                required
                placeholder="••••••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full bg-black/60 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-gold-500 font-medium placeholder-zinc-700 transition-all font-sans"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gold-400 hover:bg-gold-500 active:scale-[0.98] text-charcoal-800 font-black py-3 rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer text-sm font-sans"
            >
              Log in securely as Admin
            </button>
          </form>

          <div className="pt-2 border-t border-zinc-850 flex items-center justify-center">
            <button 
              onClick={() => navigate('/')}
              className="text-xs font-semibold text-zinc-500 hover:text-white transition-colors"
            >
              ← Back to Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-radial flex flex-col items-center py-8 px-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border backdrop-blur-md font-medium
               ${toast.type === 'success' 
                 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                 : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
               }`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-6xl space-y-8 relative z-10">
        
        {/* Header */}
        <header className="flex justify-between items-center p-6 bg-charcoal-900 border border-zinc-800 rounded-2xl shadow-xl">
          <div>
            <h1 className="text-2xl font-display font-extrabold text-white">Console Admin</h1>
            <p className="text-zinc-500 text-sm">Managing portal for {user.email}</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => navigate('/')} 
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
            >
              View Portal
            </button>
            <button 
              onClick={handleLogout} 
              className="px-4 py-2 text-sm bg-rose-500/10 text-rose-500 font-bold rounded-lg border border-rose-500/30 hover:bg-rose-500/20"
            >
              Sign out
            </button>
          </div>
        </header>

        {isEditing ? (
          <div className="bg-charcoal-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl animate-fade-in text-zinc-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">{editAppId ? 'Edit App' : 'Add New App'}</h2>
              <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">App Name (Required)</label>
                  <input required value={editApp.name} onChange={e => setEditApp({...editApp, name: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-sm" placeholder="e.g. 3 Patti Lucky PK" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Logo (Emoji or URL) (Required)</label>
                  <div className="flex gap-2 items-center">
                    <input required value={editApp.logo} onChange={e => setEditApp({...editApp, logo: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-sm" placeholder="e.g. 🎰 or image URL" />
                    <label className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-3 rounded-lg cursor-pointer whitespace-nowrap text-sm font-semibold transition">
                      Upload
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  </div>
                  {editApp.logo && editApp.logo.startsWith('data:image') && (
                    <img src={editApp.logo} alt="Preview" className="h-10 mt-2 rounded" />
                  )}
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Affiliate / APK URL (Required)</label>
                  <input required value={editApp.apkUrl} onChange={e => setEditApp({...editApp, apkUrl: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-sm" placeholder="https://..." />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Tagline</label>
                  <input value={editApp.tagline} onChange={e => setEditApp({...editApp, tagline: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Badge Text</label>
                  <input value={editApp.badge} onChange={e => setEditApp({...editApp, badge: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-sm" placeholder="e.g. EDITOR'S CHOICE" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Rating</label>
                  <input type="number" step="0.1" value={editApp.rating} onChange={e => setEditApp({...editApp, rating: parseFloat(e.target.value)})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Downloads display</label>
                  <input value={editApp.downloads} onChange={e => setEditApp({...editApp, downloads: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">APK Size display</label>
                  <input value={editApp.apkSize} onChange={e => setEditApp({...editApp, apkSize: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-sm" />
                </div>
                 <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Min Cashout display</label>
                  <input value={editApp.minCashout} onChange={e => setEditApp({...editApp, minCashout: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-sm" />
                </div>
                 <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Daily Users</label>
                  <input value={editApp.dailyUsers} onChange={e => setEditApp({...editApp, dailyUsers: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Withdrawal Methods (Comma separated)</label>
                  <input value={editApp.methods ? editApp.methods.join(', ') : ''} onChange={e => setEditApp({...editApp, methods: e.target.value as any})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-sm" placeholder="e.g. EasyPaisa, JazzCash" />
                </div>

                 <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Pros (Comma separated)</label>
                  <input value={editApp.pros ? editApp.pros.join(', ') : ''} onChange={e => setEditApp({...editApp, pros: e.target.value as any})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-sm" />
                </div>
                 <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Cons (Comma separated)</label>
                  <input value={editApp.cons ? editApp.cons.join(', ') : ''} onChange={e => setEditApp({...editApp, cons: e.target.value as any})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-sm" />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Detailed Review</label>
                  <textarea rows={4} value={editApp.detailedReview} onChange={e => setEditApp({...editApp, detailedReview: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-sm align-top leading-relaxed" />
                </div>
                 <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Detailed Review (Urdu)</label>
                  <textarea rows={4} dir="rtl" value={editApp.detailedReviewUrdu} onChange={e => setEditApp({...editApp, detailedReviewUrdu: e.target.value})} className="w-full font-sans bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-[15px] align-top leading-relaxed" />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Gameplay Video URL (YouTube Embed or MP4 link, Optional)</label>
                  <input value={editApp.videoUrl || ''} onChange={e => setEditApp({...editApp, videoUrl: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-sm" placeholder="e.g. https://www.youtube.com/embed/dQw4w9WgXcQ" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Game Preview Images (Upload manually & manage list)</label>
                  
                  {/* File Upload Zone */}
                  <div className="flex gap-4 items-center mb-3">
                    <label className="flex-1 border-2 border-dashed border-zinc-850 hover:border-gold-500/50 rounded-xl p-5 text-center cursor-pointer transition bg-zinc-950/20 hover:bg-zinc-950/40">
                      <div className="text-zinc-400 text-xs font-bold flex flex-col items-center gap-1.5">
                        <span className="text-gold-400 text-xl">📱</span>
                        <span>Click to choose & upload multiple screenshots</span>
                        <span className="text-3xs text-zinc-500 font-normal">Files are compressed automatically to keep page loads high-speed</span>
                      </div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        multiple 
                        onChange={handleGamePreviewsChange} 
                        className="hidden" 
                      />
                    </label>
                  </div>

                  {/* Manual / Pasted URLs Text Input backup fallback */}
                  <textarea 
                    rows={2} 
                    value={editApp.previewImages ? (Array.isArray(editApp.previewImages) ? editApp.previewImages.join(', ') : editApp.previewImages) : ''} 
                    onChange={e => {
                      const val = e.target.value;
                      setEditApp({
                        ...editApp, 
                        previewImages: val.split(',').map(s => s.trim()).filter(Boolean)
                      });
                    }} 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-xs align-top leading-relaxed font-mono text-zinc-400" 
                    placeholder="Comma-separated image URLs (e.g. https://domain.com/screen1.jpg, or automatic uploaded base64 data)" 
                  />

                  {/* Screenshots live visual representation tiles */}
                  {Array.isArray(editApp.previewImages) && editApp.previewImages.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 mt-3">
                      {editApp.previewImages.map((imgSrc, index) => (
                        <div key={index} className="relative group aspect-[9/16] bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden animate-fade-in">
                          <img src={imgSrc} alt={`Screenshot ${index + 1}`} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 transition-opacity">
                            <span className="text-3xs font-bold text-zinc-300">Slot #{index + 1}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...(editApp.previewImages || [])];
                                updated.splice(index, 1);
                                setEditApp({ ...editApp, previewImages: updated });
                              }}
                              className="p-1.5 bg-rose-600 rounded-full text-white hover:bg-rose-700 transition shadow hover:scale-110"
                              title="Delete Screenshot"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="absolute bottom-1 left-1 bg-black/80 px-1 rounded text-[8px] font-mono font-bold text-zinc-400 border border-zinc-800">
                            #{index + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {aiResult && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl space-y-4">
                   <h3 className="text-white font-bold flex items-center gap-2"><Sparkles className="h-5 w-5 text-indigo-400" /> AI SEO & Marketing Generation</h3>
                   <div>
                     <strong className="text-xs text-indigo-300 uppercase tracking-wider block mb-1">SEO Title</strong>
                     <p className="text-sm text-zinc-300">{aiResult.seoTitle}</p>
                   </div>
                   <div>
                     <strong className="text-xs text-indigo-300 uppercase tracking-wider block mb-1">SEO Description</strong>
                     <p className="text-sm text-zinc-300">{aiResult.seoDescription}</p>
                   </div>
                   <div>
                     <strong className="text-xs text-indigo-300 uppercase tracking-wider block mb-1">SEO Keywords</strong>
                     <div className="flex gap-2 flex-wrap">
                       {aiResult.seoKeywords?.map((tag: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-indigo-500/20 text-indigo-300 text-xs rounded border border-indigo-500/20">{tag}</span>
                       ))}
                     </div>
                   </div>
                   <div>
                     <strong className="text-xs text-indigo-300 uppercase tracking-wider block mb-1">Promotional Email Newsletter</strong>
                     <textarea readOnly rows={5} className="w-full bg-zinc-950/50 border border-indigo-500/20 text-zinc-300 rounded-lg p-3 text-sm" value={aiResult.promotionalEmail} />
                   </div>
                </div>
              )}

              <div className="pt-4 flex justify-between gap-4 border-t border-zinc-800 mt-6">
                 <button type="button" onClick={handleGenerateAI} disabled={isGeneratingAI} className="bg-indigo-600 text-white font-bold px-4 py-3 rounded-lg flex items-center gap-2 hover:bg-indigo-500 disabled:opacity-50 transition">
                    {isGeneratingAI ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                    {isGeneratingAI ? 'Generating...' : 'AI Generate SEO & Mail'}
                 </button>
                 <div className="flex gap-4">
                   <button type="button" onClick={() => setIsEditing(false)} className="px-6 py-3 font-bold text-zinc-400 hover:text-white transition">Cancel</button>
                   <button type="submit" className="bg-emerald-500 text-charcoal-950 font-extrabold px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-emerald-400 disabled:opacity-50 transition">
                      <Save className="h-5 w-5" /> Save Game
                   </button>
                 </div>
              </div>

            </form>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Custom Tab Switcher */}
            <div className="flex border-b border-zinc-855 gap-2 overflow-x-auto pb-1" id="admin-tabs-nav">
              <button
                onClick={() => setActiveTab('games')}
                className={`px-5 py-3 text-xs font-extrabold border-b-2 tracking-wider uppercase transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'games' ? 'border-gold-500 text-gold-400 font-black' : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                <Smartphone className="h-4 w-4" />
                <span>Tested Apps ({apps.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('smtp')}
                className={`px-5 py-3 text-xs font-extrabold border-b-2 tracking-wider uppercase transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'smtp' ? 'border-gold-500 text-gold-400 font-black' : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                <Settings className="h-4 w-4" />
                <span>SMTP & Portal Settings</span>
              </button>
              <button
                onClick={() => setActiveTab('subscribers')}
                className={`px-5 py-3 text-xs font-extrabold border-b-2 tracking-wider uppercase transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'subscribers' ? 'border-gold-500 text-gold-400 font-black' : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>User List ({subscribers.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('messages')}
                className={`px-5 py-3 text-xs font-extrabold border-b-2 tracking-wider uppercase transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'messages' ? 'border-gold-500 text-gold-400 font-black' : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                <Mail className="h-4 w-4" />
                <span>Submitted Enquiries ({userMessages.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('admins')}
                className={`px-5 py-3 text-xs font-extrabold border-b-2 tracking-wider uppercase transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'admins' ? 'border-gold-500 text-gold-400 font-black' : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                <Plus className="h-4 w-4" />
                <span>Manage Admins ({adminsList.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('database')}
                className={`px-5 py-3 text-xs font-extrabold border-b-2 tracking-wider uppercase transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                  activeTab === 'database' ? 'border-gold-500 text-gold-400 font-black' : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                <Settings className="h-4 w-4" />
                <span>Databases Configuration</span>
              </button>
            </div>

            {/* TAB CONTENT: Tested Apps List */}
            {activeTab === 'games' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                   <h2 className="text-lg font-bold text-zinc-400 flex items-center gap-2">
                     <Smartphone className="h-5 w-5 text-gold-400" />
                     Tested Game Registrations
                   </h2>
                   <button 
                      onClick={handleCreateNew} 
                      className="bg-gold-500 hover:bg-gold-400 text-charcoal-950 font-black px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-lg transition cursor-pointer text-xs"
                   >
                     <Plus className="h-4 w-4" /> ADD NEW APP CARD
                   </button>
                </div>

                {apps.length === 0 ? (
                   <div className="text-center p-12 bg-charcoal-900 border border-zinc-800 rounded-2xl">
                      <p className="text-zinc-[450] text-sm">No tested applications active in current directories.</p>
                   </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {apps.map(app => (
                      <div key={app.id} className="bg-charcoal-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between text-left">
                         <div className="flex justify-between items-start">
                            <div className="flex gap-3">
                               <div className="w-14 h-14 text-3xl bg-zinc-950 p-2 rounded-xl flex-shrink-0 flex items-center justify-center border border-zinc-800">
                                 {app.logo && (app.logo.startsWith('http') || app.logo.startsWith('data:image')) ? (
                                   <img src={app.logo} alt={app.name} className="w-full h-full object-contain" />
                                 ) : (
                                   app.logo
                                 )}
                               </div>
                               <div>
                                  <h3 className="font-bold text-white text-base leading-tight mt-1">{app.name}</h3>
                                  <span className="text-[10px] text-gold-400 font-mono tracking-wider">{app.badge || 'NO BADGE'}</span>
                               </div>
                            </div>
                         </div>
                         <p className="text-xs text-zinc-400 mt-4 line-clamp-2 leading-relaxed font-medium">{app.tagline}</p>
                         
                         <div className="mt-5 border-t border-zinc-800 pt-4 flex justify-between gap-3">
                            <button onClick={() => handleEdit(app)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition cursor-pointer">
                               <Edit className="h-3.5 w-3.5" /> Edit Vetting Review
                            </button>
                            <button onClick={() => handleDelete(app.id!)} className="px-3.5 py-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition cursor-pointer" title="Delete App">
                               <Trash2 className="h-3.5 w-3.5" />
                            </button>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: SMTP configurations */}
            {activeTab === 'smtp' && (
              <div className="bg-charcoal-905 border border-zinc-800 rounded-2xl p-6 shadow-xl text-zinc-300 text-left space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
                    <Settings className="h-5 w-5 text-gold-400" />
                    <span>SMTP Mail Configuration & Verification</span>
                  </h3>
                  <p className="text-xs text-zinc-500 mt-2">
                    Enter your Gmail SMTP or custom SMTP details to send reliable bulk notifications and system feedback alerts.
                  </p>
                  
                  {/* SMTP Troubleshooter Help Card */}
                  <div className="mt-4 bg-zinc-950/65 border border-zinc-900 rounded-xl p-4 space-y-2 text-zinc-400">
                    <h4 className="text-2xs font-extrabold text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                      <span>⚠️</span>
                      <span>SMTP Credentials Guide & Troubleshooting Tips</span>
                    </h4>
                    <ul className="text-3xs list-disc pl-4 space-y-1 text-zinc-400 font-sans leading-normal">
                      <li><strong>Gmail App Password Required:</strong> Standard user account passwords will be blocked. You must enable 2-Step Verification and generate a 16-character <strong>App Password</strong> in Google Account Security Settings.</li>
                      <li><strong>Port Rules:</strong> Set port to <strong>587</strong> with secure connection off (STARTTLS transition) or port <strong>465</strong> with secure connection on (SSL).</li>
                      <li><strong>Server Network Permission:</strong> Hosting providers might block standard outgoing mail ports on server containers for safety. Use authorized secure relays for optimal results.</li>
                    </ul>
                  </div>
                  
                  {/* Preset Buttons */}
                  <div className="flex flex-wrap gap-2.5 mt-4 items-center bg-zinc-950 p-3 rounded-xl border border-zinc-800/60">
                    <span className="text-2xs font-extrabold text-zinc-400 uppercase tracking-wider font-mono">Quick Preset Configuration:</span>
                    <button
                      type="button"
                      onClick={handlePresetGmail}
                      className="px-3 py-1.5 bg-red-650 hover:bg-red-600 text-white rounded-lg text-2xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>Configure Gmail Defaults</span>
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSaveSmtp} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">SMTP Host Server</label>
                      <input
                        type="text"
                        required
                        value={smtpSettings.smtp_host}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_host: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-xs text-white"
                        placeholder="e.g. smtp.gmail.com"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">SMTP Port Number</label>
                      <input
                        type="text"
                        required
                        value={smtpSettings.smtp_port}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_port: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-xs text-white"
                        placeholder="e.g. 587 or 465"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">Use Secure Connection</label>
                      <select
                        value={smtpSettings.smtp_secure}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_secure: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-xs text-white"
                      >
                        <option value="false">No / STARTTLS (Port 587)</option>
                        <option value="true">Yes / SSL (Port 465)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">Sender From Header Value</label>
                      <input
                        type="text"
                        required
                        value={smtpSettings.smtp_from}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_from: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-xs text-white"
                        placeholder="e.g. Pakalone VIP <admin@gmail.com>"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">SMTP authorized User email</label>
                      <input
                        type="email"
                        required
                        value={smtpSettings.smtp_user}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_user: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-xs text-white"
                        placeholder="Username account mail"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">SMTP App Password</label>
                      <input
                        type="password"
                        required
                        value={smtpSettings.smtp_pass}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, smtp_pass: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-xs text-white"
                        placeholder="App specific token string"
                      />
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    className="bg-gold-500 hover:bg-gold-400 text-zinc-950 font-bold py-2.5 px-6 rounded-lg text-xs tracking-wider transition cursor-pointer"
                  >
                    SAVE SMTP CREDENTIALS
                  </button>
                </form>

                {/* GMAIL APP PASSWORD HANDBOOK */}
                <div className="bg-zinc-950 border border-zinc-800/80 p-4 rounded-xl text-xs space-y-2 text-zinc-400">
                  <h4 className="text-white font-bold flex items-center gap-1.5 uppercase tracking-wider text-[10px] text-yellow-500">
                    <AlertCircle className="h-4 w-4" /> Gmail App Password Setup Guide
                  </h4>
                  <p className="leading-relaxed">To use a personal Gmail account for sending system emails, using your normal account password is blocked by Google. Follow these instructions:</p>
                  <ol className="list-decimal pl-4 space-y-1 text-zinc-500 leading-relaxed font-mono text-[11px]">
                    <li>Go to your <a href="https://myaccount.google.com" target="_blank" rel="noreferrer" className="text-gold-400 underline">Google Account settings</a> page.</li>
                    <li>Navigate to <strong>Security</strong> &gt; Enable <strong>2-Step Verification</strong> (required).</li>
                    <li>Search or type <strong className="text-zinc-300">App Passwords</strong> in the settings search bar.</li>
                    <li>Choose "Other (custom name)" and enter <strong className="text-zinc-300">"Pakalone"</strong>, then click <strong>Generate</strong>.</li>
                    <li>Copy the 16-character generated password (no spaces) and paste it into the <strong>SMTP App Password</strong> field above.</li>
                  </ol>
                </div>

                {/* SMTP TEST CONNECTION WIDGET */}
                <div className="border border-emerald-500/20 bg-emerald-500/5 p-5 rounded-2xl space-y-4">
                  <h4 className="text-emerald-400 text-sm font-bold flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Test Current SMTP Connection
                  </h4>
                  
                  {/* Container port restricted alert */}
                  <div className="bg-amber-500/5 border border-amber-500/15 p-3 rounded-xl space-y-1.5 text-3xs text-amber-300 leading-normal">
                    <p className="font-bold flex items-center gap-1">
                      <span>⚡</span>
                      <span>Cloud Run Sandbox Socket Block Information</span>
                    </p>
                    <p className="text-zinc-400">
                      Standard outbound TCP sockets on ports <strong>25, 465, and 587</strong> are blocked inside this application preview container by Google Cloud platform firewall rules.
                    </p>
                    <p className="text-emerald-400/90">
                      <strong>Good news:</strong> Your configured SMTP credentials saved successfully inside your database. When triggered inside your production <strong>Supabase</strong> workspace or an environment with open networks, your emails will dispatch flawlessly!
                    </p>
                  </div>

                  <p className="text-xs text-zinc-400 leading-normal">
                    Enter a recipient email address below to test the active SMTP configurations on-the-spot. This will automatically serialize parameters and attempt a handshake delivery request.
                  </p>

                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="email"
                        value={testEmailAddress}
                        onChange={(e) => setTestEmailAddress(e.target.value)}
                        placeholder="Enter verification address (e.g. you@gmail.com)"
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        disabled={sendingTestEmail}
                        onClick={handleSendTestEmail}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-4 py-2.5 sm:py-0 rounded-lg text-xs transition whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {sendingTestEmail ? (
                          <span>Testing Connection...</span>
                        ) : (
                          <span>Send Test Email</span>
                        )}
                      </button>
                    </div>

                    {/* Simulation Option */}
                    <label className="flex items-start gap-2.5 bg-zinc-950/80 p-3 rounded-xl border border-zinc-900 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={smtpSimulation}
                        onChange={(e) => setSmtpSimulation(e.target.checked)}
                        className="mt-0.5 rounded border-zinc-800 bg-zinc-900 text-emerald-500 focus:ring-emerald-500/20"
                      />
                      <div className="text-left">
                        <span className="block text-2xs font-extrabold text-white uppercase tracking-wider">
                          Enable Sandbox Simulation Mode (Recommend for Gmail)
                        </span>
                        <span className="block text-3xs text-zinc-500 mt-0.5">
                          Forces server-side mail template verification and logs generation while bypassing the socket block.
                        </span>
                      </div>
                    </label>

                    {/* Simulated Mail Preview Portal */}
                    {simulatedMailContent && (
                      <div className="border border-zinc-800 rounded-xl bg-zinc-950 p-4 space-y-2 mt-4 animate-fadeIn">
                        <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">
                            👀 Sandbox Mail Delivery Preview
                          </span>
                          <button
                            type="button"
                            onClick={() => setSimulatedMailContent(null)}
                            className="text-zinc-500 hover:text-white text-3xs cursor-pointer font-mono"
                          >
                            [Dismiss Preview]
                          </button>
                        </div>
                        <div 
                          className="bg-white rounded-lg p-4 overflow-x-auto text-[13px] border border-zinc-200"
                          dangerouslySetInnerHTML={{ __html: simulatedMailContent }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-zinc-800 pt-6 mt-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
                    <Share2 className="h-5 w-5 text-gold-400" />
                    <span>Portal Customization & Communities</span>
                  </h3>
                  <p className="text-xs text-zinc-500 mt-2">
                    Set up direct community links for visitors and choose the global appearance mode.
                  </p>
                </div>

                <form onSubmit={handleSaveSmtp} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">Facebook Community Link</label>
                      <input
                        type="url"
                        value={smtpSettings.community_facebook || ''}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, community_facebook: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-xs text-white"
                        placeholder="e.g. https://facebook.com/group"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">Twitter / X Community Link</label>
                      <input
                        type="url"
                        value={smtpSettings.community_twitter || ''}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, community_twitter: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-xs text-white"
                        placeholder="e.g. https://twitter.com/profile"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">Telegram Community Link</label>
                      <input
                        type="url"
                        value={smtpSettings.community_telegram || ''}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, community_telegram: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-xs text-white"
                        placeholder="e.g. https://t.me/channel"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">Portal Display Mode</label>
                      <select
                        value={smtpSettings.portal_theme_mode || 'light'}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, portal_theme_mode: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-xs text-white"
                      >
                        <option value="light">🌅 Dynamic Light Mode (Clean SaaS Light default)</option>
                        <option value="dark">🌌 Immense Dark Mode (Blue Pro Dark default)</option>
                        <option value="gold">🏆 Classic Gold Mode (Luxe Dark theme)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">Gemini API Key (AI Generator)</label>
                      <input
                        type="password"
                        value={smtpSettings.gemini_api_key || ''}
                        onChange={(e) => setSmtpSettings({ ...smtpSettings, gemini_api_key: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-xs text-white text-security-disc"
                        placeholder="AI Studio API key (Falls back to default system key if empty)"
                      />
                    </div>
                    <div className="md:col-span-2 border-t border-zinc-900 pt-3">
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">Custom Portal Website Logo (Manually Chosen File)</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={smtpSettings.portal_logo_url || ''}
                          onChange={(e) => setSmtpSettings({ ...smtpSettings, portal_logo_url: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-xs text-white"
                          placeholder="Image URL or compressed logo WebP base64 string"
                        />
                        <label className="bg-zinc-850 hover:bg-zinc-800 text-zinc-300 px-4 py-3 rounded-lg cursor-pointer whitespace-nowrap text-xs font-semibold transition border border-zinc-800">
                          Upload Custom Logo
                          <input type="file" accept="image/*" onChange={handlePortalLogoUpload} className="hidden" />
                        </label>
                      </div>
                      {smtpSettings.portal_logo_url && (
                        <div className="mt-2 text-[10px] text-zinc-500 flex items-center gap-2">
                          <span className="font-bold text-zinc-400">Branded Logo Preview:</span>
                          <div className="bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-900">
                            <img src={smtpSettings.portal_logo_url} alt="Logo Preview" className="h-10 w-auto object-contain max-w-[180px]" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="bg-gold-500 hover:bg-gold-400 text-zinc-950 font-bold py-2.5 px-6 rounded-lg text-xs tracking-wider transition cursor-pointer"
                  >
                    SAVE PORTAL CUSTOMIZATIONS
                  </button>
                </form>
              </div>
            )}

            {/* TAB CONTENT: Registered Subscribers list & notification broadcasts */}
            {activeTab === 'subscribers' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left text-zinc-300">
                
                {/* Send broadcast form */}
                <div className="lg:col-span-2 bg-charcoal-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-2">
                    <Send className="h-5 w-5 text-indigo-400" />
                    <span>Broadcasting Newsletter Engine</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    Shoot premium slot notifications, EasyPaisa update announcements, or secure backup download APK nodes directly to verified recipients.
                  </p>

                  <form onSubmit={handleSendAnnounce} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">Whom to receive</label>
                        <select
                          value={announceForm.targetType}
                          onChange={(e) => setAnnounceForm({ ...announceForm, targetType: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-xs text-white"
                        >
                          <option value="all">Send to ALL Subscribed Users ({subscribers.length})</option>
                          <option value="specific">Send to Single specific testing recipient email address</option>
                        </select>
                      </div>

                      {announceForm.targetType === 'specific' && (
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1 font-sans">Testing Recipient Email</label>
                          <input
                            type="email"
                            required
                            placeholder="tester-example@gmail.com"
                            value={announceForm.toEmail}
                            onChange={(e) => setAnnounceForm({ ...announceForm, toEmail: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-xs text-white"
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">Email Subject Header</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 🎰 Vetted Agent alerts: S9 Slots APK and withdrawal update"
                        value={announceForm.subject}
                        onChange={(e) => setAnnounceForm({ ...announceForm, subject: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-xs text-white uppercase font-sans"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">Email Body Content (HTML formatting fully compliant)</label>
                      <textarea
                        rows={7}
                        required
                        placeholder="<h1>Important update</h1><p>Vetted and verified slots database version updated. Click below...</p>"
                        value={announceForm.messageHtml}
                        onChange={(e) => setAnnounceForm({ ...announceForm, messageHtml: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 outline-none focus:border-gold-500 text-xs text-white font-mono"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={sendingAnnounce}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-6 rounded-lg text-xs uppercase tracking-wider transition cursor-pointer"
                    >
                      {sendingAnnounce ? 'Sending Broadcast Campaign...' : 'DISPATCH EMAIL CAMPAIGN'}
                    </button>
                  </form>
                </div>

                {/* Subscribers list column */}
                <div className="bg-charcoal-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-2">
                    <Users className="h-5 w-5 text-gold-400" />
                    <span>Registered User List</span>
                  </h3>
                  
                  {subscribers.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic">No users subscribed to directory notifications yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                      {subscribers.map((sub, idx) => (
                        <div key={idx} className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 flex justify-between items-center gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-100 truncate">{sub.email}</p>
                            <span className="text-[9px] text-zinc-500 block mt-0.5">
                              Joined: {new Date(sub.subscribedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <button
                            onClick={() => handleRemoveSubscriber(sub.email)}
                            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 p-1.5 rounded-md border border-rose-500/20 text-[9px] font-black cursor-pointer uppercase transition"
                          >
                            DEL
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* TAB CONTENT: User Inquiry message lists */}
            {activeTab === 'messages' && (
              <div className="bg-charcoal-900 border border-zinc-800 rounded-2xl p-6 shadow-xl text-zinc-300 text-left space-y-4">
                <h3 className="text-lg font-black text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
                  <Mail className="h-5 w-5 text-gold-400" />
                  <span>Submitted User Enquiries Inbox</span>
                </h3>
                <p className="text-xs text-zinc-500">
                  Reviews user-submitted complaints, card withdrawal blockages, or application recommendations securely.
                </p>

                {userMessages.length === 0 ? (
                  <div className="text-center p-12 bg-zinc-950 border border-zinc-850 rounded-xl">
                     <p className="text-zinc-[450] text-xs italic">No user support enquiries submitted yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {userMessages.map((msg, idx) => (
                      <div key={idx} className="bg-zinc-950 border border-zinc-850 rounded-xl p-5 space-y-3 relative overflow-hidden text-left shadow-inner">
                        <div className="absolute top-4 right-4 text-[9px] text-zinc-500 font-mono flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(msg.submittedAt).toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-zinc-900 pb-2 pr-16">
                          <div>
                            <span className="text-[10px] font-extrabold text-indigo-400 block uppercase tracking-wider">SENDER</span>
                            <span className="text-xs font-black text-white">{msg.name}</span>
                            <span className="text-zinc-500 text-xs ml-2">({msg.email})</span>
                          </div>
                          <div className="text-left sm:text-right">
                            <span className="text-[10px] font-extrabold text-zinc-500 block uppercase tracking-wider">SUBJECT DECLARED</span>
                            <span className="text-xs font-black text-gold-400">{msg.subject}</span>
                          </div>
                        </div>
                        <div>
                          <span className="text-[9px] font-extrabold text-zinc-500 block uppercase tracking-wider mb-1">ENQUIRY DETAILS</span>
                          <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900 p-3.5 rounded-lg border border-zinc-850/40">
                            {msg.message}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Manage Admins */}
            {activeTab === 'admins' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left text-zinc-300">
                
                {/* Form to insert new allowed admin */}
                <div className="lg:col-span-1 bg-charcoal-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-2">
                    <Plus className="h-5 w-5 text-gold-400" />
                    <span>Authorize Admin</span>
                  </h3>
                  <p className="text-xs text-zinc-500 leading-normal">
                    Register extra administrator emails. Approved emails can access this entire management dashboard securely via Supabase Google Sign-In authentication.
                  </p>

                  <form onSubmit={handleAddAdmin} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-2xs font-extrabold uppercase tracking-widest text-zinc-400">Admin Gmail Address</label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. administrator@gmail.com"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs font-bold text-white placeholder-zinc-500 focus:outline-none focus:border-gold-500"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3 bg-gold-600 hover:bg-gold-500 text-charcoal-950 font-black text-xs rounded-xl uppercase tracking-wider transition duration-150 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Plus className="h-4 w-4 stroke-[3]" />
                      <span>Grant Admin Status</span>
                    </button>
                  </form>
                </div>

                {/* List of active authorized administrators */}
                <div className="lg:col-span-2 bg-charcoal-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="text-lg font-black text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
                    <Users className="h-5 w-5 text-gold-400" />
                    <span>Active Authorized Administrators</span>
                  </h3>
                  <p className="text-xs text-zinc-500">
                    These accounts have full access to edit, delete, generate content via AI, configure SMTP pipelines, and alter Supabase configurations.
                  </p>

                  <div className="space-y-2.5">
                    {adminsList.map((adminEmail, idx) => {
                      const isRoot = idx < 3;
                      return (
                        <div 
                          key={idx} 
                          className="flex justify-between items-center bg-zinc-950 border border-zinc-850 p-4 rounded-xl shadow-inner hover:border-zinc-700 transition"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-base">🛡️</span>
                            <div>
                              <span className="text-xs font-black text-white">{adminEmail}</span>
                              {isRoot && (
                                <span className="ml-2 bg-gold-500/10 text-gold-400 text-[8px] font-black tracking-widest px-2 py-0.5 rounded uppercase border border-gold-500/20">
                                  Root Admin
                                </span>
                              )}
                            </div>
                          </div>
                          {!isRoot && (
                            <button
                              onClick={() => handleRemoveAdmin(adminEmail)}
                              className="text-2xs font-extrabold tracking-wider uppercase text-rose-500 hover:text-rose-450 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/10 px-3 py-1.5 rounded-lg transition cursor-pointer"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* TAB CONTENT: Databases & Cloud Storage Providers */}
            {activeTab === 'database' && (
              <div className="bg-charcoal-900 border border-zinc-800 rounded-2xl p-6 shadow-xl text-zinc-300 text-left space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
                    <Settings className="h-5 w-5 text-gold-400" />
                    <span>Database & Backend Integration Settings</span>
                  </h3>
                  <p className="text-xs text-zinc-500 mt-2">
                    Unified backend database and authentication settings. The Pakalone portal is secured using enterprise-grade Supabase services for secure Postgres storage, contact message directories, and OAuth login workflows.
                  </p>
                </div>

                {/* DB Config Header */}
                <div className="p-5 rounded-xl border text-left transition bg-zinc-950 border-gold-500 shadow-lg shadow-gold-500/5 text-white flex items-start gap-4">
                  <div className="p-3 bg-indigo-600/10 rounded-lg text-indigo-400">
                    <Settings className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold">Supabase PostgreSQL</h4>
                      <span className="text-[10px] bg-gold-400/10 text-gold-400 font-extrabold px-1.5 py-0.5 rounded tracking-wide uppercase border border-gold-500/10">ACTIVE CORE</span>
                    </div>
                    <p className="text-2xs text-zinc-400 leading-normal">
                      Utilize standard SQL database schema, PostgreSQL connection pools, real relational tables for tested slot reviews, and custom connection string overrides.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left explanation card */}
                  <div className="md:col-span-1 bg-zinc-950 border border-zinc-850 p-5 rounded-2xl space-y-3 shadow-inner">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-extrabold text-white tracking-wide uppercase">Connection Status</span>
                    </div>
                    <div className="text-2xs space-y-1.5 font-bold">
                      <div className="flex justify-between items-center py-1 border-b border-zinc-900">
                        <span className="text-zinc-500">PROVIDER</span>
                        <span className="text-indigo-400 uppercase font-extrabold">Supabase Integration</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-zinc-900">
                        <span className="text-zinc-500">LIVE SYNC</span>
                        <span className="text-emerald-400 font-extrabold">ACTIVE DIRECT CONNECT</span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-zinc-500">ENCRYPTION</span>
                        <span className="text-emerald-400">SSL / TLS SECURED</span>
                      </div>
                    </div>
                    <p className="text-2xs text-zinc-500 leading-normal pt-2">
                      💡 Secured database connection dynamically synchronized with PostgreSQL. Admin credentials and transaction lists process in real-time.
                    </p>
                  </div>

                  {/* Right configuration panel */}
                  <div className="md:col-span-2">
                    {dbProvider === 'supabase' ? (
                      <form onSubmit={handleSaveSupabase} className="space-y-5">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <label className="text-2s font-extrabold uppercase tracking-widest text-zinc-400">Supabase Connection URI</label>
                            <span className="text-[10px] text-zinc-500 font-mono font-semibold">Starts with "postgresql://"</span>
                          </div>
                          <textarea
                            required
                            rows={3}
                            placeholder="postgresql://postgres:your-password@db.supabase.co:5432/postgres"
                            value={supabaseUrl}
                            onChange={(e) => setSupabaseUrl(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 text-xs font-mono text-zinc-300 placeholder-zinc-650 focus:outline-none focus:border-gold-500 leading-relaxed font-semibold"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={savingSupabase}
                          className="py-3 px-6 bg-gold-600 hover:bg-gold-500 text-charcoal-950 font-black text-xs rounded-xl uppercase tracking-wider transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {savingSupabase ? (
                            <>
                              <Loader2 className="animate-spin h-4 w-4 text-charcoal-950" />
                              <span>Testing Connection...</span>
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4" />
                              <span>Save & Direct-Connect Supabase</span>
                            </>
                          )}
                        </button>
                        
                        <div className="mt-6 bg-zinc-950/60 border border-zinc-850/40 rounded-xl p-5 space-y-4">
                          <h4 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                            <span className="text-emerald-400">⚡</span>
                            <span>Default Supabase Integration Reference</span>
                          </h4>
                          <p className="text-2xs text-zinc-400 leading-relaxed font-sans">
                            By default, the application code is pre-configured with the following secure PostgreSQL database hosted on Supabase:
                          </p>
                          <div className="bg-zinc-950 font-mono text-2xs p-3.5 rounded-lg border border-zinc-900/80 overflow-x-auto space-y-2 text-zinc-300">
                            <div><strong className="text-emerald-400 font-bold">Default Host DB:</strong> db.xcxiwhxszjprbxypxqsy.supabase.co</div>
                            <div><strong className="text-emerald-400 font-bold">Default Port:</strong> 5432</div>
                            <div><strong className="text-emerald-400 font-bold">Default Database:</strong> postgres</div>
                            <div><strong className="text-emerald-400 font-bold">Default API Client Endpoint:</strong> https://xcxiwhxszjprbxypxqsy.supabase.co</div>
                          </div>
                          <p className="text-[10px] text-zinc-500 leading-relaxed font-sans">
                            This live integration automatically seeds and stores certified slot application reviews, subscriber newsletter lists, and support message directories. Admin status level logic is dynamically verified on these persistent database tables.
                          </p>
                        </div>
                      </form>
                    ) : (
                      <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-6 text-zinc-300 text-left space-y-4">
                        <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wide">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          <span>Supabase PostgreSQL Initialized</span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">
                          Your administrative panel is fully synchronized with Supabase PostgreSQL and OAuth Services. Active tables, administrative auth levels, and direct query mirrors process instantly.
                        </p>
                        <div className="grid grid-cols-2 gap-4 pt-2 text-2xs uppercase tracking-wider font-extrabold text-zinc-500 font-mono">
                          <div className="bg-charcoal-900 border border-zinc-900 rounded-lg p-3 space-y-1">
                            <span className="text-zinc-600">Active Collections</span>
                            <div className="text-amber-500 leading-normal">
                              apps<br/>subscribers<br/>user_messages<br/>admin_settings
                            </div>
                          </div>
                          <div className="bg-charcoal-900 border border-zinc-900 rounded-lg p-3 space-y-1">
                            <span className="text-zinc-600">Client Rules Status</span>
                            <div className="text-emerald-400 leading-normal">
                              Fully Protected<br/>Role Validation<br/>Admin Locks Added
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
