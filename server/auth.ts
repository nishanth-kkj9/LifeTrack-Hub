import { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify, JWTVerifyGetKey } from 'jose';
import firebaseConfig from '../firebase-applet-config.json';

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let activeJwksClient: JWTVerifyGetKey = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

/**
 * Allows automated test suites to mock or inject local RS256 keys without hitting external Google JWKS.
 */
export function setJwksClientForTest(client: JWTVerifyGetKey | null) {
  activeJwksClient = client || createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
}

/**
 * Resolves the active Firebase project ID.
 * Returns undefined if no project ID can be resolved, triggering a fail-closed 500 response.
 */
export function getFirebaseProjectId(): string | undefined {
  const configured =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    firebaseConfig?.projectId;
  return configured && configured.trim().length > 0 ? configured.trim() : undefined;
}

/**
 * Express middleware requiring a valid Firebase ID token in the Authorization header.
 * Verifies RS256 signatures against Google's public JWK set, matching issuer and audience.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const projectId = getFirebaseProjectId();
  if (!projectId) {
    return res.status(500).json({
      error: 'Server configuration error: FIREBASE_PROJECT_ID is not configured',
    });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized: Missing or malformed Authorization header. Please provide a Bearer token.',
    });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized: Empty Bearer token provided.',
    });
  }

  try {
    const { payload } = await jwtVerify(token, activeJwksClient, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
    });

    const uid = payload.sub;
    if (!uid) {
      return res.status(401).json({ error: 'Unauthorized: Token payload missing sub identifier' });
    }

    res.locals.uid = uid;
    res.locals.tokenPayload = payload;
    next();
  } catch (err: any) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid or expired token',
      details: err?.message || 'Verification failed',
    });
  }
}
