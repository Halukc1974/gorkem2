import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import sessionMemory from 'memorystore';
import { storage } from "./storage";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  let sessionStore: any = null;

  if (process.env.DATABASE_URL) {
    sessionStore = new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
      ttl: sessionTtl,
      tableName: "sessions",
    });
  } else {
    // Fallback to in-memory store for environments without a database (dev/cPanel quick start)
    const MemoryStore = sessionMemory(session);
    sessionStore = new MemoryStore({ checkPeriod: 86400000 }); // prune every 24h
    console.warn('DATABASE_URL not set — using in-memory session store (not persistent)');
  }

  return session({
    secret: process.env.SESSION_SECRET || "fallback-secret-for-development",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Google OAuth Strategy
  // Google OAuth Strategy: only register if credentials are provided
  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          callbackURL: "/api/auth/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            // Upsert user
            const user = await storage.upsertUser({
              googleId: profile.id,
              email: profile.emails?.[0]?.value || '',
              name: profile.displayName || '',
              picture: profile.photos?.[0]?.value,
              role: "user"
            });
            
            return done(null, user);
          } catch (error) {
            return done(error as Error, undefined);
          }
        }
      )
    );
  } else {
    console.warn('GOOGLE_CLIENT_ID/SECRET not set — skipping Google OAuth strategy registration');
  }

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Auth routes
  app.get("/api/auth/google", 
    passport.authenticate("google", { 
      scope: ["profile", "email"] 
    })
  );

  app.get("/api/auth/google/callback",
    passport.authenticate("google", { 
      failureRedirect: "/login-failed" 
    }),
    (req, res) => {
      res.redirect("/");
    }
  );

  // Firebase ID token -> create server session
  app.post('/api/auth/session', async (req, res) => {
    try {
      const { idToken } = req.body || {};
      if (!idToken) return res.status(400).json({ message: 'Missing idToken' });

      // Verify ID token with Firebase Admin (lazy init)
      let decoded: any = null;
      try {
        console.log('🔧 [DEBUG] Importing Firebase Admin...');
        const { getFirebaseAdmin } = await import('./firebaseAdmin');
        console.log('🔧 [DEBUG] getFirebaseAdmin type:', typeof getFirebaseAdmin);
        console.log('🔧 [DEBUG] Calling getFirebaseAdmin...');
        const admin = getFirebaseAdmin();
        console.log('🔧 [DEBUG] Firebase Admin initialized, verifying token...');
        decoded = await admin.auth().verifyIdToken(idToken);
        console.log('✅ [DEBUG] Firebase token verified successfully');
      } catch (err) {
        console.error('Firebase Admin not configured or token verification failed:', err);
        console.error('Error details:', err.stack);
        return res.status(500).json({ message: 'Server side Firebase Admin not configured' });
      }

      // Upsert user by email (or use uid field)
      const email = decoded.email || '';
      const uid = decoded.uid;

      const user = await storage.upsertUser({
        googleId: '',
        email,
        name: decoded.name || '',
        picture: decoded.picture || '',
        role: 'user'
      });

      // Manually establish session using passport
      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: 'Failed to create session' });
        res.json(user);
      });
    } catch (error: any) {
      console.error('Error verifying Firebase idToken:', error);
      res.status(401).json({ message: 'Invalid idToken' });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });
}

export const requireAuth: RequestHandler = (req, res, next) => {
  console.log('🔐 [DEBUG] requireAuth check:', {
    isAuthenticated: req.isAuthenticated(),
    userExists: !!(req as any).user,
    userEmail: ((req as any).user as any)?.email,
    sessionID: req.sessionID?.substring(0, 10) + '...'
  });
  
  if (req.isAuthenticated()) {
    return next();
  }
  console.log('❌ [DEBUG] Authentication failed - sending 401');
  res.status(401).json({ message: "Authentication required" });
};

export const requireAdmin: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated() && (req.user as any)?.role === "admin") {
    return next();
  }
  res.status(403).json({ message: "Admin access required" });
};