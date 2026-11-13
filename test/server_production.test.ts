import fs from 'fs';
import path from 'path';
import type { AddressInfo } from 'net';

async function runProductionServerTests() {
  console.log('--- Starting Production Server (Headers, CORS, Static Assets) Tests ---');

  const distAssetsDir = path.resolve(process.cwd(), 'dist', 'assets');
  if (!fs.existsSync(distAssetsDir)) {
    throw new Error('dist/assets directory does not exist. Run "npm run build" before running server_production.test.ts.');
  }

  const cssFile = fs.readdirSync(distAssetsDir).find((f) => f.endsWith('.css'));
  if (!cssFile) {
    throw new Error('No built CSS asset found in dist/assets/.');
  }

  const prevNodeEnv = process.env.NODE_ENV;
  const prevCorsOrigins = process.env.CORS_ORIGINS;
  process.env.NODE_ENV = 'production';
  process.env.CORS_ORIGINS = 'https://allowed.example';

  const { createAppServer } = await import('../server.ts');
  const server = await createAppServer({ port: 0, host: '127.0.0.1' });

  let passed = 0;
  let total = 0;
  function assert(name: string, condition: boolean, detail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ ${name}`);
    } else {
      console.error(`  ✗ FAIL: ${name}${detail ? ` (${detail})` : ''}`);
      throw new Error(`Test failed: ${name}`);
    }
  }

  try {
    const addr = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    // 1. Fetch built HTML root and check production CSP
    const htmlRes = await fetch(`${baseUrl}/`);
    assert('GET / returns HTTP 200', htmlRes.status === 200, `got ${htmlRes.status}`);
    const csp = htmlRes.headers.get('content-security-policy') || '';
    assert('CSP includes fonts.googleapis.com', csp.includes('fonts.googleapis.com'), csp);
    assert('CSP includes fonts.gstatic.com', csp.includes('fonts.gstatic.com'), csp);
    assert("CSP includes frame-ancestors 'self' in production", csp.includes("frame-ancestors 'self'"), csp);
    assert("CSP does not include 'unsafe-eval'", !csp.includes("'unsafe-eval'"), csp);

    const scriptSrcMatch = csp.match(/script-src\s+([^;]+)/i);
    const scriptSrc = scriptSrcMatch ? scriptSrcMatch[1] : '';
    assert("CSP script-src does not include 'unsafe-inline'", Boolean(scriptSrc) && !scriptSrc.includes("'unsafe-inline'"), scriptSrc);

    // 2. Fetch CSS asset WITHOUT Origin header
    const cssNoOrigin = await fetch(`${baseUrl}/assets/${cssFile}`);
    const cssContentType = cssNoOrigin.headers.get('content-type') || '';
    assert('GET /assets/*.css without Origin returns 200', cssNoOrigin.status === 200, `got ${cssNoOrigin.status}`);
    assert('GET /assets/*.css Content-Type contains text/css', cssContentType.includes('text/css'), cssContentType);

    // 3. Fetch CSS asset WITH third-party Origin header (must never 500 or block static assets)
    const cssWithOrigin = await fetch(`${baseUrl}/assets/${cssFile}`, {
      headers: { Origin: 'https://example.com' },
    });
    assert('GET /assets/*.css with Origin returns 200 (never 500)', cssWithOrigin.status === 200, `got ${cssWithOrigin.status}`);

    // 4. Fetch /api/health with disallowed Origin -> 200, no Access-Control-Allow-Origin
    const evilHealthRes = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://evil.example' },
    });
    assert('GET /api/health with disallowed Origin returns 200 (never 500)', evilHealthRes.status === 200, `got ${evilHealthRes.status}`);
    assert(
      'GET /api/health with disallowed Origin omits Access-Control-Allow-Origin',
      evilHealthRes.headers.get('access-control-allow-origin') === null,
      String(evilHealthRes.headers.get('access-control-allow-origin'))
    );

    // 5. Fetch /api/health with allowed Origin -> 200, echoes allowed Origin
    const allowedHealthRes = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'https://allowed.example' },
    });
    assert('GET /api/health with allowed Origin returns 200', allowedHealthRes.status === 200, `got ${allowedHealthRes.status}`);
    assert(
      'GET /api/health with allowed Origin sets Access-Control-Allow-Origin',
      allowedHealthRes.headers.get('access-control-allow-origin') === 'https://allowed.example',
      String(allowedHealthRes.headers.get('access-control-allow-origin'))
    );

    // 6. Unknown /api path returns JSON 404 (never HTML SPA fallback)
    const unknownApiRes = await fetch(`${baseUrl}/api/nonexistent-endpoint`);
    assert('GET /api/unknown returns 404', unknownApiRes.status === 404, `got ${unknownApiRes.status}`);

    console.log(`--- All ${passed}/${total} Production Server Tests Passed ---`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.env.NODE_ENV = prevNodeEnv;
    process.env.CORS_ORIGINS = prevCorsOrigins;
  }
}

runProductionServerTests();
