import express from 'express';
import http from 'http';
import { apiRouter } from '../server/apiRouter.ts';

/**
 * Automated test harness verifying API router input validation,
 * crash resilience, rate limiting, and accurate financial advice logic.
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

  async function postJson(path: string, body: any) {
    const res = await fetch(`${baseUrl}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    // 8. Test Rate Limiter anti-spoofing resilience:
    // Rotating X-Forwarded-For must NOT bypass rate limiter for requests from the same connection
    let blockedCount = 0;
    for (let i = 0; i < 35; i++) {
      const spoofRes = await fetch(`${baseUrl}/api/gemini/breakdown`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': `198.51.100.${(i % 250) + 1}`, // Rotating spoofed header
        },
        body: JSON.stringify({ title: `Rate limit probe ${i}` }),
      });
      if (spoofRes.status === 429) {
        blockedCount++;
      }
    }
    check(
      'Rotating X-Forwarded-For does not bypass rate limiter (excess requests blocked with 429)',
      blockedCount > 0
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
