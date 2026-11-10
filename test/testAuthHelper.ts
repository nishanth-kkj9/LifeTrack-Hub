import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose';
import { setJwksClientForTest, getFirebaseProjectId } from '../server/auth.ts';

let isInitialized = false;
let privateKeyObj: any = null;

export async function initTestAuth() {
  if (isInitialized) return;
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  privateKeyObj = privateKey;

  const jwk = await exportJWK(publicKey);
  jwk.kid = 'lifetrack-test-key';
  jwk.alg = 'RS256';
  jwk.use = 'sig';

  const localJwks = createLocalJWKSet({ keys: [jwk] });
  setJwksClientForTest(localJwks);
  isInitialized = true;
}

export async function createTestBearerToken(uid = 'test-user-123', customAudience?: string): Promise<string> {
  await initTestAuth();
  const projectId = getFirebaseProjectId() || 'quadratic-chimera-skx2q';
  return new SignJWT({
    email: `${uid}@example.com`,
    user_id: uid,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'lifetrack-test-key' })
    .setIssuedAt()
    .setIssuer(`https://securetoken.google.com/${projectId}`)
    .setAudience(customAudience || projectId)
    .setSubject(uid)
    .setExpirationTime('2h')
    .sign(privateKeyObj);
}
