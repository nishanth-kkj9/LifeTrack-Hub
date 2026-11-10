import express from 'express';
import http from 'http';
import { apiRouter } from '../server/apiRouter.ts';
import { createTestBearerToken } from './testAuthHelper.ts';

/**
 * Automated test harness verifying API router input validation,
 * crash resilience, authentication requirement, rate limiting, and accurate financial advice logic.
 */
async function runApiRouterTests() {
  console.log('--- Starting API Router Crash Resilience & Logic Tests ---');

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const validTokenUser1 = await createTestBearerToken('user-suite-1');
  const validTokenUser2 = await createTestBearerToken('user-suite-2');

  async function postJson(path: string, body: any, token: string | null = validTokenUser1) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${baseUrl}/api${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, body: json };
  }

  let passed = 0;
  let total = 0;
  function check(name: string, condition: boolean) {
    total++;
    if (condition) {
      passed++;
      console.log(`  ✓ ${name}`);
    } else {
      server.close();
      console.error(`  ✗ FAIL: ${name}`);
      throw new Error(`Test failed: ${name}`);
    }
  }

  try {
    // 0a. Test authentication: Missing Authorization header returns 401
    const unauthRes = await postJson('/gemini/breakdown', { title: 'Test Task' }, null);
    check('Request without token returns 401 Unauthorized', unauthRes.status === 401);

    // 0b. Test authentication: Malformed / wrong-audience token returns 401
    const badAudienceToken = await createTestBearerToken('user-bad', 'wrong-audience-id');
    const badTokenRes = await postJson('/gemini/breakdown', { title: 'Test Task' }, badAudienceToken);
    check('Request with invalid token returns 401 Unauthorized', badTokenRes.status === 401);

    // 0c. Test authentication: Valid token succeeds with 200
    const authSuccessRes = await postJson('/gemini/breakdown', { title: 'Valid Authenticated Task' }, validTokenUser1);
    check('Request with valid Firebase ID token returns 200', authSuccessRes.status === 200);

    // 1. Test VTU parse-marksheet with non-string usnHint (prevents .toUpperCase() crash)
    const res1 = await postJson('/vtu/parse-marksheet', {
      rawText: 'VTU Exam Results 2024 BCS301 CIE 45 SEE 48',
      usnHint: 12345, // Number instead of string
    });
    check('Non-string usnHint does not crash server', res1.status === 200 || res1.status === 400);

    // 2. Test study-guide with string topics instead of array (prevents .join() crash)
    const res2 = await postJson('/gemini/study-guide', {
      subject: 'Operating Systems',
      topics: 'Single Topic String', // String instead of Array
    });
    check('String topics does not crash /gemini/study-guide', res2.status === 200 && Boolean(res2.body.guide));

    // 3. Test deep-plan with object tasks instead of array (prevents .filter/.slice crash)
    const res3 = await postJson('/gemini/deep-plan', {
      tasks: { notAnArray: true }, // Object instead of Array
      exams: null,
    });
    check('Object tasks does not crash /gemini/deep-plan', res3.status === 200 && Boolean(res3.body.plan));

    // 4. Test financial advice: 0 income and 5,000 expense
    const res4 = await postJson('/gemini/finance-insights', {
      totalIncome: 0,
      totalExpense: 5000,
      budget: 0,
      transactions: [],
    });
    check('Financial analysis marks 0 income & 5000 expense as Over Budget', res4.body.healthStatus === 'Over Budget');
    check(
      'Financial summary mentions negative cash flow or deficit',
      res4.body.summary.includes('deficit') || res4.body.summary.includes('negative')
    );
    check('Financial advice formats with ₹ currency by default', res4.body.summary.includes('₹'));

    // 5. Test financial advice with healthy surplus
    const res5 = await postJson('/gemini/finance-insights', {
      totalIncome: 10000,
      totalExpense: 2000,
      budget: 5000,
      transactions: [],
    });
    check('Financial analysis marks low spending as Healthy', res5.body.healthStatus === 'Healthy');
    check('Healthy summary shows positive surplus', res5.body.summary.includes('surplus'));

    // 6. Test breakdown with invalid title
    const res6 = await postJson('/gemini/breakdown', {
      title: '',
    });
    check('Empty task title returns 400 Bad Request', res6.status === 400);

    // 7. Test breakdown with valid title
    const res7 = await postJson('/gemini/breakdown', {
      title: 'Prepare Machine Learning Presentation',
      category: 'study',
    });
    check('Valid task returns subtasks', res7.status === 200 && Array.isArray(res7.body.subtasks));

    // 8. Test Rate Limiter independence between distinct users:
    // User 1 exhausts their 30-request bucket. User 2's requests must still succeed.
    let user1Blocked = false;
    for (let i = 0; i < 35; i++) {
      const u1Res = await postJson('/gemini/breakdown', { title: `Rate limit bucket test ${i}` }, validTokenUser1);
      if (u1Res.status === 429) {
        user1Blocked = true;
        break;
      }
    }
    check('User 1 reaches rate limit and receives 429', user1Blocked);

    // User 2 sends request on the same connection/IP: User 2 has an independent bucket!
    const user2Res = await postJson('/gemini/breakdown', { title: 'User 2 Task' }, validTokenUser2);
    check(
      'User 2 gets independent rate-limit bucket (receives 200 while User 1 is rate limited)',
      user2Res.status === 200
    );

    console.log(`--- All ${passed}/${total} API Router Robustness Tests Passed Successfully ---`);
  } finally {
    server.close();
  }
}

runApiRouterTests().catch((e) => {
  console.error('API Router test runner failed:', e);
  process.exit(1);
});
