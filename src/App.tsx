import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Download, Search, Star, ShieldCheck, Check, Smartphone, ArrowRight, Sliders,
  Facebook, Send, MessageCircle, ArrowUp, Menu, Flame, Trophy, Award, Moon, Sun, Sparkles
} from 'lucide-react';
import { AppReview } from './types';
import { applyTheme } from './theme';

const FALLBACK_APPS: AppReview[] = [];

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [appsDataset, setAppsDataset] = useState<AppReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<'all' | 'casino' | 'earning' | 'hot'>('all');
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Newsletter subscription states
  const [subEmail, setSubEmail] = useState('');
  const [subStatus, setSubStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [submittingSub, setSubmittingSub] = useState(false);

  // General support inquiry states
  const [msgForm, setMsgForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [msgStatus, setMsgStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [submittingMsg, setSubmittingMsg] = useState(false);

  // Simulated pagination state
  const [currentPage, setCurrentPage] = useState(1);

  // Community links state loaded dynamically
  const [communityLinks, setCommunityLinks] = useState({
    facebook: 'https://facebook.com',
    twitter: 'https://twitter.com',
    telegram: 'https://t.me'
  });
  const [activeThemeId, setActiveThemeId] = useState('saas-light');
  const [showAdminSecret, setShowAdminSecret] = useState(false);
  const [portalLogo, setPortalLogo] = useState('/logo.svg');

  const toggleTheme = () => {
    let nextTheme = 'saas-light';
    if (activeThemeId === 'saas-light') {
      nextTheme = 'saas-dark';
    } else if (activeThemeId === 'saas-dark') {
      nextTheme = 'gold';
    } else {
      nextTheme = 'saas-light';
    }
    setActiveThemeId(nextTheme);
    applyTheme(nextTheme);
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subEmail || !subEmail.includes('@')) {
      setSubStatus({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }
    try {
      setSubmittingSub(true);
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: subEmail })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Subscription failed");
      
      setSubStatus({ type: 'success', message: data.message || "Thank you for subscribing!" });
      setSubEmail('');
    } catch (err: any) {
      setSubStatus({ type: 'error', message: err.message || "Could not register subscription." });
    } finally {
      setSubmittingSub(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgForm.email || !msgForm.message) {
      setMsgStatus({ type: 'error', message: 'Email address and message content are required.' });
      return;
    }
    try {
      setSubmittingMsg(true);
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...msgForm, subject: msgForm.subject || "General inquiry from home listing" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");

      setMsgStatus({ type: 'success', message: data.message || "Message submitted successfully!" });
      setMsgForm({ name: '', email: '', subject: '', message: '' });
    } catch (err: any) {
      setMsgStatus({ type: 'error', message: err.message || "Failed to submit message." });
    } finally {
      setSubmittingMsg(false);
    }
  };

  // Fetch site setting configurations & initial theme representation
  useEffect(() => {
    const fetchSettingsAndTheme = async () => {
      let defaultTheme = 'saas-light';
      try {
        const res = await fetch('/api/public/settings');
        if (res.ok) {
          const data = await res.json();
          // Update social links
          setCommunityLinks({
            facebook: data.community_facebook || 'https://facebook.com',
            twitter: data.community_twitter || 'https://twitter.com',
            telegram: data.community_telegram || 'https://t.me'
          });
          if (data.portal_logo_url) {
            setPortalLogo(data.portal_logo_url);
          } else {
            setPortalLogo('/logo.svg');
          }
          // Update theme if not overridden by local storage user preference
          if (data.portal_theme_mode) {
            defaultTheme = data.portal_theme_mode;
          }
        }
      } catch (err) {
        console.error("Public settings loading failed:", err);
      }

      // Check if user has a custom preference overridden in local storage
      const userPreference = localStorage.getItem('pakalone-theme');
      const themeToLoad = userPreference || defaultTheme;
      setActiveThemeId(themeToLoad);
      applyTheme(themeToLoad);
    };

    fetchSettingsAndTheme();
  }, []);

  // Reset standard homepage headers when returning from direct game detail pages to ensure correct index visibility
  useEffect(() => {
    document.title = "Pakalone - Earning Apps & Games Portal Pakistan";
    
    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) {
      descMeta.setAttribute('content', "Pakalone is the #1 trusted directory for verified earning apps, gaming APKs, and fast payout platforms in Pakistan. Find reliable ways to earn online.");
    }

    const keywordsMeta = document.querySelector('meta[name="keywords"]');
    if (keywordsMeta) {
      keywordsMeta.setAttribute('content', "Pakalone, earning apps in Pakistan, top earning games, PKR withdrawal apps, online earning Pakistan, real money games");
    }
  }, []);

  // Fetch from the database
  useEffect(() => {
    let active = true;
    const loadApps = async () => {
      try {
        const response = await fetch('/api/apps');
        if (!response.ok) throw new Error("Failed response");
        const list = await response.json();
        if (active) {
          if (Array.isArray(list) && list.length > 0) {
            setAppsDataset(list);
          } else {
            setAppsDataset(FALLBACK_APPS);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load apps from database:", err);
        if (active) {
          setAppsDataset(FALLBACK_APPS);
          setLoading(false);
        }
      }
    };
    loadApps();
    return () => {
      active = false;
    };
  }, []);

  // Filter and search
  const filteredApps = useMemo(() => {
    return appsDataset.filter(app => {
      const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (app.tagline && app.tagline.toLowerCase().includes(searchQuery.toLowerCase()));
      
      if (!matchesSearch) return false;

      if (activeCategory === 'hot') {
        const lowerName = app.name.toLowerCase();
        const badge = (app.badge || '').toLowerCase();
        return badge.includes('hot') || badge.includes('trend') || badge.includes('vetted') || badge.includes('top') || badge.includes('recommend') || app.rating >= 4.7;
      } else if (activeCategory === 'casino') {
        const lowerName = app.name.toLowerCase();
        return lowerName.includes('slot') || lowerName.includes('casino') || lowerName.includes('patti') || lowerName.includes('bet') || lowerName.includes('win');
      } else if (activeCategory === 'earning') {
        const lowerName = app.name.toLowerCase();
        return lowerName.includes('game') || lowerName.includes('lucky') || lowerName.includes('rs') || !lowerName.includes('casino');
      }
      return true;
    });
  }, [searchQuery, appsDataset, activeCategory]);

  const ITEMS_PER_PAGE = 6;
  const totalPages = useMemo(() => {
    return Math.ceil(filteredApps.length / ITEMS_PER_PAGE) || 1;
  }, [filteredApps]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const paginatedApps = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredApps.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredApps, currentPage]);

  const topRatedApps = useMemo(() => {
    return [...appsDataset].sort((a, b) => b.rating - a.rating).slice(0, 3);
  }, [appsDataset]);

  const hotGamesList = useMemo(() => {
    return appsDataset.filter(app => {
      const badge = (app.badge || '').toLowerCase();
      return badge.includes('hot') || badge.includes('trend') || badge.includes('vetted') || badge.includes('top') || badge.includes('recommend') || app.rating >= 4.7;
    }).slice(0, 4);
  }, [appsDataset]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[var(--theme-bg)] flex flex-col justify-between font-sans antialiased text-[var(--theme-text-main)] transition-colors duration-300" id="portal-root">
      
      {/* 🇵🇰 Deep Royal Blue Header Block */}
      <div className="bg-gradient-to-r from-[#0d3a8e] to-[#0c4cbd] text-white shadow-xl">
        <header className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Custom Logo or Circular P Emblem with Corona Ring & Shadow */}
            {portalLogo ? (
              <div className="h-12 flex items-center justify-center bg-zinc-950/20 px-2 py-1 rounded-xl border border-white/10 shadow-sm backdrop-blur-3xs">
                <img src={portalLogo} alt="Pakalone Games Logo" className="h-10 w-auto object-contain max-w-[160px]" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 p-[2.5px] shadow-lg flex items-center justify-center select-none flex-shrink-0 animate-pulse">
                <div className="w-full h-full rounded-full bg-[#0a2e75] flex items-center justify-center font-black text-xl text-yellow-300 tracking-tighter shadow-inner">
                  P
                </div>
              </div>
            )}
            <div className="text-left">
              <h1 className="font-display text-xl md:text-2xl font-black text-white tracking-tight uppercase leading-none drop-shadow">
                Pakalone Games
              </h1>
              <p className="text-[10px] font-extrabold text-yellow-300 tracking-wide mt-1 uppercase font-mono">
                Pakistan's Choice Download Hub
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="hidden md:inline-flex items-center gap-1.5 bg-[#082a69] border border-blue-500/30 rounded-full px-3 py-1 text-[11px] font-bold text-yellow-300">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Verified 2026 Stable APKs Only</span>
            </span>
            
            {/* Header Search Bar */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-blue-200">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-28 sm:w-40 md:w-56 rounded-xl bg-[#082a69] border border-blue-500/30 py-1.5 pl-9 pr-3 text-xs font-semibold text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all shadow-inner"
              />
            </div>

            {/* Elegant Dark/Light Mode Loop Trigger */}
            <button
              onClick={toggleTheme}
              className="p-2 bg-[#082a69] border border-blue-500/30 hover:bg-[#0c3989] rounded-xl text-yellow-300 transition duration-150 flex items-center justify-center cursor-pointer"
              title="Toggle theme appearance"
            >
              {activeThemeId === 'saas-light' ? (
                <Moon className="h-4 w-4 text-yellow-300" />
              ) : activeThemeId === 'saas-dark' ? (
                <Sparkles className="h-4 w-4 text-sky-300" />
              ) : (
                <Sun className="h-4 w-4 text-yellow-400" />
              )}
            </button>
          </div>
        </header>
      </div>

      <div className="flex-grow max-w-5xl w-full mx-auto px-3 md:px-5 py-6 space-y-6">
        
        {/* Floating Social Media Links Section */}
        <div className="flex flex-col items-center justify-center gap-3 py-3 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-2xl shadow-sm">
          <span className="text-2xs font-extrabold text-[var(--theme-text-muted)] uppercase tracking-widest font-mono">Join Official Community Nodes</span>
          <div className="flex items-center justify-center gap-4">
            <a 
              href={communityLinks.facebook} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-11 h-11 rounded-full bg-[#1877f2] hover:bg-[#156bec] text-white flex items-center justify-center shadow-md transform hover:scale-110 transition-all duration-200"
            >
              <Facebook className="h-5 w-5" />
            </a>
            <a 
              href={communityLinks.twitter} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-11 h-11 rounded-full bg-slate-900 border border-slate-700/50 hover:bg-slate-950 text-white flex items-center justify-center shadow-md transform hover:scale-110 transition-all duration-200"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a 
              href={communityLinks.telegram} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-11 h-11 rounded-full bg-[#0088cc] hover:bg-[#007cbd] text-white flex items-center justify-center shadow-md transform hover:scale-110 transition-all duration-200"
            >
              <Send className="h-4.5 w-4.5" />
            </a>
          </div>
        </div>

        {/* Categories Tab selector bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 p-1.5 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <button
            onClick={() => { setActiveCategory('all'); setCurrentPage(1); }}
            className={`py-3 px-2 rounded-xl text-xs font-black transition-all font-sans uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer ${
              activeCategory === 'all' 
                ? 'bg-[#0d3a8e] text-white shadow-md' 
                : 'bg-transparent text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Trophy className="h-4 w-4 text-amber-400" />
            <span>All Apps</span>
          </button>
          <button
            onClick={() => { setActiveCategory('hot'); setCurrentPage(1); }}
            className={`py-3 px-2 rounded-xl text-xs font-black transition-all font-sans uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer ${
              activeCategory === 'hot' 
                ? 'bg-orange-500 text-white shadow-md scale-[1.02]' 
                : 'bg-transparent text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Flame className="h-4 w-4 text-red-500 animate-pulse animate-bounce" />
            <span>Hot Games</span>
          </button>
          <button
            onClick={() => { setActiveCategory('casino'); setCurrentPage(1); }}
            className={`py-3 px-2 rounded-xl text-xs font-black transition-all font-sans uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer ${
              activeCategory === 'casino' 
                ? 'bg-[#0d3a8e] text-white shadow-md' 
                : 'bg-transparent text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>Casino</span>
          </button>
          <button
            onClick={() => { setActiveCategory('earning'); setCurrentPage(1); }}
            className={`py-3 px-2 rounded-xl text-xs font-black transition-all font-sans uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer ${
              activeCategory === 'earning' 
                ? 'bg-[#0d3a8e] text-white shadow-md' 
                : 'bg-transparent text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Award className="h-4 w-4 text-emerald-500" />
            <span>Earning</span>
          </button>
        </div>

        {/* App Search Bar */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-slate-400">
            <Search className="h-5 w-5" />
          </span>
          <input
            type="text"
            placeholder="Search verified gaming apps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl bg-white border border-slate-250 py-3.5 pl-12 pr-4 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0d3a8e] transition-all shadow-inner"
          />
        </div>

        {/* Top Rated Apps Carousel Slider Block */}
        {!searchQuery && topRatedApps.length > 0 && (
          <div className="bg-white border border-slate-200.5 p-5 md:p-6 rounded-3xl shadow-xs text-left space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-display text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <span>Top Rated Apps</span>
              </h3>
              <div className="flex gap-1">
                {topRatedApps.map((_, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setCarouselIndex(idx)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${carouselIndex === idx ? 'bg-[#0d3a8e] px-2.5' : 'bg-slate-200'}`}
                  />
                ))}
              </div>
            </div>

            {/* Slider frame */}
            <div className="relative min-h-[110px] overflow-hidden flex items-center">
              {topRatedApps.map((app, idx) => (
                <div 
                  key={app.id}
                  className={`w-full transition-all duration-350 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    carouselIndex === idx ? 'block opacity-100' : 'hidden opacity-0 pointer-events-none'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Golden Coin Icon Frame */}
                    <div className="relative w-16 h-16 bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 rounded-2xl p-[2px] shadow-md flex items-center justify-center flex-shrink-0 select-none">
                      <div className="w-full h-full bg-[#101018] rounded-[13px] flex items-center justify-center overflow-hidden">
                        {app.logo && (app.logo.startsWith('http') || app.logo.startsWith('data:image')) ? (
                          <img src={app.logo} alt={app.name} className="w-full h-full object-cover rounded-[13px]" />
                        ) : (
                          <span className="text-3xl select-none">{app.logo || '🏆'}</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-display font-black text-base text-[#0d3a8e]">{app.name}</h4>
                        <span className="bg-emerald-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-sans uppercase font-black">
                          {app.badge || 'HOT'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-semibold mt-0.5">{app.tagline}</p>
                      
                      <div className="flex items-center gap-1 mt-1.5">
                        <div className="flex items-center text-amber-400">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        </div>
                        <span className="text-[10px] font-extrabold text-slate-800 ml-1">V3.2.1</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link 
                      to={`/game/${app.id}`}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200.5 font-extrabold text-xs rounded-xl transition"
                    >
                      Verify Info
                    </Link>
                    <a 
                      href={app.apkUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 bg-[#0d3a8e] hover:bg-blue-800 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-1 transition"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hot Games Spotlight Grid */}
        {!searchQuery && hotGamesList.length > 0 && (
          <div className="space-y-3.5 text-left animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base md:text-lg font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-tight">
                <span className="text-red-500 animate-pulse text-base">🔥</span>
                <span>Hot Games Selection</span>
              </h3>
              <button 
                onClick={() => { setActiveCategory('hot'); scrollToTop(); }} 
                className="text-xs font-black text-orange-600 hover:text-orange-700 hover:underline transition flex items-center gap-1 cursor-pointer"
              >
                <span>See All Hot</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {hotGamesList.map((app) => (
                <div 
                  key={app.id} 
                  className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between hover:shadow-md transition-all duration-200 relative group text-left overflow-hidden shadow-2xs"
                >
                  {/* Miniature Hot Badge */}
                  <span className="absolute top-2 right-2 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider scale-95 animate-pulse z-10">
                    Hot
                  </span>

                  <div>
                    {/* Compact logo layout */}
                    <div className="w-12 h-12 bg-gradient-to-br from-yellow-300 to-yellow-600 rounded-xl p-[1.5px] shadow-xs select-none mb-3">
                      <div className="w-full h-full bg-[#101018] rounded-[11px] flex items-center justify-center overflow-hidden">
                        {app.logo && (app.logo.startsWith('http') || app.logo.startsWith('data:image')) ? (
                          <img src={app.logo} alt={app.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xl select-none">{app.logo || '🏆'}</span>
                        )}
                      </div>
                    </div>

                    <h4 className="font-display font-black text-sm text-[#0d3a8e] line-clamp-1 mb-0.5">
                      {app.name}
                    </h4>
                    <p className="text-[10px] text-slate-500 leading-tight line-clamp-2 min-h-[30px] mb-3">
                      {app.tagline}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2.5 border-t border-slate-100">
                    <div className="flex items-center justify-between text-2xs font-bold text-slate-600">
                      <span className="flex items-center text-amber-500 gap-0.5">
                        <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                        <span>{app.rating || '4.8'}</span>
                      </span>
                      <span className="text-[9px] font-mono text-slate-400">{app.apkSize || '25 MB'}</span>
                    </div>

                    <Link 
                      to={`/game/${app.id}`}
                      className="w-full py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 font-black text-[10px] rounded-lg text-center block transition uppercase tracking-wider"
                    >
                      Play & Earn
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Latest Apps Section Title */}
        <div className="text-left pb-1 border-b border-slate-250 flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-black text-slate-900 tracking-tight">
              Latest Apps
            </h3>
            <p className="text-2xs text-slate-400 font-bold uppercase tracking-wider">V3.2.1 Updated Repositories</p>
          </div>
          <div className="text-xs font-bold text-slate-500 bg-white border border-slate-200.5 px-3 py-1 rounded-full">
            {filteredApps.length} Apps
          </div>
        </div>

        {/* Directory Card Listings with Diagonal Ribbons & 3D Gold Coins */}
        {loading ? (
          <div className="py-24 text-center bg-white border border-slate-250 rounded-3xl">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0d3a8e] mx-auto"></div>
            <p className="text-slate-500 text-sm mt-4 font-semibold">Aligning mirror host engines...</p>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="py-20 text-center bg-white border border-slate-200 rounded-3xl">
            <p className="text-slate-400 font-bold text-sm">No tested casino/earning apps found in search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {paginatedApps.map((app) => (
              <div 
                key={app.id} 
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden relative group text-left"
                id={`app-card-${app.id}`}
              >
                {/* Diagonal Green corner ribbon banner */}
                <div className="absolute top-0 left-0 overflow-hidden w-20 h-20 pointer-events-none z-10">
                  <div className="absolute top-3 -left-7 bg-[#10b981] text-white text-[8px] font-black tracking-wider py-0.5 w-24 text-center transform -rotate-45 shadow-sm uppercase">
                    {app.badge ? app.badge.split(' ')[0] : 'UPDATED'}
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Visual Gold Bezel framing of logotype */}
                  <div className="flex items-center gap-4">
                    <div className="relative w-18 h-18 bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 rounded-2xl p-[2.5px] shadow-md flex items-center justify-center flex-shrink-0 select-none group-hover:scale-105 transition-transform duration-300">
                      <div className="w-full h-full bg-[#101018] rounded-[13px] flex items-center justify-center overflow-hidden relative">
                        {app.logo && (app.logo.startsWith('http') || app.logo.startsWith('data:image')) ? (
                          <img src={app.logo} alt={app.name} className="w-full h-full object-cover rounded-[13px]" />
                        ) : (
                          <span className="text-3.5xl select-none drop-shadow-sm">{app.logo || '🎰'}</span>
                        )}
                      </div>
                      <div className="absolute inset-0 rounded-2xl border border-white/20 pointer-events-none" />
                    </div>

                    <div className="space-y-1">
                      <h4 className="font-display font-black text-base text-[#0d3a8e] group-hover:text-blue-800 transition-colors">
                        {app.name} Game APK Download
                      </h4>
                      <p className="text-2xs font-extrabold text-yellow-700 font-mono">
                        V3.2.1 • {app.apkSize}
                      </p>
                      
                      {/* Symmetrical golden stars */}
                      <div className="flex items-center">
                        <div className="flex items-center text-amber-400">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        </div>
                        <span className="text-[10px] font-black text-slate-500 ml-1.5">({app.rating})</span>
                      </div>
                    </div>
                  </div>

                  {/* App specification pills */}
                  <div className="grid grid-cols-2 gap-2 text-2xs font-bold font-mono">
                    <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl">
                      <span className="text-[9px] text-slate-400 block uppercase">Min Cashout</span>
                      <span className="text-slate-800 mt-0.5 block font-black">{app.minCashout}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 p-2 rounded-xl">
                      <span className="text-[9px] text-slate-400 block uppercase">Daily Users</span>
                      <span className="text-[#0d3a8e] mt-0.5 block font-black">{app.dailyUsers}</span>
                    </div>
                  </div>

                  {/* Excerpt with Urdu fallback */}
                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    <p className="text-[11px] font-semibold text-slate-500 leading-relaxed italic">
                      "{app.tagline}"
                    </p>
                  </div>
                </div>

                {/* Symmetrical Dual Actions */}
                <div className="p-3.5 bg-slate-50 border-t border-slate-150 flex items-center gap-2">
                  <Link 
                    to={`/game/${app.id}`}
                    className="flex-1 py-2.5 text-center bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-2xs font-extrabold tracking-wider transition uppercase"
                  >
                    Details & Reviews
                  </Link>
                  <a 
                    href={app.apkUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 text-center bg-[#0d3a8e] hover:bg-blue-800 text-white rounded-xl text-2xs font-black tracking-wider transition uppercase shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download APK</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Real dynamic pagination indicator based on active games dataset count */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-4 pb-2" id="pagination-controls">
            <button 
              onClick={() => { if (currentPage > 1) setCurrentPage(currentPage - 1); }}
              disabled={currentPage === 1}
              className={`w-9 h-9 rounded-full bg-[var(--theme-card)] border border-[var(--theme-border)] flex items-center justify-center font-bold text-xs text-[var(--theme-text-main)] transition-all cursor-pointer ${currentPage === 1 ? 'opacity-40 pointer-events-none' : 'hover:bg-[var(--theme-card-hover)]'}`}
              id="prev-page-btn"
            >
              «
            </button>
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pageNum = idx + 1;
              return (
                <button 
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs transition-all cursor-pointer ${
                    currentPage === pageNum 
                      ? 'bg-orange-500 text-white shadow-md transform scale-105' 
                      : 'bg-[var(--theme-card)] border border-[var(--theme-border)] text-[var(--theme-text-muted)] hover:bg-[var(--theme-card-hover)] hover:text-[var(--theme-text-main)]'
                  }`}
                  id={`page-btn-${pageNum}`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button 
              onClick={() => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); }}
              disabled={currentPage === totalPages}
              className={`px-3 h-9 bg-[var(--theme-card)] border border-[var(--theme-border)] rounded-full flex items-center justify-center font-bold text-xs text-[var(--theme-text-main)] transition-all cursor-pointer ${currentPage === totalPages ? 'opacity-40 pointer-events-none' : 'hover:bg-[var(--theme-card-hover)]'}`}
              id="next-page-btn"
            >
              Next »
            </button>
          </div>
        )}

        {/* Corporate overview descriptions and Urdu translations */}
        <div className="bg-white border border-slate-200 p-6 md:p-8 rounded-3xl shadow-xs text-left space-y-4">
          <p className="text-sm text-slate-700 leading-relaxed font-semibold">
            <span className="font-bold text-[#0d3a8e]">pakalone.online</span> is Pakistan's trusted source for the latest casino and earning APK downloads. We provide safe links, app updates, detailed guides, and honest reviews.
          </p>
          <div className="border-t border-slate-100 pt-4 text-right space-y-2">
            <p className="text-sm font-semibold leading-relaxed font-sans text-slate-700" dir="rtl">
              پاکالون گیمز پر آپ کو پاکستان کے تمام معتبر اور تازہ ترین سلاٹس اور گیمنگ ایپلی کیشنز کے ڈاؤن لوڈ لنک ملیں گے جو ہم نے خود ٹیسٹ کیے ہیں۔ ہم صارف کی معلومات کی حفاظت اور آسان ود ڈرا کی ضرورت کو ترجیح دیتے ہیں۔
            </p>
          </div>
        </div>

        {/* Join Notification Alert + Contact Support Ticket */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Join Notification Box */}
          <div className="bg-gradient-to-br from-[#0c2f70] to-[#04122d] text-white rounded-3xl p-6.5 text-left space-y-4 shadow-md border border-blue-900/30">
            <h4 className="font-display font-black text-base flex items-center gap-2 text-yellow-300">
              <span>📡</span>
              <span>APK Version Alerts</span>
            </h4>
            <p className="text-xs text-indigo-150 leading-relaxed font-medium">
              Subscribe with your email to receive immediate notifications about new payout channels, APK mirrors, and exclusive promo nodes.
            </p>
            
            <form onSubmit={handleSubscribe} className="space-y-3">
              <input
                type="email"
                required
                placeholder="Enter your active email..."
                value={subEmail}
                onChange={(e) => setSubEmail(e.target.value)}
                className="w-full bg-white/10 border border-white/15 rounded-xl p-3 text-xs font-bold text-white placeholder-white/35 focus:outline-none focus:ring-2 focus:ring-[#0d3a8e] transition"
              />
              <button
                type="submit"
                disabled={submittingSub}
                className="w-full py-3 bg-yellow-400 hover:bg-yellow-500 disabled:bg-yellow-600 text-[#0c2f70] font-black text-xs rounded-xl uppercase tracking-wider transition cursor-pointer"
              >
                {submittingSub ? "Registering..." : "Get Version Alerts"}
              </button>
            </form>

            {subStatus.type && (
              <div className={`p-3 rounded-xl text-2xs font-extrabold border ${
                subStatus.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/20 border-rose-500/30 text-rose-300'
              }`}>
                {subStatus.message}
              </div>
            )}
          </div>

          {/* Quick Support Ticket */}
          <div className="bg-white border border-slate-205 rounded-3xl p-6.5 text-left space-y-3 shadow-xs">
            <h4 className="font-display font-black text-base text-slate-800 flex items-center gap-2">
              <span>📬</span>
              <span>Report Withdrawal Issues</span>
            </h4>
            <p className="text-2xs text-slate-500 font-bold">
              Facing EasyPaisa/JazzCash payout congestion or mirror blocking? File an agency support ticket and we will verify!
            </p>

            <form onSubmit={handleSendMessage} className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Your Name"
                  value={msgForm.name}
                  onChange={(e) => setMsgForm({ ...msgForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200.5 rounded-xl p-2.5 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0d3a8e] transition"
                />
                <input
                  type="email"
                  required
                  placeholder="Email Address"
                  value={msgForm.email}
                  onChange={(e) => setMsgForm({ ...msgForm, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200.5 rounded-xl p-2.5 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0d3a8e] transition"
                />
              </div>
              <input
                type="text"
                placeholder="Inquiry Subject"
                value={msgForm.subject}
                onChange={(e) => setMsgForm({ ...msgForm, subject: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200.5 rounded-xl p-2.5 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0d3a8e] transition"
              />
              <textarea
                rows={2}
                required
                placeholder="Describe your issue..."
                value={msgForm.message}
                onChange={(e) => setMsgForm({ ...msgForm, message: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200.5 rounded-xl p-2.5 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0d3a8e] transition align-top font-sans"
              />
              <button
                type="submit"
                disabled={submittingMsg}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                {submittingMsg ? "Submitting Inquiry..." : "Submit Support Ticket"}
              </button>
            </form>

            {msgStatus.type && (
              <div className={`p-3 rounded-xl text-2xs font-extrabold border ${
                msgStatus.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'
              }`}>
                {msgStatus.message}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 🌑 Steel Gray Footer with standard legal indices */}
      <footer className="bg-[#12161f] text-slate-400 border-t border-slate-850 py-10 text-center text-xs font-medium relative mt-12">
        <div className="max-w-5xl mx-auto px-4 space-y-6">
          
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4.5 pb-6 border-b border-slate-800">
            <p 
              className="text-slate-350 text-[11px] font-bold select-none cursor-pointer hover:text-white transition-colors"
              onDoubleClick={() => setShowAdminSecret(prev => !prev)}
              title="Double click copyright to toggle utility links"
            >
              © 2026 Pakalone Games. All Rights Reserved. Not affiliated with Google or playstore systems.
            </p>
            
            <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-bold text-slate-400">
              <span className="hover:text-white transition-colors cursor-pointer">Privacy Policy</span>
              <span>•</span>
              <span className="hover:text-white transition-colors cursor-pointer">Disclaimer</span>
              <span>•</span>
              <span className="hover:text-white transition-colors cursor-pointer">About Us</span>
              <span>•</span>
              <span className="hover:text-white transition-colors cursor-pointer">Contact Us</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-slate-500 leading-relaxed text-left font-sans">
            <p className="max-w-xl">
              Disclaimer: The games listed on this platform correspond to third-party digital entertainment software. Earning apps are subject to financial volatility. Users should act according to local juridical boundaries. We prioritize safe testing of mirrors.
            </p>
            
            {/* Custom Admin Console Trigger Link */}
            {showAdminSecret && (
              <Link 
                to="/admin" 
                className="inline-flex items-center gap-1 bg-[#1c2230] hover:bg-[#252c3e] text-amber-300 rounded-lg px-3 py-1.5 font-bold shadow-xs transition animate-pulse"
                id="admin-test-trigger"
              >
                <Sliders className="h-3.5 w-3.5 text-amber-400" />
                <span>Admin Dashboard</span>
              </Link>
            )}
          </div>

          {/* Smooth return to top scrolling node */}
          <button 
            onClick={scrollToTop}
            className="absolute right-4 md:right-8 -top-5 w-10 h-10 rounded-full bg-[#1da1f2] hover:bg-[#0d95e8] text-white flex items-center justify-center shadow-lg transition-transform hover:-translate-y-1 cursor-pointer focus:outline-none"
            title="Return to top"
          >
            <ArrowUp className="h-4.5 w-4.5" />
          </button>
        </div>
      </footer>

    </div>
  );
}
