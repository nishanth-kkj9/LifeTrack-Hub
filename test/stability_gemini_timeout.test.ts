/**
 * STABILITY REGRESSION SUITE: a hung Gemini upstream must never pin an API request.
 *
 * Background (empirically observed before the fix): generateContent calls had no
 * timeout; a wedged upstream kept the HTTP handler (and the user's UI spinner)
 * waiting indefinitely. Now every model call is bounded by withTimeout() and the
 * endpoint degrades to its deterministic heuristic fallback.
 *
 * Method: patch global fetch so every googleapis.com call returns a promise that
 * NEVER settles, then assert the endpoint responds within ~GEMINI_TIMEOUT_MS with
 * the fallback payload.
 */
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key-not-real';
process.env.GEMINI_TIMEOUT_MS = '1500';

const origFetch = globalThis.fetch;
(globalThis as any).fetch = (url: any, opts?: any) => {
  if (String(url).includes('googleapis.com')) {
    return new Promise(() => {}); // simulate wedged upstream — never resolves, never rejects
  }
  return (origFetch as any)(url, opts);
};

async function main() {
  console.log('--- Starting Gemini Timeout Stability Suite ---');
  const express = (await import('express')).default;
  const http = await import('http');
  const { apiRouter } = await import('../server/apiRouter.ts');

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as any).port;

  let passed = 0;
  const total = 3;
  function check(name: string, ok: boolean) {
    if (ok) { passed++; console.log(`  ✓ ${name}`); }
    else { console.error(`  ✗ FAIL: ${name}`); }
  }

  const t0 = Date.now();
  const res = await (origFetch as any)(`http://127.0.0.1:${port}/api/gemini/breakdown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Prepare for DBMS exam' }),
  });
  const json = await res.json();
  const elapsed = Date.now() - t0;

  check(`Hung upstream bounded near GEMINI_TIMEOUT_MS (elapsed ${elapsed}ms < 4000ms)`, elapsed < 4000);
  check('Endpoint still returns HTTP 200 with graceful degradation', res.status === 200);
  check('Heuristic fallback subtasks served despite wedged AI', Array.isArray(json.subtasks) && json.subtasks.length > 0);

  server.close();
  console.log(`--- ${passed}/${total} Gemini Timeout Stability Checks Passed ---`);
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
