import fs from 'fs';
import path from 'path';
import type { AddressInfo } from 'net';
import { getLocalDateOffset, getLocalDateString } from '../src/lib/dateUtils.ts';

const PLAYWRIGHT_CORE_PATHS = [
  '/usr/local/share/bun-global/node_modules/playwright-core/index.mjs',
  'playwright-core',
];

function findChromiumExecutable(): string | undefined {
  const candidates: string[] = [];
  const msPlaywrightDir = '/ms-playwright';
  if (fs.existsSync(msPlaywrightDir)) {
    for (const entry of fs.readdirSync(msPlaywrightDir)) {
      if (entry.startsWith('chromium_headless_shell-')) {
        candidates.push(
          path.join(msPlaywrightDir, entry, 'chrome-headless-shell-linux64', 'chrome-headless-shell')
        );
      } else if (entry.startsWith('chromium-')) {
        candidates.push(path.join(msPlaywrightDir, entry, 'chrome-linux', 'chrome'));
      }
    }
  }
  candidates.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome');
  return candidates.find((p) => fs.existsSync(p));
}

async function loadPlaywrightCore(): Promise<any> {
  for (const modPath of PLAYWRIGHT_CORE_PATHS) {
    try {
      return await import(modPath);
    } catch {
      // try next path
    }
  }
  throw new Error('Could not locate playwright-core for headless Chromium Insights browser test.');
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runInsightsLayoutBrowserTests() {
  console.log('--- Starting Headless Chromium Insights Deduplication & 360/1280px Tests ---');

  const distAssetsDir = path.resolve(process.cwd(), 'dist', 'assets');
  if (!fs.existsSync(distAssetsDir)) {
    throw new Error('dist/assets directory does not exist. Run "npm run build" first.');
  }

  const prevNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  const { createAppServer } = await import('../server.ts');
  const server = await createAppServer({ port: 0, host: '127.0.0.1' });

  const { chromium } = await loadPlaywrightCore();
  const executablePath = findChromiumExecutable();
  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const addr = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    const today = new Date();
    const todayStr = getLocalDateString(today);
    const now = Date.now();

    const seeded = {
      tasks: [
        {
          id: 't-1',
          title: 'Finish assignment',
          category: 'study',
          priority: 'high',
          dueDate: todayStr,
          completed: true,
          completedAt: now - 3600_000,
          subtasks: [],
          createdAt: now - 86_400_000,
        },
        {
          id: 't-2',
          title: 'Prepare lab notes',
          category: 'study',
          priority: 'medium',
          dueDate: getLocalDateOffset(-1, today),
          completed: false,
          subtasks: [],
          createdAt: now - 2 * 86_400_000,
        },
        {
          id: 't-3',
          title: 'Revise graphs',
          category: 'study',
          priority: 'low',
          dueDate: getLocalDateOffset(2, today),
          completed: false,
          subtasks: [],
          createdAt: now - 86_400_000,
        },
      ],
      transactions: [
        {
          id: 'tx-1',
          title: 'Monthly Spend',
          amount: 20000,
          type: 'expense',
          category: 'Food & Dining',
          date: todayStr,
          paymentMethod: 'UPI',
          createdAt: now - 1000,
        },
      ],
      exams: [
        {
          id: 'ex-1',
          subject: 'Algorithms',
          examDate: getLocalDateOffset(5, today),
          examTime: '09:30',
          status: 'studying',
          topics: [],
          createdAt: now - 1000,
        },
      ],
      habits: [
        {
          id: 'h-1',
          name: 'Morning Walk',
          targetDaysPerWeek: 7,
          completedDates: [todayStr, getLocalDateOffset(-1, today)],
          streak: 2,
          bestStreak: 2,
          createdAt: now - 7 * 86_400_000,
          scheduleType: 'daily',
        },
      ],
      notes: [],
      dailyMetrics: [
        { id: 'm1', date: getLocalDateOffset(-4, today), sleepHours: 5.5, moodLevel: 2, energyLevel: 2, updatedAt: now },
        { id: 'm2', date: getLocalDateOffset(-3, today), sleepHours: 6.0, moodLevel: 3, energyLevel: 3, updatedAt: now },
        { id: 'm3', date: getLocalDateOffset(-2, today), sleepHours: 7.0, moodLevel: 4, energyLevel: 3, updatedAt: now },
        { id: 'm4', date: getLocalDateOffset(-1, today), sleepHours: 7.5, moodLevel: 4, energyLevel: 4, updatedAt: now },
        { id: 'm5', date: todayStr, sleepHours: 8.5, moodLevel: 5, energyLevel: 5, updatedAt: now },
      ],
      budget: { monthlyBudget: 15000, savingsGoal: 5000 },
      version: 1,
      lastUpdated: now,
    };

    const context = await browser.newContext({ viewport: { width: 360, height: 800 } });
    const page = await context.newPage();

    const pageErrors: string[] = [];
    page.on('pageerror', (err: Error) => pageErrors.push(err.message));

    await page.addInitScript((dataStr: string) => {
      localStorage.setItem('lifetrack_app_data_v1', dataStr);
    }, JSON.stringify(seeded));

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.click('#mobile-nav-more');
    await page.waitForSelector('#mobile-more-disclosure', { state: 'visible' });
    await page.click('#mobile-more-disclosure button:has-text("Insights & Review")');
    await page.waitForSelector('#insights-view', { state: 'visible' });
    await page.waitForTimeout(250);

    const checkLayout = async () => {
      return page.evaluate(() => {
        const container = document.getElementById('insights-view')!;
        const text = container.textContent || '';
        const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4')).map((el) =>
          (el.textContent || '').trim()
        );
        const insightsHeadings = headings.filter((h) => h === 'Insights');
        const lifeOverviewHeadings = headings.filter((h) => h === 'Life overview');

        // Count how many times "Done this period" appears in #insights-view (must be exactly 1 after deduplication)
        const doneThisPeriodMatches = (text.match(/Done this period/g) || []).length;

        // Check tap target heights >= 44px for all visible interactive controls inside #insights-view
        const interactive = Array.from(container.querySelectorAll('button, label'));
        const smallTargets = interactive
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              label: (el.textContent || '').trim(),
              width: r.width,
              height: r.height,
            };
          })
          .filter((item) => item.width > 0 && item.height > 0 && item.height < 43.5);

        return {
          overflowX: document.documentElement.scrollWidth > window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          insightsHeadingsCount: insightsHeadings.length,
          lifeOverviewHeadingsCount: lifeOverviewHeadings.length,
          doneThisPeriodMatches,
          smallTargets,
          text,
        };
      });
    };

    const m360 = await checkLayout();
    assert(
      !m360.overflowX,
      `360px viewport has zero horizontal overflow (${m360.scrollWidth} <= ${m360.innerWidth})`
    );
    assert(
      m360.smallTargets.length === 0,
      `360px all Insights interactive tap targets are >= 44px (violations: ${JSON.stringify(m360.smallTargets)})`
    );
    assert(
      m360.insightsHeadingsCount === 1 && m360.lifeOverviewHeadingsCount === 1 && m360.doneThisPeriodMatches === 1,
      `360px renders 1 "Insights" heading, 1 "Life overview" heading, and 1 stat row (got insights=${m360.insightsHeadingsCount}, overview=${m360.lifeOverviewHeadingsCount}, doneRow=${m360.doneThisPeriodMatches})`
    );
    assert(
      !m360.text.includes('FxLifeSheet') &&
        !m360.text.includes('Loop Analytics') &&
        !m360.text.includes('Real-Time Synthesis') &&
        !m360.text.includes('Weekly Correlations & Recommendations') &&
        !m360.text.includes('Life Insights') &&
        !m360.text.includes('Steady progress in motion.') &&
        m360.text.includes('Room to grow'),
      '360px removes jargon/duplicate sections and replaces "Steady progress in motion." with data-driven "Room to grow"'
    );

    // Verify 1280px viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(200);

    const m1280 = await checkLayout();
    assert(
      !m1280.overflowX,
      `1280px viewport has zero horizontal overflow (${m1280.scrollWidth} <= ${m1280.innerWidth})`
    );
    assert(
      m1280.insightsHeadingsCount === 1 &&
        m1280.lifeOverviewHeadingsCount === 1 &&
        m1280.doneThisPeriodMatches === 1,
      `1280px renders 1 "Insights" heading, 1 "Life overview" heading, and 1 stat row`
    );

    // Check strong-week data-driven headline when >= 70% tasks completed (fresh context so addInitScript doesn't overwrite localStorage)
    const strongContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const strongPage = await strongContext.newPage();
    strongPage.on('pageerror', (err: Error) => pageErrors.push(err.message));
    const seededStrong = {
      ...seeded,
      tasks: seeded.tasks.map((t) => ({ ...t, completed: true, completedAt: now })),
    };
    await strongPage.addInitScript((dataStr: string) => {
      localStorage.setItem('lifetrack_app_data_v1', dataStr);
    }, JSON.stringify(seededStrong));
    await strongPage.goto(baseUrl, { waitUntil: 'networkidle' });
    await strongPage.click('#tab-nav-insights');
    await strongPage.waitForSelector('#insights-view', { state: 'visible' });
    await strongPage.waitForTimeout(200);
    const strongText = (await strongPage.locator('#insights-view').textContent()) || '';
    assert(
      strongText.includes('Strong week') && !strongText.includes('Steady progress in motion.'),
      'Completion >= 70% renders data-driven "Strong week" headline'
    );
    await strongContext.close();

    assert(pageErrors.length === 0, `Zero uncaught page errors (got ${pageErrors.length})`);

    console.log('--- All Headless Chromium Insights Deduplication & 360/1280px Tests Passed! ---');
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.env.NODE_ENV = prevNodeEnv;
  }
}

runInsightsLayoutBrowserTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
