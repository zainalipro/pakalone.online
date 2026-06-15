import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, Download, Star, ShieldCheck, Check, Smartphone, Sparkles, Mail, Send, AlertCircle, Moon, Sun
} from 'lucide-react';
import { AppReview } from './types';
import { applyTheme } from './theme';

const FALLBACK_APPS: AppReview[] = [];

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [app, setApp] = useState<AppReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeThemeId, setActiveThemeId] = useState('saas-light');

  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [newAuthorName, setNewAuthorName] = useState('');
  const [newComment, setNewComment] = useState('');
  const [newRating, setNewRating] = useState(5);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  const fetchReviews = async () => {
    try {
      setReviewsLoading(true);
      const res = await fetch(`/api/apps/${id}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch user reviews:", err);
    } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchReviews();
    }
  }, [id]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuthorName.trim() || !newComment.trim()) {
      setReviewStatus({ type: 'error', message: 'Name and comment description are required!' });
      return;
    }
    try {
      setSubmittingReview(true);
      setReviewStatus({ type: null, message: '' });
      const res = await fetch(`/api/apps/${id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: newAuthorName,
          rating: newRating,
          comment: newComment
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish review');
      
      setReviewStatus({ type: 'success', message: 'Thank you! Your verified review has been published.' });
      setNewAuthorName('');
      setNewComment('');
      setNewRating(5);
      fetchReviews(); // Refresh review list
    } catch (err: any) {
      setReviewStatus({ type: 'error', message: err.message || 'Error occurred while saving your review.' });
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderStars = (count: number, interactive = false, onSelect?: (r: number) => void) => {
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const starVal = i + 1;
          const isActive = starVal <= count;
          return (
            <Star 
              key={i} 
              onClick={() => interactive && onSelect && onSelect(starVal)}
              className={`h-4.5 w-4.5 ${
                isActive 
                  ? 'fill-yellow-500 text-yellow-500' 
                  : 'text-slate-300 dark:text-zinc-700'
              } ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`} 
            />
          );
        })}
      </div>
    );
  };

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

  // Fetch site setting configurations & initial theme representation
  useEffect(() => {
    const fetchSettingsAndTheme = async () => {
      let defaultTheme = 'saas-light';
      try {
        const res = await fetch('/api/public/settings');
        if (res.ok) {
          const data = await res.json();
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

  // Newsletter Subscribe inputs
  const [subEmail, setSubEmail] = useState('');
  const [subStatus, setSubStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [submittingSub, setSubmittingSub] = useState(false);

  // Message Contact Query inputs
  const [msgForm, setMsgForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [msgStatus, setMsgStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [submittingMsg, setSubmittingMsg] = useState(false);

  // Fetch individual game details
  useEffect(() => {
    const fetchGame = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/apps/${id}`);
        if (!response.ok) throw new Error("Game not found in repository");
        const data = await response.json();
        setApp(data);
      } catch (err) {
        console.warn("API game lookup failed, testing fallback configs:", err);
        const fallback = FALLBACK_APPS.find(a => a.id === id);
        if (fallback) {
          setApp(fallback);
        } else {
          setApp(null);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchGame();
    window.scrollTo(0, 0);
  }, [id]);

  // Synchronous client-side document title updates for seamless browser routing SEO
  useEffect(() => {
    if (app) {
      const badgeWord = app.badge ? app.badge.toUpperCase() : 'VERIFIED';
      document.title = `${app.name} APK Download {${badgeWord}} - Real Money Earning Portal Pakistan 2026`;
      
      // Update browser meta-description elements dynamically
      const descMeta = document.querySelector('meta[name="description"]');
      if (descMeta) {
        descMeta.setAttribute('content', `Download ${app.name} APK (${app.apkSize || 'Latest Version'}) for Androids. ${app.tagline || 'Popular instant checkout earning game in Pakistan.'} Cashout your real-money earnings instantly via ${app.methods?.join(', ') || 'Easypaisa, JazzCash'}. Rated ${app.rating}/5.`);
      }

      // Update browser keywords dynamically
      const keywordsMeta = document.querySelector('meta[name="keywords"]');
      if (keywordsMeta) {
        keywordsMeta.setAttribute('content', `${app.name}, ${app.name} APK download, ${app.name} real money app, online earning in Pakistan, easy earning games 2026, JazzCash, Easypaisa, pakalone`);
      }
    } else {
      document.title = "Pakalone - Earning Apps & Games Portal Pakistan";
    }
  }, [app]);

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
        body: JSON.stringify({
          ...msgForm,
          subject: msgForm.subject || `Inquiry about ${app?.name || 'Pakalone Games'}`
        })
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="text-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-slate-600 font-bold mt-4">Loading direct verified mirror node...</p>
        </div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans antialiased">
        <div className="max-w-xl mx-auto px-6 py-20 text-center space-y-6">
          <div className="text-6xl">⚠️</div>
          <h2 className="text-2xl font-black text-blue-950">App Not Found</h2>
          <p className="text-slate-600">The specified tested application is not registered under our verification database.</p>
          <Link to="/" className="inline-flex items-center gap-2 bg-blue-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-blue-700 transition">
            <ArrowLeft className="h-5 w-5" />
            <span>Return to Directory</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--theme-bg)] flex flex-col justify-between font-sans antialiased text-[var(--theme-text-main)] transition-colors duration-300" id="game-detail-root">
      
      {/* Top Navigation Row */}
      <div className="bg-[var(--theme-header-bg)] border-b border-[var(--theme-border)] shadow-sm sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 flex justify-between items-center">
          <Link to="/" className="inline-flex items-center gap-2 text-[var(--theme-text-muted)] hover:text-amber-500 font-bold transition text-sm">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to All Games</span>
          </Link>
          <div className="flex items-center gap-3">
            {/* Elegant Dark/Light Mode Loop Trigger */}
            <button
              onClick={toggleTheme}
              className="p-1.5 bg-[var(--theme-card)] border border-[var(--theme-border)] hover:bg-[var(--theme-card-hover)] rounded-xl text-yellow-500 transition duration-150 flex items-center justify-center cursor-pointer"
              title="Toggle theme appearance"
            >
              {activeThemeId === 'saas-light' ? (
                <Moon className="h-4 w-4 text-slate-700" />
              ) : activeThemeId === 'saas-dark' ? (
                <Sparkles className="h-4 w-4 text-blue-300" />
              ) : (
                <Sun className="h-4 w-4 text-amber-500" />
              )}
            </button>

            <div className="flex items-center gap-1.5 bg-[#082a69] border border-blue-500/30 rounded-full px-2.5 py-1 text-[11px] font-bold text-yellow-300">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
              <span className="hidden sm:inline">VERIFIED DIRECT HOST NODE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 md:px-6 py-8 space-y-8">
        
        {/* Game Title Card */}
        <div className="bg-white border border-blue-100 rounded-3xl p-6 md:p-8 shadow-sm text-left relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          {app.badge && (
            <span className="absolute top-0 right-0 bg-blue-600 text-white font-mono text-[9px] font-black tracking-widest px-4 py-1.5 rounded-bl-2xl uppercase">
              {app.badge}
            </span>
          )}

          <div className="flex items-center gap-5">
            <div className="w-20 h-20 text-5xl bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100 shadow-inner flex-shrink-0 select-none">
              {app.logo && (app.logo.startsWith('http') || app.logo.startsWith('data:image')) ? (
                <img src={app.logo} alt={app.name} className="w-full h-full object-contain p-1" />
              ) : (
                app.logo || '🎮'
              )}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-display font-black text-2xl md:text-3xl text-blue-900 tracking-tight">
                  {app.name}
                </h1>
              </div>
              <p className="text-sm font-semibold text-blue-600 mt-1">{app.tagline}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="flex items-center gap-1 bg-yellow-50 text-yellow-800 px-2 py-0.5 rounded-lg border border-yellow-100 text-xs font-bold">
                  <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                  {app.rating}
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-xs font-bold text-slate-500">{app.downloads} Active Downloads</span>
              </div>
            </div>
          </div>

          <div className="w-full md:w-auto">
            <a 
              href={app.apkUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-base py-3.5 px-8 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer"
            >
              <Download className="h-5 w-5" />
              <span>Download Official APK</span>
            </a>
          </div>
        </div>

        {/* Detailed Game Specifications Table */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-blue-100 p-4 rounded-2xl text-center shadow-sm">
            <span className="text-2xs font-extrabold text-slate-400 uppercase tracking-widest block">APK SIZE</span>
            <span className="text-lg font-black text-blue-950 mt-1 block">{app.apkSize}</span>
          </div>
          <div className="bg-white border border-blue-100 p-4 rounded-2xl text-center shadow-sm">
            <span className="text-2xs font-extrabold text-slate-400 uppercase tracking-widest block">MINIMUM CASHOUT</span>
            <span className="text-lg font-black text-emerald-700 mt-1 block">{app.minCashout}</span>
          </div>
          <div className="bg-white border border-blue-100 p-4 rounded-2xl text-center shadow-sm">
            <span className="text-2xs font-extrabold text-slate-400 uppercase tracking-widest block">DAILY USERS</span>
            <span className="text-lg font-black text-blue-950 mt-1 block">{app.dailyUsers}</span>
          </div>
          <div className="bg-white border border-blue-100 p-4 rounded-2xl text-center shadow-sm">
            <span className="text-2xs font-extrabold text-slate-400 uppercase tracking-widest block">CASHOUT CHANNELS</span>
            <span className="text-xs font-black text-blue-700 mt-1.5 block leading-tight">{app.methods.join(', ')}</span>
          </div>
        </div>

        {/* Main Review Grid Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Detailed Review Left column */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Written Review Cards */}
            <div className="bg-white border border-blue-100 rounded-3xl p-6 md:p-8 shadow-sm space-y-6 text-left">
              <h3 className="font-display font-black text-xl text-blue-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <span>Expert Vetting Review</span>
              </h3>

              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-black text-blue-600 uppercase tracking-wider mb-1">Detailed Technical Overview</h4>
                  <p className="text-[15px] text-slate-700 leading-relaxed font-semibold">
                    {app.detailedReview}
                  </p>
                </div>

                <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100/50 text-right space-y-2 mt-4">
                  <h4 className="text-xs font-extrabold text-blue-800 uppercase tracking-wider block">ایپلی کیشن کی تفصیلات اور تکنیکی جائزہ</h4>
                  <p className="text-base font-medium leading-relaxed font-sans text-slate-800" dir="rtl">
                    {app.detailedReviewUrdu}
                  </p>
                </div>
              </div>
            </div>

            {/* Pros and Cons Checklist */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm text-left">
                <h4 className="font-display font-bold text-emerald-800 mb-3 flex items-center gap-2">
                  <Check className="h-5 w-5 text-emerald-600" />
                  <span>Verified Strengths</span>
                </h4>
                <ul className="space-y-2.5">
                  {app.pros.map((p, i) => (
                    <li key={i} className="flex gap-2 text-xs font-bold text-slate-700">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm text-left">
                <h4 className="font-display font-bold text-rose-800 mb-3 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-rose-500" />
                  <span>Important Drawbacks</span>
                </h4>
                <ul className="space-y-2.5">
                  {app.cons.map((c, i) => (
                    <li key={i} className="flex gap-2 text-xs font-bold text-slate-700">
                      <span className="text-rose-500 font-bold">•</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Media previews block */}
            {(app.videoUrl || (app.previewImages && app.previewImages.length > 0)) && (
              <div className="bg-white border border-blue-100 rounded-3xl p-6 md:p-8 shadow-sm space-y-5 text-left">
                <h3 className="font-display font-black text-xl text-blue-900 border-b border-slate-100 pb-3">
                  Gameplay Visual Gallery
                </h3>

                {/* Youtube or Custom video embed */}
                {app.videoUrl && (
                  <div className="rounded-2xl overflow-hidden bg-slate-900 border border-slate-200/60 shadow-sm aspect-video w-full relative">
                    {app.videoUrl.includes('youtube.com') || app.videoUrl.includes('youtu.be') || app.videoUrl.includes('embed') ? (
                      <iframe
                        src={app.videoUrl.includes('embed') ? app.videoUrl : `https://www.youtube.com/embed/${app.videoUrl.split('v=')[1]?.split('&')[0] || app.videoUrl.split('/').pop()}`}
                        title={`${app.name} Gameplay Trailer`}
                        className="w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      ></iframe>
                    ) : (
                      <video
                        src={app.videoUrl}
                        controls
                        className="w-full h-full object-contain"
                        preload="metadata"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                )}

                {/* Custom list slider of preview image urls */}
                {app.previewImages && app.previewImages.length > 0 && (
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin snap-x touch-pan-x">
                    {app.previewImages.map((imgUrl, idx) => (
                      <div 
                        key={idx} 
                        className="flex-shrink-0 w-48 h-32 bg-slate-100 rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm hover:scale-[1.02] transition-all duration-200 snap-start"
                      >
                        <img 
                          src={imgUrl} 
                          alt={`${app.name} Preview ${idx + 1}`} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            const parent = target.parentElement;
                            if (parent) {
                              const text = document.createElement('div');
                              text.className = "flex items-center justify-center h-full text-xs font-black text-blue-600 p-2 text-center bg-blue-50";
                              text.innerText = "Game Screen capture";
                              parent.appendChild(text);
                            }
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Dynamic Community User Reviews Section */}
            <div className="bg-white border border-blue-100 rounded-3xl p-6 md:p-8 shadow-sm space-y-6 text-left" id="user-reviews-section">
              <h3 className="font-display font-black text-xl text-blue-900 border-b border-slate-100 pb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  <span>Verified User Reviews</span>
                </span>
                <span className="text-xs bg-blue-50 text-blue-800 px-3 py-1 rounded-full font-bold">
                  {reviews.length} Feedbacks
                </span>
              </h3>

              {/* Submit Review Form */}
              <div className="bg-slate-50 border border-slate-150 p-6 rounded-2xl space-y-4">
                <h4 className="text-xs font-black text-blue-700 uppercase tracking-widest flex items-center gap-1">
                  <span>🎰 Write a Public Review</span>
                </h4>
                <p className="text-2xs font-semibold text-slate-500 leading-normal">
                  Your feedback is verified and saved onto the active live database (Supabase/Firebase) automatically. Share your payout success or feedback on withdrawal speeds.
                </p>

                <form onSubmit={handleSubmitReview} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans text-left">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 font-mono">Your Pen Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Ali Shah, EarningPro"
                        value={newAuthorName}
                        onChange={(e) => setNewAuthorName(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-left"
                        id="review-author-input"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 font-mono font-sans text-left">My Rating Score</label>
                      <div className="h-[42px] px-3 bg-white border border-slate-200 rounded-xl flex items-center gap-2">
                        {renderStars(newRating, true, setNewRating)}
                        <span className="text-xs font-black text-slate-600 font-mono">({newRating}/5)</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-1 font-mono font-sans text-left">Your Review and Payout Experience</label>
                    <textarea
                      required
                      placeholder="Share detailed experience regarding game updates, withdrawal processes step-by-step, or cashout channels (JazzCash, Easypaisa)..."
                      rows={3}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-sans text-left"
                      id="review-comment-textarea"
                    />
                  </div>

                  <div className="flex justify-between items-center gap-4">
                    {reviewStatus.type && (
                      <span className={`text-2xs font-extrabold px-3 py-1.5 rounded-lg border leading-tight ${
                        reviewStatus.type === 'success' 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700' 
                          : 'bg-rose-500/10 border-rose-500/20 text-rose-700'
                      }`} id="review-response-msg">
                        {reviewStatus.message}
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="ml-auto bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black text-xs px-6 py-2.5 rounded-xl uppercase tracking-wider shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                      id="submit-review-btn"
                    >
                      {submittingReview ? 'Registering...' : 'Publish Live Review'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Reviews List */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest font-mono">Public Feedbacks</h4>
                
                {reviewsLoading ? (
                  <div className="text-center py-6 text-slate-400 text-xs">
                    <div className="animate-pulse">Loading live reviews feed...</div>
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-2xl text-slate-400 text-xs font-bold font-mono">
                    No community reviews published yet. Be the first to share your experience!
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin">
                    {reviews.map((r) => {
                      const firstChar = r.authorName ? r.authorName.charAt(0).toUpperCase() : '👤';
                      const formattedDate = new Date(r.submittedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      });
                      return (
                        <div key={r.id} className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl flex gap-4 text-left transition hover:bg-white hover:shadow-xs">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 text-sm font-black flex items-center justify-center flex-shrink-0 select-none font-sans">
                            {firstChar}
                          </div>
                          <div className="flex-1 space-y-1.5 font-sans">
                            <div className="flex justify-between items-start gap-4 flex-wrap">
                              <div>
                                <span className="text-xs font-black text-slate-800">{r.authorName}</span>
                                <span className="text-slate-350 mx-1.5 text-2xs font-mono">•</span>
                                <span className="text-[10px] font-black text-slate-400 font-mono uppercase">{formattedDate}</span>
                              </div>
                              <div>
                                {renderStars(r.rating)}
                              </div>
                            </div>
                            <p className="text-xs font-bold text-slate-650 leading-relaxed font-sans">{r.comment}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Side column: Subscribe list & Direct Contact messaging channel */}
          <div className="space-y-8">
            
            {/* Smart Email Newsletter channel */}
            <div className="bg-gradient-to-br from-blue-900 to-indigo-950 text-white rounded-3xl p-6 md:p-8 shadow-md text-left space-y-5">
              <div className="flex items-center gap-3">
                <span className="text-3xl">📡</span>
                <div>
                  <h4 className="font-display font-bold text-lg">Instant updates</h4>
                  <p className="text-2xs font-bold text-blue-300 font-mono uppercase tracking-wider">PAKALONE NOTIFICATIONS</p>
                </div>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                Provide your email address to receive direct mobile notifications, coupon promotions, and direct APK mirrors whenever a payout channel modifies its multiplier!
              </p>

              <form onSubmit={handleSubscribe} className="space-y-3">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="Enter your active email..."
                    value={subEmail}
                    onChange={(e) => setSubEmail(e.target.value)}
                    className="w-full rounded-xl bg-white/10 border border-white/20 pl-10 pr-4 py-2.5 text-xs font-bold text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submittingSub}
                  className="w-full py-2.5 px-4 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-700 text-white text-xs font-black rounded-xl uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {submittingSub ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <span>SUBSCRIBE NOW</span>
                      <Send className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </form>

              {subStatus.type && (
                <div className={`p-3 rounded-lg text-2xs font-extrabold border ${
                  subStatus.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-200' : 'bg-rose-500/20 border-rose-500/30 text-rose-200'
                }`}>
                  {subStatus.message}
                </div>
              )}
            </div>

            {/* Direct Query messaging Form */}
            <div className="bg-white border border-blue-100 rounded-3xl p-6 shadow-sm text-left space-y-4">
              <h4 className="font-display font-medium text-blue-900 border-b border-slate-100 pb-2 flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-600" />
                <span>Quick Agent Support</span>
              </h4>
              <p className="text-2xs text-slate-500 font-bold leading-normal">
                Facing withdrawal blockages or verification delays for high payouts (&gt;25K)? File a query below, our agent will store and verify directly.
              </p>

              <form onSubmit={handleSendMessage} className="space-y-3">
                <div>
                  <input
                    type="text"
                    placeholder="Your Name (Urgent)"
                    value={msgForm.name}
                    onChange={(e) => setMsgForm({ ...msgForm, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <input
                    type="email"
                    required
                    placeholder="Active Email Address"
                    value={msgForm.email}
                    onChange={(e) => setMsgForm({ ...msgForm, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Subject (e.g. EasyPaisa Payout delay)"
                    value={msgForm.subject}
                    onChange={(e) => setMsgForm({ ...msgForm, subject: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
                <div>
                  <textarea
                    rows={3}
                    required
                    placeholder="Your message details..."
                    value={msgForm.message}
                    onChange={(e) => setMsgForm({ ...msgForm, message: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-all align-top font-sans"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingMsg}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-700 text-white font-extrabold text-xs rounded-xl shadow-sm hover:shadow transition"
                >
                  {submittingMsg ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div>
                  ) : (
                    "SUBMIT SECURE ENQUIRY"
                  )}
                </button>
              </form>

              {msgStatus.type && (
                <div className={`p-3 rounded-lg text-2xs font-extrabold text-left border ${
                  msgStatus.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'
                }`}>
                  {msgStatus.message}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* Footer back to app index */}
      <footer className="bg-white border-t border-slate-100 py-8 text-center text-xs text-slate-500 font-medium">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>© 2026 Pakalone Games. All Rights Vetted and Verified.</p>
        </div>
      </footer>

    </div>
  );
}
