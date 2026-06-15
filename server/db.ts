import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dns from 'dns';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, deleteDoc } from 'firebase/firestore';

// Force Node.js to prioritize IPv4 resolving to prevent ECONNREFUSED on environments with disabled IPv6 outbound routing
try {
  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
    console.log("🌐 DNS resolution order configured: Preferring IPv4 first.");
  }
} catch (err) {
  console.warn("Could not configure DNS default result order:", err);
}

const DEFAULT_DATABASE_URL = 'postgresql://postgres:%5BOnlyforme123%24%5D@db.xcxiwhxszjprbxypxqsy.supabase.co:5432/postgres';

const SUPABASE_FILE = path.join(process.cwd(), 'server', 'supabase_config.json');
const ADMINS_FILE = path.join(process.cwd(), 'server', 'admins_config.json');

// Get active database provider: 'supabase' | 'firebase' | 'memory'
export function getActiveDbProvider(): 'supabase' | 'firebase' | 'memory' {
  if (useMemoryDb) return 'memory';
  if (!isPostgresConnected) {
    return 'memory';
  }
  return 'supabase';
}

export function saveActiveDbProvider(provider: 'supabase') {
  try {
    const dir = path.dirname(SUPABASE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    let existing: any = {};
    if (fs.existsSync(SUPABASE_FILE)) {
      try {
        existing = JSON.parse(fs.readFileSync(SUPABASE_FILE, 'utf-8'));
      } catch (e) {}
    }
    existing.dbProvider = 'supabase';
    fs.writeFileSync(SUPABASE_FILE, JSON.stringify(existing, null, 2), 'utf-8');
    console.log(`Active database provider transitioned to: supabase`);
  } catch (e) {
    console.error("Error saving active db provider:", e);
  }
}

// Lazy initialization of Firebase Firestore on the server
let firebaseFirestoreInstance: any = null;
export function getFirebaseFirestore() {
  if (!firebaseFirestoreInstance) {
    try {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const app = getApps().length === 0 ? initializeApp(config) : getApp();
        firebaseFirestoreInstance = getFirestore(app, config.firestoreDatabaseId || config.projectId);
        console.log("🔥 Firebase Server-Side Firestore Initialized Successfully!");
      } else {
        console.warn("⚠️ firebase-applet-config.json not found on server context!");
      }
    } catch (e) {
      console.error("❌ Failed to initialize Firebase on the server:", e);
    }
  }
  return firebaseFirestoreInstance;
}

