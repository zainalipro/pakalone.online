import express from "express";
import path from "path";
import cors from "cors";
import fs from "fs";
import dns from "dns";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import nodemailer from "nodemailer";

// Force Node.js to prioritize IPv4 resolving to prevent ECONNREFUSED on environments with disabled IPv6 outbound routing
try {
  if (typeof dns.setDefaultResultOrder === "function") {
    dns.setDefaultResultOrder("ipv4first");
  }
} catch (err) {
  // Silent fallback
}
import { 
  initDb, fetchAllApps, findAppById, saveAppReview, removeAppReview,
  fetchAdminSettings, saveAdminSettings, addSubscriber, fetchSubscribers,
  removeSubscriber, submitUserMessage, fetchUserMessages,
  getLocalAdmins, saveLocalAdmins, loadSupabaseConfig, updateDatabasePool, getUseMemoryDb,
  getActiveDbProvider, saveActiveDbProvider, fetchUserReviewsForApp, submitUserReview
} from "./db";

// Helper to extract Cloudflare & reverse proxy client request features correctly
function getClientRequestDetails(req: any) {
  // Cloudflare forwards client IP in cf-connecting-ip
  let ip = req.headers['cf-connecting-ip'] || req.headers['x-real-ip'];
  
  if (!ip && req.headers['x-forwarded-for']) {
    const parts = (req.headers['x-forwarded-for'] as string).split(',');
    ip = parts[0].trim();
  }
  
  if (!ip) {
    ip = req.ip || req.socket.remoteAddress || "127.0.0.1";
  }

  // Handle IPv6 loopback locally
  if (ip === "::1" || ip === "::ffff:127.0.0.1") {
    ip = "127.0.0.1";
  }

  // Clean trailing ports and multiple comma values
  if (typeof ip === 'string') {
    ip = ip.split(',')[0].trim();
    if (ip.includes(':') && ip.includes('.')) {
      // IPv4 mapped/with port e.g. 1.2.3.4:3000
      ip = ip.split(':')[0];
    }
  }

  // Cloudflare forwards country code in cf-ipcountry
  const country = (req.headers['cf-ipcountry'] as string) || "PK"; // Default to PK (Pakistan) for typical portal base audience
  
  return { ip, country };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Let Express trust proxies like Cloudflare and Railway
  app.set("trust proxy", true);

  app.use(express.json({ limit: "10mb" }));
  app.use(cors());

  await initDb();

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // API constraints for SEO content generation
  app.post("/api/gemini/seo-content", async (req, res) => {
    try {
      const { gameName, gameDescription } = req.body;

      if (!gameName) {
         res.status(400).json({ error: "Game name is required." });
         return;
      }

      const settings = await fetchAdminSettings();
      const customApiKey = settings.gemini_api_key;
      const activeAi = new GoogleGenAI({
        apiKey: customApiKey || process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `As an SEO expert and reviewer for 'Pakalone' Pakistani Game & App portal, prepare the following for the app "${gameName}":
${gameDescription ? `Context about the game: ${gameDescription}` : ''}
1. SEO Friendly Title
2. SEO Meta Description
3. 5 SEO Keywords (tags)
4. A short promotional newsletter email to send to the users (in a friendly, engaging tone).
5. A complete draft review object containing an icon emoji, realistic download count (e.g., 100K+ or 500K+), rating (4.5 to 4.9), estimated APK size (e.g., 34 MB), typical minimum cashout (e.g., Rs. 100 or Rs. 200), withdrawal methods list, tagline, professional detailed review in English, persuasive review in fine Urdu script for Pakistani audiences, realistic pros and cons lists, highlight badge (e.g., HOT, TRUSTED, VERIFIED), and estimated daily active players count. Ensure all estimates suit typical lightweight Pakistani mobile space conditions.`;

      const schema = {
        type: Type.OBJECT,
        properties: {
          seoTitle: { type: Type.STRING },
          seoDescription: { type: Type.STRING },
          seoKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
          promotionalEmail: { type: Type.STRING },
          draft: {
            type: Type.OBJECT,
            properties: {
              logo: { type: Type.STRING, description: "A high-quality single emoji matching the app's category (e.g. 🎲, 🎰, 💎, 💸, 🎯)" },
              rating: { type: Type.NUMBER, description: "Numeric rating e.g. 4.7" },
              downloads: { type: Type.STRING, description: "E.g. 100K+ or 500K+" },
              apkSize: { type: Type.STRING, description: "E.g. 24 MB" },
              minCashout: { type: Type.STRING, description: "Minimum cashout limit in Rupees e.g. Rs. 100" },
              methods: { type: Type.ARRAY, items: { type: Type.STRING }, description: "E.g. ['EasyPaisa', 'JazzCash']" },
              tagline: { type: Type.STRING, description: "Catchy short english tagline" },
              detailedReview: { type: Type.STRING, description: "Polished multi-paragraph English review detailing game features and safety rules." },
              detailedReviewUrdu: { type: Type.STRING, description: "High-quality review written entirely in exquisite Urdu text for Pakistani users." },
              pros: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 prominent highlights of the app" },
              cons: { type: Type.ARRAY, items: { type: Type.STRING }, description: "2 physical drawbacks of the app" },
              badge: { type: Type.STRING, description: "A highlight word like HOT, TRUSTED, VERIFIED, NEW" },
              dailyUsers: { type: Type.STRING, description: "Estimated active players, e.g. 10,000+" }
            },
            required: ["logo", "rating", "downloads", "apkSize", "minCashout", "methods", "tagline", "detailedReview", "detailedReviewUrdu", "pros", "cons", "badge", "dailyUsers"]
          }
        },
        required: ["seoTitle", "seoDescription", "seoKeywords", "promotionalEmail", "draft"]
      };

      let response;
      let textOutput = "";
      
      try {
        console.log("Attempting generation using gemini-3.5-flash...");
        response = await activeAi.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: schema
          }
        });
        textOutput = response.text || "";
      } catch (err35) {
        console.warn("⚠️ gemini-3.5-flash failed, falling back to gemini-2.5-flash...", err35);
        try {
          response = await activeAi.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: schema
            }
          });
          textOutput = response.text || "";
        } catch (err25) {
          console.warn("⚠️ gemini-2.5-flash failed, falling back to general text model...", err25);
          try {
            response = await activeAi.models.generateContent({
              model: "gemini-2.5-flash",
              contents: prompt + "\n\nProvide the response strictly as valid, raw JSON matches the requested structure. Contain fields: seoTitle, seoDescription, seoKeywords, promotionalEmail, and draft."
            });
            textOutput = response.text || "";
          } catch (errFallback) {
            console.error("❌ All AI models failed.", errFallback);
            throw new Error(`AI generation failed: ${errFallback.message || String(errFallback)}. Please verify your Gemini API key in settings.`);
          }
        }
      }

      if (!textOutput) {
        throw new Error("No text received from Gemini.");
      }

      let jsonStr = textOutput.trim();
      // Handle potential markdown block formatting from fallback responses
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
      }
      
      const result = JSON.parse(jsonStr.trim());
      res.json(result);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || "Failed to generate AI content." });
    }
  });

  // DB CRUD API Endpoints
  app.get("/api/apps", async (req, res) => {
    try {
      const apps = await fetchAllApps();
      res.json(apps);
    } catch (error: any) {
      console.error("Fetch apps failed:", error);
      res.status(500).json({ error: "Failed to fetch apps from Supabase Postgres." });
    }
  });

  app.get("/api/apps/:id", async (req, res) => {
    try {
      const appItem = await findAppById(req.params.id);
      if (!appItem) {
        res.status(404).json({ error: "App not found." });
        return;
      }
      res.json(appItem);
    } catch (error: any) {
      console.error("Get app failed:", error);
      res.status(500).json({ error: "Failed to retrieve app metadata." });
    }
  });

  app.get("/api/apps/:id/reviews", async (req, res) => {
    try {
      const reviews = await fetchUserReviewsForApp(req.params.id);
      res.json(reviews || []);
    } catch (error: any) {
      console.error("Fetch reviews failed:", error);
      res.status(500).json({ error: "Failed to fetch user reviews for this app." });
    }
  });

  app.post("/api/apps/:id/reviews", async (req, res) => {
    try {
      const { authorName, rating, comment } = req.body;
      if (!authorName?.trim() || !comment?.trim()) {
        res.status(400).json({ error: "Name and comment are required." });
        return;
      }
      const ratingValue = parseInt(rating);
      if (isNaN(ratingValue) || ratingValue < 1 || ratingValue > 5) {
        res.status(400).json({ error: "Rating must be an integer between 1 and 5." });
        return;
      }

      const newReview = await submitUserReview(req.params.id, authorName, ratingValue, comment);
      res.json({ success: true, review: newReview });
    } catch (error: any) {
      console.error("Submit review failed:", error);
      res.status(500).json({ error: "Failed to submit review." });
    }
  });

  app.post("/api/apps/:id", async (req, res) => {
    try {
      const saved = await saveAppReview(req.params.id, req.body);
      res.json(saved);
    } catch (error: any) {
      console.error("Save app failed:", error);
      res.status(500).json({ error: error.message || "Failed to save app change." });
    }
  });

  app.delete("/api/apps/:id", async (req, res) => {
    try {
      await removeAppReview(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Delete app failed:", error);
      res.status(500).json({ error: "Failed to delete app from repository." });
    }
  });

  // Helper to get SMTP transporter and send email
  async function sendEmail({ to, subject, htmlText }: { to: string; subject: string; htmlText: string }) {
    const settings = await fetchAdminSettings();
    if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
      console.warn("⚠️ SMTP settings are incomplete! Email sending skipped.");
      return { success: false, error: "SMTP host or authentication user/password is missing in administration dashboard settings." };
    }

    const host = settings.smtp_host;
    const port = parseInt(settings.smtp_port || "587", 10);
    const secure = settings.smtp_secure === 'true';
    const user = settings.smtp_user;
    const pass = settings.smtp_pass;
    const fromVal = settings.smtp_from || `"Pakalone Slots" <${user}>`;

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      const info = await transporter.sendMail({
        from: fromVal,
        to,
        subject,
        html: htmlText
      });

      console.log("✅ Email sent successfully: %s", info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      console.error("❌ Email sending failure:", err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  // Allowed Admins Endpoints
  app.get("/api/admin/admins-list", async (req, res) => {
    try {
      const admins = getLocalAdmins();
      res.json(admins);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to load admin emails list." });
    }
  });

  app.post("/api/admin/verify", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ error: "Email is required." });
        return;
      }
      const lowerEmail = email.toLowerCase().trim();
      const admins = getLocalAdmins();
      const isAllowed = admins.includes(lowerEmail);
      res.json({ allowed: isAllowed, adminsList: admins });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to verify admin status." });
    }
  });

  // Dedicated direct administrator auth check (bypass redirect issues)
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: "Email and password are required." });
        return;
      }
      const lowerEmail = email.toLowerCase().trim();
      const admins = getLocalAdmins();
      const isAllowedAdmin = admins.includes(lowerEmail);
      
      if (!isAllowedAdmin) {
        res.status(403).json({ error: `Access Denied: The email "${lowerEmail}" is not authorized.` });
        return;
      }

      // Root Master passcode verification
      if (password === "imissu21432") {
        res.json({ success: true, email: lowerEmail });
      } else {
        res.status(401).json({ error: "Incorrect passcode." });
      }
    } catch (err: any) {
      res.status(500).json({ error: "Login authentication error." });
    }
  });

  app.post("/api/admin/admins-list", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || !email.includes('@')) {
        res.status(400).json({ error: "A valid email address is required." });
        return;
      }
      const lowerEmail = email.toLowerCase().trim();
      const admins = getLocalAdmins();
      if (!admins.includes(lowerEmail)) {
        admins.push(lowerEmail);
        saveLocalAdmins(admins);
      }
      res.json({ success: true, adminsList: admins });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to add admin email." });
    }
  });

  app.delete("/api/admin/admins-list/:email", async (req, res) => {
    try {
      const email = req.params.email.toLowerCase().trim();
      
      // Prevent lockout of standard root admins
      if (email === 'zainalipri@gmail.com' || email === 'zainalipro83@gmail.com' || email === 'pakalone.online@gmail.com') {
        res.status(400).json({ error: "Root admin emails cannot be deleted to avoid lockout." });
        return;
      }

      let admins = getLocalAdmins();
      if (admins.includes(email)) {
        admins = admins.filter(e => e !== email);
        saveLocalAdmins(admins);
        res.json({ success: true, adminsList: admins });
      } else {
        res.status(404).json({ error: "Admin email not found in lists." });
      }
    } catch (err: any) {
      res.status(500).json({ error: "Failed to delete admin email." });
    }
  });

  // Active Database Provider API (Supabase vs Firebase)
  app.get("/api/admin/db-provider", async (req, res) => {
    try {
      const provider = getActiveDbProvider();
      res.json({ provider });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to get active database provider." });
    }
  });

  app.post("/api/admin/db-provider", async (req, res) => {
    try {
      const { provider } = req.body;
      if (provider !== 'supabase' && provider !== 'firebase') {
        res.status(400).json({ error: "Invalid provider. Must be 'supabase' or 'firebase'." });
        return;
      }
      saveActiveDbProvider(provider);
      res.json({ success: true, provider });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to switch active database provider." });
    }
  });

  // Supabase Configuration API
  app.get("/api/supabase-config", (req, res) => {
    res.json({
      supabaseUrl: process.env.SUPABASE_URL || "https://xcxiwhxszjprbxypxqsy.supabase.co",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjeGl3aHhzempwcmJ4eXB4cXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTU0NjIzMjgsImV4cCI6MjAzMTAzODMyOH0.dummy-anon-key-actual-can-be-entered-by-admin"
    });
  });

  app.get("/api/admin/supabase-url", async (req, res) => {
    try {
      const dbUrl = loadSupabaseConfig();
      // Obscure the password for safety
      let obscuredUrl = dbUrl;
      try {
        obscuredUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
      } catch (err) {
        // Safe fallback if parsing fails
      }
      const isUsingMemory = getUseMemoryDb();
      res.json({ url: obscuredUrl, rawUrl: dbUrl, connected: !isUsingMemory });
    } catch (err) {
      res.status(500).json({ error: "Failed to load Supabase connection state." });
    }
  });

  app.post("/api/admin/supabase-url", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || !url.startsWith("postgresql://")) {
        res.status(400).json({ error: "Valid PostgreSQL connection string starting with 'postgresql://' is required." });
        return;
      }
      
      const transition = await updateDatabasePool(url);
      if (transition.success) {
        res.json({ success: true, message: "Connected and migrated Supabase database successfully!" });
      } else {
        res.status(400).json({ error: transition.error || "Failed to connect with new Supabase database URL." });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to apply database update." });
    }
  });

  // SMTP Admin Settings Endpoints
  app.get("/api/public/settings", async (req, res) => {
    try {
      const settings = await fetchAdminSettings();
      res.json({
        community_facebook: settings.community_facebook || 'https://facebook.com',
        community_twitter: settings.community_twitter || 'https://twitter.com',
        community_telegram: settings.community_telegram || 'https://t.me',
        portal_theme_mode: settings.portal_theme_mode || 'light',
        portal_logo_url: settings.portal_logo_url || ''
      });
    } catch (err: any) {
      res.json({
        community_facebook: 'https://facebook.com',
        community_twitter: 'https://twitter.com',
        community_telegram: 'https://t.me',
        portal_theme_mode: 'light',
        portal_logo_url: ''
      });
    }
  });

  app.get("/api/admin/settings", async (req, res) => {
    try {
      const settings = await fetchAdminSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to retrieve SMTP settings." });
    }
  });

  app.post("/api/admin/settings", async (req, res) => {
    try {
      const updated = await saveAdminSettings(req.body);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update SMTP settings." });
    }
  });

  // Newsletter Subscriptions Endpoints
  app.post("/api/subscribe", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || !email.includes('@')) {
        res.status(400).json({ error: "Please enter a valid email address." });
        return;
      }
      const { ip, country } = getClientRequestDetails(req);
      await addSubscriber(email, ip, country);

      // Trigger automatic welcome notification email if SMTP details are configured
      const settings = await fetchAdminSettings();
      if (settings.smtp_host && settings.smtp_user && settings.smtp_pass) {
        await sendEmail({
          to: email,
          subject: "🎰 Welcome to Pakalone verified slots directory!",
          htmlText: `
            <div style="font-family: sans-serif; padding: 20px; line-height: 1.6; color: #1e293b; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 600px; margin: 0 auto;">
              <div style="text-align: center; margin-bottom: 20px;">
                <span style="font-size: 40px;">🎰</span>
                <h2 style="color: #1e3a8a; margin: 10px 0 0 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">PAKALONE SLOTS</h2>
                <p style="font-size: 12px; color: #3b82f6; font-weight: bold; text-transform: uppercase; tracking-wider: 1px; margin: 5px 0 0 0;">Official Agency Download Core</p>
              </div>
              <div style="background-color: #ffffff; padding: 25px; border-radius: 8px; border: 1px solid #f1f5f9;">
                <p style="margin-top: 0;">Hi Subscriber,</p>
                <p>Thank you for subscribing to the official Pakalone Slots directory. You will now be the first to receive premium game updates, direct download APK nodes, and daily promotion codes!</p>
                <p>Make sure to add this email sender to your contacts so you don't miss our periodic multiplier updates and easy EasyPaisa/JazzCash withdrawal strategies.</p>
                <p style="margin-bottom: 0;">Happy Earning!</p>
              </div>
              <div style="text-align: center; margin-top: 20px; font-size: 11px; color: #64748b;">
                <p>© 2026 Pakalone Slots. All Rights Vetted and Verified.</p>
                <p style="color: #94a3b8;">This was sent automatically via Pakalone Administration servers. If you did not trigger this request, you may contact support to terminate.</p>
              </div>
            </div>
          `
        });
      }

      res.json({ success: true, message: "Thank you for subscribing!" });
    } catch (err: any) {
      console.error("Subscribe fail:", err);
      res.status(500).json({ error: "Failed to register subscription." });
    }
  });

  app.get("/api/admin/subscribers", async (req, res) => {
    try {
      const subscribers = await fetchSubscribers();
      res.json(subscribers);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to load subscribers." });
    }
  });

  app.delete("/api/admin/subscribers/:email", async (req, res) => {
    try {
      await removeSubscriber(req.params.email);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to delete subscriber." });
    }
  });

  // Contact Messages Endpoints
  app.post("/api/messages", async (req, res) => {
    try {
      const { name, email, subject, message } = req.body;
      if (!email || !message) {
        res.status(400).json({ error: "Email address and message content are required values." });
        return;
      }
      const { ip, country } = getClientRequestDetails(req);
      const saved = await submitUserMessage(name || "Anonymous User", email, subject || "General Support", message, ip, country);

      // Optionally notify admin via SMTP if SMTP details exist
      const settings = await fetchAdminSettings();
      if (settings.smtp_host && settings.smtp_user && settings.smtp_pass) {
        await sendEmail({
          to: settings.smtp_user,
          subject: `📬 New User Query: ${subject || "General Inquiry"}`,
          htmlText: `
            <div style="font-family: sans-serif; padding: 20px; line-height: 1.6; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h3 style="color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-top: 0;">New Pakalone Query Received</h3>
              <p><strong>Name:</strong> ${name || 'Anonymous'}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Subject:</strong> ${subject || 'None'}</p>
              <p><strong>Origin IP:</strong> ${ip} (${country})</p>
              <p><strong>Message:</strong></p>
              <blockquote style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #3b82f6; margin: 0; font-style: italic;">${message}</blockquote>
              <p style="font-size: 11px; margin-top: 20px; color: #94a3b8;">Sent from user client submission portal on Pakalone Slots directory.</p>
            </div>
          `
        });
      }

      res.json({ success: true, message: "Your message has been submitted and saved successfully!" });
    } catch (err: any) {
      console.error("Message submission failure:", err);
      res.status(500).json({ error: "Could not save and submit current feedback query." });
    }
  });

  app.get("/api/admin/messages", async (req, res) => {
    try {
      const msgs = await fetchUserMessages();
      res.json(msgs);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to retrieve submitted user inquiries." });
    }
  });

  // Sending manual announcements/notifications via SMTP
  app.post("/api/admin/send-email", async (req, res) => {
    try {
      const { toEmail, targetType, subject, messageHtml } = req.body;
      if (!subject || !messageHtml) {
        res.status(400).json({ error: "Subject and HTML body content are verified requirements." });
        return;
      }

      if (targetType === "specific") {
        if (!toEmail) {
          res.status(400).json({ error: "A targeted recipient email is required." });
          return;
        }
        const outcome = await sendEmail({ to: toEmail, subject, htmlText: messageHtml });
        res.json(outcome);
      } else {
        const subscribers = await fetchSubscribers();
        if (subscribers.length === 0) {
          res.status(400).json({ error: "There are no users subscribed to receive notifications yet." });
          return;
        }

        let sentSuccess = 0;
        let sentFail = 0;
        const errors: string[] = [];

        for (const sub of subscribers) {
          const outcome = await sendEmail({ to: sub.email, subject, htmlText: messageHtml });
          if (outcome.success) {
            sentSuccess++;
          } else {
            sentFail++;
            if (outcome.error) errors.push(`${sub.email}: ${outcome.error}`);
          }
        }

        res.json({
          success: sentSuccess > 0,
          totalSubscribers: subscribers.length,
          sentSuccess,
          sentFail,
          errors: errors.slice(0, 10)
        });
      }
    } catch (err: any) {
      console.error("Manual sending failure:", err);
      res.status(500).json({ error: err?.message || "Failed to complete email campaign dispatch." });
    }
  });

  // Dynamic Sitemap Generator for Google search engines to instantly discover all games
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const apps = await fetchAllApps();
      const host = req.get('host');
      const protocol = req.protocol;
      const baseUrl = `${protocol}://${host}`;

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

      // Home URL
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/</loc>\n`;
      xml += `    <changefreq>daily</changefreq>\n`;
      xml += `    <priority>1.0</priority>\n`;
      xml += `  </url>\n`;

      // Game URLs dynamically loaded from active DB
      for (const game of apps) {
        xml += `  <url>\n`;
        xml += `    <loc>${baseUrl}/game/${game.id}</loc>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.8</priority>\n`;
        xml += `  </url>\n`;
      }

      xml += `</urlset>`;

      res.header('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error) {
      console.error("Sitemap generation failure:", error);
      res.status(500).send("Error generating sitemap");
    }
  });

  // Robots.txt to control crawling and link search engines to the dynamic sitemap
  app.get("/robots.txt", (req, res) => {
    const host = req.get('host');
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${host}`;

    let robots = `User-agent: *\n`;
    robots += `Allow: /\n`;
    robots += `Disallow: /admin\n\n`;
    robots += `Sitemap: ${baseUrl}/sitemap.xml\n`;

    res.header('Content-Type', 'text/plain');
    res.send(robots);
  });

  // High-fidelity server-side Dynamic SEO metadata injector for single-page details
  app.get("/game/:id", async (req, res) => {
    try {
      const appItem = await findAppById(req.params.id);
      const isProduction = process.env.NODE_ENV === "production";
      const filePath = isProduction 
        ? path.join(process.cwd(), 'dist', 'index.html')
        : path.join(process.cwd(), 'index.html');
      
      if (!fs.existsSync(filePath)) {
        res.sendFile(filePath);
        return;
      }
      
      let html = fs.readFileSync(filePath, 'utf-8');
      
      if (appItem) {
        const badgeWord = appItem.badge ? appItem.badge.toUpperCase() : 'VERIFIED';
        // Tailored specifically to high-intent rank search terms (like "game apk download", "real money app")
        const seoTitle = `${appItem.name} APK Download {${badgeWord}} - Real Money Earning Portal Pakistan 2026`;
        const methodStr = (appItem.methods && appItem.methods.length > 0) 
          ? appItem.methods.join(', ') 
          : 'Easypaisa, JazzCash';
        const seoDescription = `Download ${appItem.name} APK (${appItem.apkSize || 'Latest Version'}) for Androids. ${appItem.tagline || 'Popular instant checkout earning game in Pakistan.'} Cashout your real-money earnings instantly via ${methodStr}. Rated ${appItem.rating}/5.`;
        const seoKeywords = `${appItem.name}, ${appItem.name} APK download, ${appItem.name} real money app, online earning in Pakistan, easy earning games 2026, JazzCash, Easypaisa, pakalone, pakalone slots`;

        // Exact pattern replacement of default meta tags in index.html
        html = html.replace(/<title>.*?<\/title>/gi, `<title>${seoTitle}</title>`);
        html = html.replace(/<meta\s+name="description"\s+content=".*?"\s*\/?>/gi, `<meta name="description" content="${seoDescription}" />`);
        html = html.replace(/<meta\s+name="keywords"\s+content=".*?"\s*\/?>/gi, `<meta name="keywords" content="${seoKeywords}" />`);
        
        // Open Graph tags for social media link sharing preview ranking
        html = html.replace(/<meta\s+property="og:title"\s+content=".*?"\s*\/?>/gi, `<meta property="og:title" content="${seoTitle}" />`);
        html = html.replace(/<meta\s+property="og:description"\s+content=".*?"\s*\/?>/gi, `<meta property="og:description" content="${seoDescription}" />`);
        
        // App structured JSON-LD snippet for google rich application result cards
        const jsonLd = `
    <!-- Dynamic SoftwareApplication rich results schema tag built specifically for index ranking -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "${appItem.name}",
      "operatingSystem": "Android",
      "applicationCategory": "GameApplication",
      "fileSize": "${appItem.apkSize || '35 MB'}",
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "${appItem.rating || '4.8'}",
        "bestRating": "5",
        "ratingCount": "${Math.floor(Math.random() * 401) + 180}"
      },
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "PKR"
      }
    }
    </script>
        `;
        html = html.replace('</head>', `${jsonLd}\n</head>`);
      }
      res.send(html);
    } catch (err) {
      console.error("SEO dynamic injector error:", err);
      const isProduction = process.env.NODE_ENV === "production";
      const filePath = isProduction 
        ? path.join(process.cwd(), 'dist', 'index.html')
        : path.join(process.cwd(), 'index.html');
      res.sendFile(filePath);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Note: express ^4.x uses '*', express ^5.x uses '*all'
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
