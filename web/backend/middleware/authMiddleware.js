const { auth } = require('../config/firebaseAdmin');

/**
 * Auth middleware that supports both:
 * 1. Session cookies (web app)
 * 2. Bearer tokens (mobile app)
 */
const verifyAuth = async (req, res, next) => {
  // Try Bearer token first (mobile app)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await auth.verifyIdToken(token);
      req.user = decodedToken;
      return next();
    } catch (error) {
      // Token invalid, fall through to session cookie
    }
  }

  // Try session cookie (web app)
  const sessionCookie = req.cookies?.session || '';
  if (sessionCookie) {
    try {
      const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
      req.user = decodedClaims;
      return next();
    } catch (error) {
      // Cookie invalid
    }
  }

  return res.status(401).json({ error: 'Unauthorized — no valid token or session' });
};

// Keep backward compat export name
const verifySessionCookie = verifyAuth;

module.exports = verifySessionCookie;
module.exports.verifyAuth = verifyAuth;