export function loadSupabaseConfig(): string {
  try {
    if (fs.existsSync(SUPABASE_FILE)) {
      const data = JSON.parse(fs.readFileSync(SUPABASE_FILE, 'utf-8'));
      if (data && data.databaseUrl) {
        return data.databaseUrl;
      }
    }
  } catch (e) {
    console.error("Error reading local Supabase config:", e);
  }
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

export function saveSupabaseConfig(url: string) {
  try {
    const dir = path.dirname(SUPABASE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    let existing: any = {};
    if (fs.existsSync(SUPABASE_FILE)) {
      try {
        existing = JSON.parse(fs.readFileSync(SUPABASE_FILE, 'utf-8'));
      } catch (e) {}
    }
    existing.databaseUrl = url;
    fs.writeFileSync(SUPABASE_FILE, JSON.stringify(existing, null, 2), 'utf-8');
  } catch (e) {
    console.error("Error writing local Supabase config:", e);
  }
}

let cachedAdmins: string[] = [];

export function getLocalAdmins(): string[] {
  if (cachedAdmins.length > 0) {
    return cachedAdmins;
  }
  try {
    if (fs.existsSync(ADMINS_FILE)) {
      const data = JSON.parse(fs.readFileSync(ADMINS_FILE, 'utf-8'));
      if (Array.isArray(data)) {
        const list = data.map((email: string) => email.toLowerCase().trim());
        cachedAdmins = list;
        return list;
      }
    }
  } catch (e) {
    console.error("Error reading local admins config:", e);
  }
  const defaults = ['zainalipri@gmail.com', 'zainalipro83@gmail.com', 'pakalone.online@gmail.com'];
  cachedAdmins = defaults;
  return defaults;
}

export function saveLocalAdmins(admins: string[]) {
  try {
    const dir = path.dirname(ADMINS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const cleanList = admins.map(e => e.toLowerCase().trim());
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(cleanList, null, 2), 'utf-8');
    cachedAdmins = cleanList;

    // Asynchronously update to database provider (Supabase / Firebase)
    saveAdminSettings({ admins_list: JSON.stringify(cleanList) }).catch(err => {
      console.error("Failed to sync admin emails to active database provider:", err);
    });
  } catch (e) {
    console.error("Error writing local admins config:", e);
  }
}

const connectionString = loadSupabaseConfig();

export let pool = new pg.Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

let useMemoryDb = false;
export let isPostgresConnected = false;

export function getUseMemoryDb() {
  return useMemoryDb;
}

export async function updateDatabasePool(newUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log("Dynamically transitioning pg Pool to new Supabase PostgreSQL instance...");
    const tempPool = new pg.Pool({
      connectionString: newUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
    });
    
    // Check if the connection works
    const client = await tempPool.connect();
    client.release();
    
    // Switch pool
    const oldPool = pool;
    pool = tempPool;
    useMemoryDb = false;
    
    // Try to terminate old pool cleanly
    oldPool.end().catch(err => console.warn("Error closing old pg Pool:", err));
    
    // Save locally
    saveSupabaseConfig(newUrl);
    
    // Run schema migrations and seed initial apps
    await initDb();
    
    return { success: true };
  } catch (err: any) {
    console.error("Failed to connect with new Supabase settings:", err);
    return { success: false, error: err?.message || String(err) };
  }
}

let memorySettings: Record<string, string> = {
  smtp_host: 'smtp.gmail.com',
  smtp_port: '465',
  smtp_secure: 'true',
  smtp_user: 'admin@gmail.com',
  smtp_pass: '',
  smtp_from: 'Pakalone Games <admin@gmail.com>',
  community_facebook: 'https://facebook.com',
  community_twitter: 'https://twitter.com',
  community_telegram: 'https://t.me',
  portal_theme_mode: 'light'
};
export function getSeedApps(): any[] {
  return [
    {
      id: "s9-game",
      name: "S9 Game",
      logo: "🎰",
      rating: 4.8,
      downloads: "500K+",
      apkSize: "35 MB",
      minCashout: "Rs. 200",
      methods: ["EasyPaisa", "JazzCash"],
      tagline: "Pakistan's #1 Trusted Cards & Instant EasyPaisa Payout Platform",
      detailedReview: "S9 Game (Super 9) is currently the leading real-money earning portal in Pakistan. Vetted for security and consistency, this stable gaming APK offers an optimized direct connection to EasyPaisa and JazzCash withdrawals. Players can enjoy traditional slot machines, classic cards, and lucky roulette dials with guaranteed low latency and daily check-in rewards. Its 24/7 client support keeps withdrawal pipes smooth for PKR players. Regular events and transparent multiplier rules make it highly recommended for users seeking vetted online entertainment with instant checkouts.",
      detailedReviewUrdu: "ایس نائن گیم (S9 Game) اس وقت پاکستان میں سب سے زیادہ مقبول اور قابلِ اعتماد ارننگ گیم ہے۔ یہ ایپ تیز اور محفوظ ایزی پیسہ اور جاز کیش کیش آؤٹ کی خصوصیات پیش کرتی ہے۔ صارفین سلیش سلاٹس، لکی رولیٹی، اور کلاسک کارڈ گیمز کھیل کر حقیقی آمدنی کما سکتے ہیں۔ چوبیس گھنٹے فعال کسٹمر سروس اور روزانہ فری بونسز صارفین کے اعتماد کو مزید مضبوط بناتے ہیں۔",
      pros: [
        "Direct checkout to JazzCash & EasyPaisa without delays",
        "Optimized low latency for all entry networks in Pakistan",
        "Very low minimum withdrawal and high multiplying factor"
      ],
      cons: [
        "Not yet available on official Google Play Store",
        "Moderate battery consumption on old Android phones"
      ],
      badge: "MOST POPULAR",
      apkUrl: "https://pakalone.online/downloads/s9game.apk",
      dailyUsers: "15,000+",
      previewImages: [
        "https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=500&q=80",
        "https://images.unsplash.com/photo-1541252260730-0412e8e2108e?w=500&q=80"
      ],
      videoUrl: "",
      createdAt: new Date().toISOString()
    },
    {
      id: "three-patti-lucky",
      name: "Three Patti Lucky",
      logo: "🃏",
      rating: 4.7,
      downloads: "200K+",
      apkSize: "28 MB",
      minCashout: "Rs. 100",
      methods: ["EasyPaisa", "JazzCash"],
      tagline: "Highest Multipliers on Traditional Slots and Card Tables in Pakistan",
      detailedReview: "Three Patti Lucky is a magnificent card game simulator perfectly fine-tuned for Pakistani cellular bandwidths. Integrating safe payout portals, this lightweight APK includes robust multiplier rounds on local slot tables. With round-the-clock security configurations, the portal establishes absolute transaction consistency. Download the official, updated secure mirror APK node to access exclusive cashout rooms with low entry barriers.",
      detailedReviewUrdu: "تھری پتی لکی کارڈ گیمز کے شائقین کے لیے ایک بہترین پلیٹ فارم ہے جس میں ایزی پیسہ اور جاز کیش کے ذریعے فوری ادائیگیاں حاصل کی جا سکتی ہیں۔ لائیو سپورٹ، شاندار گرافکس اور منصفانہ کھیل اس گیم کو ممتاز بناتے ہیں۔",
      pros: [
        "Ultra-lightweight 28 MB installation file size",
        "Instant Rs. 100 withdrawal minimum limit",
        "Daily login bonuses and lucky mystery scratchcards"
      ],
      cons: [
        "Interface has background audio that must be muted manually",
        "Requires active internet connection at all times to execute slots"
      ],
      badge: "TRUSTED",
      apkUrl: "https://pakalone.online/downloads/three-patti-lucky.apk",
      dailyUsers: "8,500+",
      previewImages: [
        "https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=500&q=80"
      ],
      videoUrl: "",
      createdAt: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: "all-slots-777",
      name: "All Slots 777",
      logo: "💎",
      rating: 4.9,
      downloads: "100K+",
      apkSize: "42 MB",
      minCashout: "Rs. 150",
      methods: ["EasyPaisa", "JazzCash", "Bank Transfer"],
      tagline: "Premium Vegas-Style Slot Rooms Fine-Tuned for Direct PKR Cashouts",
      detailedReview: "All Slots 777 transforms mobile slot gaming with its certified multiplier engine. Boasting state-of-the-art secure slots rooms, the APK features rapid cashouts to local bank modules and mobile wallets. The platform's automated audit ensures a transparent gaming environment. Grab the official agency APK today and leverage safe multipliers in trusted digital slot loops.",
      detailedReviewUrdu: "آل سلاٹس 777 ایک پریمیم سلاٹ گیم ہے جو پاکستان میں بینک اور موبائل والٹس میں ادائیگیاں فراہم کرتا ہے۔ اس میں کثیر تعداد میں سلاٹ رومز اور کلاسک ویگاس طرز کا گیم پلے منصفانہ اور شفاف طریقے سے پیش کیا گیا ہے۔",
      pros: [
        "Offers verified bank transfers alongside local telco wallets",
        "Stately visual graphics with intuitive responsive design",
        "Certified fair-multiplier engine with transparent audit logs"
      ],
      cons: [
        "Slightly larger memory profile requiring 42 MB",
        "Strict account validation protocols to thwart duplicate login abuse"
      ],
      badge: "HIGHEST PAYOUT",
      apkUrl: "https://pakalone.online/downloads/allslots777.apk",
      dailyUsers: "11,000+",
      previewImages: [
        "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&q=80"
      ],
      videoUrl: "",
      createdAt: new Date(Date.now() - 7200000).toISOString()
    }
  ];
}

let memorySubscribers: any[] = [];
let memoryMessages: any[] = [];

let memoryApps: any[] = getSeedApps();

export async function initDb() {
  console.log("Initializing database connection...");
  
  // Create variations of the configuration URL so we can try multiple strategies
  const optionUrls: string[] = [];
  
  const configuredUrl = loadSupabaseConfig();
  optionUrls.push(configuredUrl);
  
  if (process.env.DATABASE_URL && process.env.DATABASE_URL !== configuredUrl) {
    optionUrls.push(process.env.DATABASE_URL);
  }
  
  // Variations of the user credentials
  if (DEFAULT_DATABASE_URL !== configuredUrl) {
    optionUrls.push(DEFAULT_DATABASE_URL);
  }
  optionUrls.push('postgresql://postgres:%5BOnlyforme123%24%5D@db.xcxiwhxszjprbxypxqsy.supabase.co:5432/postgres');

  let connected = false;
  for (const url of optionUrls) {
    try {
      const dbUrlLog = url.replace(/:[^:@]+@/, ':****@');
      console.log(`Connecting to Postgres url variant: ${dbUrlLog}`);
      const tempPool = new pg.Pool({
        connectionString: url,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 4000
      });

      const client = await tempPool.connect();
      client.release();
      
      pool = tempPool;
      connected = true;
      isPostgresConnected = true;
      console.log("Successfully connected to Postgres Database!");
      break;
    } catch (err: any) {
      console.warn(`Connection variant failed: ${err?.message || err}`);
    }
  }

  if (!connected) {
    isPostgresConnected = false;
    console.error("❌ database is unreachable or credentials failed. Switching to high-reliability local memory fallback!");
    useMemoryDb = true;
    return;
  }

  try {
    const client = await pool.connect();
    try {
      console.log("Preparing Postgres Database schema...");
      await client.query(`
        CREATE TABLE IF NOT EXISTS apps (
          id VARCHAR(100) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          logo TEXT NOT NULL,
          rating NUMERIC DEFAULT 5.0,
          downloads VARCHAR(100),
          apk_size VARCHAR(100),
          min_cashout VARCHAR(100),
          methods JSONB DEFAULT '[]'::jsonb,
          tagline TEXT,
          detailed_review TEXT,
          detailed_review_urdu TEXT,
          pros JSONB DEFAULT '[]'::jsonb,
          cons JSONB DEFAULT '[]'::jsonb,
          badge VARCHAR(150),
          apk_url TEXT NOT NULL,
          daily_users VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Dynamically alter table to add columns for preview images and video URLs
      await client.query(`ALTER TABLE apps ADD COLUMN IF NOT EXISTS preview_images JSONB DEFAULT '[]'::jsonb`);
      await client.query(`ALTER TABLE apps ADD COLUMN IF NOT EXISTS video_url TEXT`);

      await client.query(`
        CREATE TABLE IF NOT EXISTS admin_settings (
          key VARCHAR(100) PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS subscribers (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100)`);
      await client.query(`ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS country VARCHAR(100)`);

      await client.query(`
        CREATE TABLE IF NOT EXISTS user_messages (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255),
          email VARCHAR(255) NOT NULL,
          subject VARCHAR(255),
          message TEXT NOT NULL,
          submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await client.query(`ALTER TABLE user_messages ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100)`);
      await client.query(`ALTER TABLE user_messages ADD COLUMN IF NOT EXISTS country VARCHAR(100)`);

      await client.query(`
        CREATE TABLE IF NOT EXISTS user_reviews (
          id SERIAL PRIMARY KEY,
          app_id VARCHAR(100) NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
          author_name VARCHAR(255) NOT NULL,
          rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
          comment TEXT NOT NULL,
          submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // Explicitly remove deleting default apps to allow persistence of custom data and seed apps
      console.log("Database initialized check: General games/apps preserved.");

      // Load saved admin settings cache from Supabase database
      try {
        const adminRes = await client.query("SELECT value FROM admin_settings WHERE key = 'admins_list'");
        if (adminRes.rows.length > 0) {
          const loadedStr = adminRes.rows[0].value;
          if (loadedStr) {
            const parsed = JSON.parse(loadedStr);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const list = parsed.map((e: string) => e.toLowerCase().trim());
              cachedAdmins = list;
              // Sync back to local file for offline fallback capability
              const dir = path.dirname(ADMINS_FILE);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(ADMINS_FILE, JSON.stringify(list, null, 2), 'utf-8');
              console.log("⚙️ Database reconstructed administrators list:", list);
            }
          }
        }
      } catch (err) {
        console.warn("Could not sync admins setting during Postgres init. Fall back to local file:", err);
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Database schema setup or seed fail. Operating anyway:", error);
    useMemoryDb = true;
  }
}

function mapRowToAppReview(row: any): any {
  return {
    id: row.id,
    name: row.name,
    logo: row.logo,
    rating: parseFloat(row.rating) || 5.0,
    downloads: row.downloads,
    apkSize: row.apk_size,
    minCashout: row.min_cashout,
    methods: typeof row.methods === 'string' ? JSON.parse(row.methods) : (row.methods || []),
    tagline: row.tagline,
    detailedReview: row.detailed_review,
    detailedReviewUrdu: row.detailed_review_urdu,
    pros: typeof row.pros === 'string' ? JSON.parse(row.pros) : (row.pros || []),
    cons: typeof row.cons === 'string' ? JSON.parse(row.cons) : (row.cons || []),
    badge: row.badge,
    apkUrl: row.apk_url,
    dailyUsers: row.daily_users,
    createdAt: row.created_at,
    previewImages: typeof row.preview_images === 'string' ? JSON.parse(row.preview_images) : (row.preview_images || []),
    videoUrl: row.video_url || ''
  };
}

export async function fetchAllApps() {
  const provider = getActiveDbProvider();
  if (provider === 'firebase') {
    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        const querySnapshot = await getDocs(collection(firestore, 'apps'));
        const appsList: any[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          appsList.push({
            id: docSnap.id,
            name: data.name,
            logo: data.logo,
            badge: data.badge || null,
            tagline: data.tagline || '',
            rating: typeof data.rating === 'number' ? data.rating : (parseFloat(data.rating) || 5.0),
            downloads: data.downloads || '',
            apkSize: data.apkSize || '',
            minCashout: data.minCashout || '',
            dailyUsers: data.dailyUsers || '',
            methods: data.methods || [],
            apkUrl: data.apkUrl || '',
            detailedReview: data.detailedReview || '',
            detailedReviewUrdu: data.detailedReviewUrdu || '',
            pros: data.pros || [],
            cons: data.cons || [],
            previewImages: data.previewImages || [],
            videoUrl: data.videoUrl || '',
            createdAt: data.createdAt ? new Date(data.createdAt) : new Date()
          });
        });
        
        if (appsList.length === 0) {
          console.log("No apps found in Firestore; automatically seeding premium trusted Pakistani slots apps...");
          const seedAppsList = getSeedApps();
          for (const app of seedAppsList) {
            await saveAppReview(app.id, app);
          }
          return seedAppsList.map(app => ({
            ...app,
            createdAt: new Date(app.createdAt)
          })).sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return appsList.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());
      } catch (err) {
        console.error("Firebase fetchAllApps failed:", err);
      }
    }
  }

  if (useMemoryDb) {
    return memoryApps;
  }
  const result = await pool.query('SELECT * FROM apps ORDER BY created_at DESC');
  return result.rows.map(mapRowToAppReview);
}

export async function findAppById(id: string) {
  const provider = getActiveDbProvider();
  if (provider === 'firebase') {
    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        const docSnap = await getDoc(doc(firestore, 'apps', id));
        if (docSnap.exists()) {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: data.name,
            logo: data.logo,
            badge: data.badge || null,
            tagline: data.tagline || '',
            rating: typeof data.rating === 'number' ? data.rating : (parseFloat(data.rating) || 5.0),
            downloads: data.downloads || '',
            apkSize: data.apkSize || '',
            minCashout: data.minCashout || '',
            dailyUsers: data.dailyUsers || '',
            methods: data.methods || [],
            apkUrl: data.apkUrl || '',
            detailedReview: data.detailedReview || '',
            detailedReviewUrdu: data.detailedReviewUrdu || '',
            pros: data.pros || [],
            cons: data.cons || [],
            previewImages: data.previewImages || [],
            videoUrl: data.videoUrl || '',
            createdAt: data.createdAt ? new Date(data.createdAt) : new Date()
          };
        }
        return null;
      } catch (e) {
        console.error("Firebase findAppById list failure, fallback into SQL:", e);
      }
    }
  }

  if (useMemoryDb) {
    return memoryApps.find(app => app.id === id) || null;
  }
  const result = await pool.query('SELECT * FROM apps WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  return mapRowToAppReview(result.rows[0]);
}

export async function saveAppReview(id: string, app: any) {
  const provider = getActiveDbProvider();
  if (provider === 'firebase') {
    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        await setDoc(doc(firestore, 'apps', id), {
          name: app.name,
          logo: app.logo,
          badge: app.badge || null,
          tagline: app.tagline || '',
          rating: Number(app.rating) || 5.0,
          downloads: app.downloads || '',
          apkSize: app.apkSize || '',
          minCashout: app.minCashout || '',
          dailyUsers: app.dailyUsers || '',
          methods: app.methods || [],
          apkUrl: app.apkUrl || '',
          detailedReview: app.detailedReview || '',
          detailedReviewUrdu: app.detailedReviewUrdu || '',
          pros: app.pros || [],
          cons: app.cons || [],
          previewImages: app.previewImages || [],
          videoUrl: app.videoUrl || '',
          createdAt: app.createdAt ? new Date(app.createdAt).toISOString() : new Date().toISOString()
        });
        return findAppById(id);
      } catch (e) {
        console.error("Firebase saveAppReview failed, writing locally on SQLite memory:", e);
      }
    }
  }

  if (useMemoryDb) {
    const existingIndex = memoryApps.findIndex(a => a.id === id);
    const updatedRecord = {
      id,
      name: app.name,
      logo: app.logo,
      rating: Number(app.rating) || 5.0,
      downloads: app.downloads,
      apkSize: app.apkSize,
      minCashout: app.minCashout,
      methods: app.methods || [],
      tagline: app.tagline,
      detailedReview: app.detailedReview,
      detailedReviewUrdu: app.detailedReviewUrdu,
      pros: app.pros || [],
      cons: app.cons || [],
      badge: app.badge,
      apkUrl: app.apkUrl,
      dailyUsers: app.dailyUsers,
      previewImages: app.previewImages || [],
      videoUrl: app.videoUrl || '',
      createdAt: new Date()
    };
    if (existingIndex >= 0) {
      memoryApps[existingIndex] = updatedRecord;
    } else {
      memoryApps.push(updatedRecord);
    }
    return updatedRecord;
  }

  const check = await pool.query('SELECT id FROM apps WHERE id = $1', [id]);
  const methodsJson = JSON.stringify(app.methods || []);
  const prosJson = JSON.stringify(app.pros || []);
  const consJson = JSON.stringify(app.cons || []);
  const previewImagesJson = JSON.stringify(app.previewImages || []);
  const videoUrlRaw = app.videoUrl || '';

  if (check.rows.length > 0) {
    await pool.query(`
      UPDATE apps SET
        name = $1,
        logo = $2,
        rating = $3,
        downloads = $4,
        apk_size = $5,
        min_cashout = $6,
        methods = $7,
        tagline = $8,
        detailed_review = $9,
        detailed_review_urdu = $10,
        pros = $11,
        cons = $12,
        badge = $13,
        apk_url = $14,
        daily_users = $15,
        preview_images = $16,
        video_url = $17
      WHERE id = $18
    `, [
      app.name, app.logo, app.rating, app.downloads, app.apkSize, app.minCashout,
      methodsJson, app.tagline, app.detailedReview, app.detailedReviewUrdu,
      prosJson, consJson, app.badge, app.apkUrl, app.dailyUsers, previewImagesJson, videoUrlRaw, id
    ]);
  } else {
    await pool.query(`
      INSERT INTO apps (
        id, name, logo, rating, downloads, apk_size, min_cashout, methods, tagline,
        detailed_review, detailed_review_urdu, pros, cons, badge, apk_url, daily_users,
        preview_images, video_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    `, [
      id, app.name, app.logo, app.rating, app.downloads, app.apkSize, app.minCashout,
      methodsJson, app.tagline, app.detailedReview, app.detailedReviewUrdu,
      prosJson, consJson, app.badge, app.apkUrl, app.dailyUsers, previewImagesJson, videoUrlRaw
    ]);
  }
  return findAppById(id);
}

export async function removeAppReview(id: string) {
  const provider = getActiveDbProvider();
  if (provider === 'firebase') {
    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        await deleteDoc(doc(firestore, 'apps', id));
        return true;
      } catch (e) {
        console.error("Firebase removeAppReview failed:", e);
      }
    }
  }

  if (useMemoryDb) {
    memoryApps = memoryApps.filter(app => app.id !== id);
    return true;
  }
  await pool.query('DELETE FROM apps WHERE id = $1', [id]);
  return true;
}

export async function fetchAdminSettings() {
  const provider = getActiveDbProvider();
  
  const defaults: Record<string, string> = {
    smtp_host: 'smtp.gmail.com',
    smtp_port: '465',
    smtp_secure: 'true',
    smtp_user: 'admin@gmail.com',
    smtp_pass: '',
    smtp_from: 'Pakalone Games <admin@gmail.com>',
    community_facebook: 'https://facebook.com',
    community_twitter: 'https://twitter.com',
    community_telegram: 'https://t.me',
    portal_theme_mode: 'light',
    gemini_api_key: ''
  };

  if (provider === 'firebase') {
    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        const querySnapshot = await getDocs(collection(firestore, 'admin_settings'));
        const settings: Record<string, string> = {};
        querySnapshot.forEach((docSnap) => {
          settings[docSnap.id] = docSnap.data().value || '';
        });
        return { ...defaults, ...settings };
      } catch (err) {
        console.error("Firebase fetchAdminSettings failed:", err);
      }
    }
    return memorySettings;
  }

  if (useMemoryDb) {
    return memorySettings;
  }
  try {
    const result = await pool.query('SELECT * FROM admin_settings');
    const settings: Record<string, string> = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }
    return { ...defaults, ...settings };
  } catch (error) {
    console.error("fetchAdminSettings failed, using memory settings default config:", error);
    return memorySettings;
  }
}

export async function saveAdminSettings(settings: Record<string, string>) {
  const provider = getActiveDbProvider();
  if (provider === 'firebase') {
    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        for (const [key, val] of Object.entries(settings)) {
          await setDoc(doc(firestore, 'admin_settings', key), { value: val });
        }
        return fetchAdminSettings();
      } catch (err) {
        console.error("Firebase saveAdminSettings failed, writing to memory fallback:", err);
      }
    }
  }

  if (useMemoryDb) {
    memorySettings = { ...memorySettings, ...settings };
    return memorySettings;
  }
  try {
    for (const [key, val] of Object.entries(settings)) {
      await pool.query(`
        INSERT INTO admin_settings (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `, [key, val]);
    }
    return fetchAdminSettings();
  } catch (error) {
    console.error("saveAdminSettings failed, fall back to memory setting mutation:", error);
    memorySettings = { ...memorySettings, ...settings };
    return memorySettings;
  }
}

export async function addSubscriber(email: string, ipAddress?: string, country?: string) {
  const provider = getActiveDbProvider();
  if (provider === 'firebase') {
    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        const id = email.replace(/[^a-zA-Z0-9_\-]/g, '_');
        await setDoc(doc(firestore, 'subscribers', id), {
          email,
          ip_address: ipAddress || null,
          country: country || null,
          subscribedAt: new Date().toISOString()
        });
        return true;
      } catch (e) {
        console.error("Firebase addSubscriber failed:", e);
      }
    }
  }

  if (useMemoryDb) {
    if (!memorySubscribers.find(s => s.email === email)) {
      memorySubscribers.push({ 
        id: memorySubscribers.length + 1, 
        email, 
        ip_address: ipAddress || null,
        country: country || null,
        subscribed_at: new Date() 
      });
    }
    return true;
  }
  try {
    await pool.query(`
      INSERT INTO subscribers (email, ip_address, country) 
      VALUES ($1, $2, $3) 
      ON CONFLICT (email) DO UPDATE SET ip_address = EXCLUDED.ip_address, country = EXCLUDED.country
    `, [email, ipAddress || null, country || null]);
    return true;
  } catch (error) {
    console.error("addSubscriber failed, using memory fallback:", error);
    if (!memorySubscribers.find(s => s.email === email)) {
      memorySubscribers.push({ 
        id: memorySubscribers.length + 1, 
        email, 
        ip_address: ipAddress || null,
        country: country || null,
        subscribed_at: new Date() 
      });
    }
    return true;
  }
}

export async function fetchSubscribers() {
  const provider = getActiveDbProvider();
  if (provider === 'firebase') {
    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        const querySnapshot = await getDocs(collection(firestore, 'subscribers'));
        const list: any[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            email: data.email,
            ipAddress: data.ip_address || null,
            country: data.country || null,
            subscribedAt: data.subscribedAt ? new Date(data.subscribedAt) : new Date()
          });
        });
        return list.sort((a,b) => b.subscribedAt.getTime() - a.subscribedAt.getTime());
      } catch (err) {
        console.error("Firebase fetchSubscribers failed:", err);
      }
    }
  }

  if (useMemoryDb) {
    return memorySubscribers.map(s => ({
      id: s.id,
      email: s.email,
      ipAddress: s.ip_address || null,
      country: s.country || null,
      subscribedAt: s.subscribed_at
    }));
  }
  try {
    const result = await pool.query('SELECT * FROM subscribers ORDER BY subscribed_at DESC');
    return result.rows.map(row => ({
      id: row.id,
      email: row.email,
      ipAddress: row.ip_address || null,
      country: row.country || null,
      subscribedAt: row.subscribed_at
    }));
  } catch (error) {
    console.error("fetchSubscribers failed, returning memory list:", error);
    return memorySubscribers.map(s => ({
      id: s.id,
      email: s.email,
      ipAddress: s.ip_address || null,
      country: s.country || null,
      subscribedAt: s.subscribed_at
    }));
  }
}

export async function removeSubscriber(email: string) {
  const provider = getActiveDbProvider();
  if (provider === 'firebase') {
    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        const id = email.replace(/[^a-zA-Z0-9_\-]/g, '_');
        await deleteDoc(doc(firestore, 'subscribers', id));
        return true;
      } catch (e) {
        console.error("Firebase removeSubscriber failed:", e);
      }
    }
  }

  if (useMemoryDb) {
    memorySubscribers = memorySubscribers.filter(s => s.email !== email);
    return true;
  }
  try {
    await pool.query('DELETE FROM subscribers WHERE email = $1', [email]);
    return true;
  } catch (error) {
    console.error("removeSubscriber failed, removing from memory active list:", error);
    memorySubscribers = memorySubscribers.filter(s => s.email !== email);
    return true;
  }
}

export async function submitUserMessage(name: string, email: string, subject: string, message: string, ipAddress?: string, country?: string) {
  const provider = getActiveDbProvider();
  if (provider === 'firebase') {
    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        const docId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        const msgItem = {
          id: docId,
          name,
          email,
          subject,
          message,
          ip_address: ipAddress || null,
          country: country || null,
          submittedAt: new Date().toISOString()
        };
        await setDoc(doc(firestore, 'user_messages', docId), msgItem);
        return {
          ...msgItem,
          submittedAt: new Date()
        };
      } catch (e) {
        console.error("Firebase submitUserMessage failed:", e);
      }
    }
  }

  if (useMemoryDb) {
    const newMessage = {
      id: memoryMessages.length + 1,
      name,
      email,
      subject,
      message,
      ip_address: ipAddress || null,
      country: country || null,
      submittedAt: new Date()
    };
    memoryMessages.push(newMessage);
    return newMessage;
  }
  try {
    const result = await pool.query(`
      INSERT INTO user_messages (name, email, subject, message, ip_address, country)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, email, subject, message, ip_address as "ipAddress", country, submitted_at as "submittedAt"
    `, [name, email, subject, message, ipAddress || null, country || null]);
    return result.rows[0];
  } catch (error) {
    console.error("submitUserMessage failed, fallback to saving in memory:", error);
    const newMessage = {
      id: memoryMessages.length + 1,
      name,
      email,
      subject,
      message,
      ip_address: ipAddress || null,
      country: country || null,
      submittedAt: new Date()
    };
    memoryMessages.push(newMessage);
    return newMessage;
  }
}

export async function fetchUserMessages() {
  const provider = getActiveDbProvider();
  if (provider === 'firebase') {
    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        const querySnapshot = await getDocs(collection(firestore, 'user_messages'));
        const list: any[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            name: data.name,
            email: data.email,
            subject: data.subject,
            message: data.message,
            ipAddress: data.ip_address || null,
            country: data.country || null,
            submittedAt: data.submittedAt ? new Date(data.submittedAt) : new Date()
          });
        });
        return list.sort((a,b) => b.submittedAt.getTime() - a.submittedAt.getTime());
      } catch (err) {
        console.error("Firebase fetchUserMessages failed:", err);
      }
    }
  }

  if (useMemoryDb) {
    return memoryMessages.map(m => ({
      ...m,
      ipAddress: m.ip_address || null,
      country: m.country || null
    }));
  }
  try {
    const result = await pool.query('SELECT * FROM user_messages ORDER BY submitted_at DESC');
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      subject: row.subject,
      message: row.message,
      ipAddress: row.ip_address || null,
      country: row.country || null,
      submittedAt: row.submitted_at
    }));
  } catch (error) {
    console.error("fetchUserMessages failed, returning memory list:", error);
    return memoryMessages.map(m => ({
      ...m,
      ipAddress: m.ip_address || null,
      country: m.country || null
    }));
  }
}

let memoryReviews: any[] = [
  {
    id: 'rev_1',
    appId: 's9-game',
    authorName: 'Arsalan Khan',
    rating: 5,
    comment: 'Best application for daily cashout in Easypaisa! Very fast withdrawals and stable server.',
    submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000 * 2) // 2 days ago
  },
  {
    id: 'rev_2',
    appId: 's9-game',
    authorName: 'Mohammad Ali',
    rating: 4,
    comment: 'Achi game hai, easy interface aur helpful 24/7 support. Highly recommended for earning.',
    submittedAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
  }
];

export async function submitUserReview(appId: string, authorName: string, rating: number, comment: string) {
  const provider = getActiveDbProvider();
  if (provider === 'firebase') {
    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        const docId = 'rev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        const reviewItem = {
          id: docId,
          appId,
          authorName,
          rating,
          comment,
          submittedAt: new Date().toISOString()
        };
        await setDoc(doc(firestore, 'user_reviews', docId), reviewItem);
        return {
          ...reviewItem,
          submittedAt: new Date()
        };
      } catch (e) {
        console.error("Firebase submitUserReview failed:", e);
      }
    }
  }

  if (useMemoryDb) {
    const newReview = {
      id: 'rev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      appId,
      authorName,
      rating: Number(rating),
      comment,
      submittedAt: new Date()
    };
    memoryReviews.push(newReview);
    return newReview;
  }
  try {
    const result = await pool.query(`
      INSERT INTO user_reviews (app_id, author_name, rating, comment)
      VALUES ($1, $2, $3, $4)
      RETURNING id, app_id as "appId", author_name as "authorName", rating, comment, submitted_at as "submittedAt"
    `, [appId, authorName, rating, comment]);
    return result.rows[0];
  } catch (error) {
    console.error("submitUserReview failed, fallback to memory:", error);
    const newReview = {
      id: 'rev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      appId,
      authorName,
      rating: Number(rating),
      comment,
      submittedAt: new Date()
    };
    memoryReviews.push(newReview);
    return newReview;
  }
}

export async function fetchUserReviewsForApp(appId: string) {
  const provider = getActiveDbProvider();
  if (provider === 'firebase') {
    const firestore = getFirebaseFirestore();
    if (firestore) {
      try {
        const querySnapshot = await getDocs(collection(firestore, 'user_reviews'));
        const list: any[] = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.appId === appId || data.app_id === appId) {
            list.push({
              id: docSnap.id,
              appId: data.appId || data.app_id,
              authorName: data.authorName || data.author_name || 'Anonymous',
              rating: typeof data.rating === 'number' ? data.rating : (parseInt(data.rating) || 5),
              comment: data.comment || '',
              submittedAt: data.submittedAt ? new Date(data.submittedAt) : new Date()
            });
          }
        });
        return list.sort((a,b) => b.submittedAt.getTime() - a.submittedAt.getTime());
      } catch (err) {
        console.error("Firebase fetchUserReviewsForApp failed:", err);
      }
    }
  }

  if (useMemoryDb) {
    return memoryReviews.filter(r => r.appId === appId).sort((a,b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  }
  try {
    const result = await pool.query(`
      SELECT id, app_id as "appId", author_name as "authorName", rating, comment, submitted_at as "submittedAt" 
      FROM user_reviews 
      WHERE app_id = $1 
      ORDER BY submitted_at DESC
    `, [appId]);
    return result.rows;
  } catch (error) {
    console.error("fetchUserReviewsForApp failed, returning filtered memory list:", error);
    return memoryReviews.filter(r => r.appId === appId).sort((a,b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  }
}
