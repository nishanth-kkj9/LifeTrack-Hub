import fs from 'fs';
import path from 'path';
import type { AddressInfo } from 'net';
import { getLocalDateString } from '../src/lib/dateUtils.ts';

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
  throw new Error('Could not locate playwright-core for headless Chromium layout test.');
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

function approxEq(actual: number, expected: number, tol = 1.5): boolean {
  return Math.abs(actual - expected) <= tol;
}

async function assertOverlayMatchesViewport(
  page: any,
  overlaySelector: string,
  closeButtonSelector: string,
  label: string
) {
  const overlayLoc = page.locator(overlaySelector).first();
  await overlayLoc.waitFor({ state: 'visible', timeout: 5000 });
  // Allow any enter transition/animation (>200ms) to finish before measuring
  await page.waitForTimeout(300);

  const viewport = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  }));
  const oRect = await overlayLoc.boundingBox();
  const closeLoc = overlayLoc.locator(closeButtonSelector).first();
  const cRect = await closeLoc.boundingBox();

  assert(oRect !== null, `${label}: overlay (${overlaySelector}) is present`);
  assert(
    oRect !== null &&
      approxEq(oRect.x, 0) &&
      approxEq(oRect.y, 0) &&
      approxEq(oRect.width, viewport.innerWidth) &&
      approxEq(oRect.height, viewport.innerHeight),
    `${label}: overlay bounding box (${Math.round(oRect!.x)},${Math.round(oRect!.y)},${Math.round(oRect!.width)},${Math.round(oRect!.height)}) equals viewport (0,0,${viewport.innerWidth},${viewport.innerHeight})`
  );
  assert(
    cRect !== null &&
      cRect.y >= 0 &&
      cRect.y + cRect.height <= viewport.innerHeight,
    `${label}: close button top (${cRect?.y.toFixed(1)}) >= 0 and within viewport height`
  );

  await closeLoc.click();
  await overlayLoc.waitFor({ state: 'detached', timeout: 5000 });
}

async function runBrowserOverlayLayoutTests() {
  console.log('--- Starting Headless Chromium Fixed Overlay & animate-fadeIn Layout Tests ---');

  const distAssetsDir = path.resolve(process.cwd(), 'dist', 'assets');
  if (!fs.existsSync(distAssetsDir)) {
    throw new Error('dist/assets directory does not exist. Run "npm run build" before running browser_overlay_layout.test.ts.');
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

    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    const pageErrors: string[] = [];
    page.on('pageerror', (err: Error) => pageErrors.push(err.message));

    const todayStr = getLocalDateString();
    const ts = Date.now();
    const seeded = {
      tasks: [
        {
          id: 'task-overlay-1',
          title: 'Calendar Overlay Test Task',
          category: 'study',
          priority: 'high',
          dueDate: todayStr,
          completed: false,
          subtasks: [],
          createdAt: ts,
          updatedAt: ts,
        },
      ],
      transactions: [
        {
          id: 'tx-overlay-1',
          title: 'Campus Coffee',
          amount: 120,
          type: 'expense',
          category: 'Food & Dining',
          date: todayStr,
          paymentMethod: 'UPI',
          createdAt: ts,
          updatedAt: ts,
        },
      ],
      exams: [],
      habits: [
        {
          id: 'habit-overlay-1',
          name: 'Morning Hydration',
          category: 'Health',
          targetDaysPerWeek: 7,
          completedDates: [todayStr],
          streak: 1,
          bestStreak: 1,
          createdAt: ts,
          updatedAt: ts,
        },
      ],
      notes: [],
      dailyMetrics: [],
      budget: { monthlyBudget: 5000, savingsGoal: 1000 },
      version: 1,
      lastUpdated: ts,
    };

    await page.addInitScript((payload: string) => {
      window.localStorage.setItem('lifetrack_app_data_v1', payload);
    }, JSON.stringify(seeded));

    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // 1. HabitsView -> Configure / Vacation (HabitDetailModal) & DailyLifeCheckinModal
    await page.click('#tab-nav-habits');
    await page.waitForSelector('#habits-view-container', { state: 'visible' });
    await page.waitForTimeout(350);

    const habitsStyle = await page.evaluate(() => {
      const el = document.getElementById('habits-view-container')!;
      const cs = window.getComputedStyle(el);
      return { transform: cs.transform, fillMode: cs.animationFillMode };
    });
    assert(
      habitsStyle.fillMode === 'backwards' && habitsStyle.transform === 'none',
      `#habits-view-container animationFillMode="${habitsStyle.fillMode}" and settled transform="${habitsStyle.transform}"`
    );

    // Scroll slightly so any transform-trapped fixed modal would shift upward
    await page.evaluate(() => window.scrollTo(0, 140));
    await page.getByRole('button', { name: 'Configure / Vacation' }).first().click();
    await assertOverlayMatchesViewport(
      page,
      '[role="dialog"][aria-labelledby="habit-detail-modal-title"]',
      'button[aria-label="Close modal"]',
      'HabitsView -> Configure / Vacation (HabitDetailModal)'
    );

    await page.click('#habits-open-checkin-btn');
    await assertOverlayMatchesViewport(
      page,
      '[role="dialog"][aria-labelledby="daily-checkin-modal-title"]',
      'button[aria-label="Close modal"]',
      'HabitsView -> Log Daily Metrics (DailyLifeCheckinModal)'
    );

    // 2. CalendarView -> Move Task Dialog (#calendar-move-task-dialog)
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click('#tab-nav-calendar');
    await page.waitForSelector('#calendar-view', { state: 'visible' });
    await page.waitForTimeout(350);

    const calendarTransform = await page.evaluate(
      () => window.getComputedStyle(document.getElementById('calendar-view')!).transform
    );
    assert(
      calendarTransform === 'none',
      `#calendar-view settled transform="${calendarTransform}"`
    );

    const taskChip = page.locator('[data-testid="calendar-task-chip"]').first();
    await taskChip.focus();
    await page.keyboard.press('m');
    await assertOverlayMatchesViewport(
      page,
      '#calendar-move-task-dialog[role="dialog"]',
      'button:has-text("Cancel")',
      'CalendarView -> Move Task Dialog'
    );

    // 3. FinancesView -> Edit Transaction Modal & Fixed Undo Toast
    await page.click('#tab-nav-finances');
    await page.waitForSelector('#finances-view-container', { state: 'visible' });
    await page.waitForTimeout(350);

    const financesTransform = await page.evaluate(
      () => window.getComputedStyle(document.getElementById('finances-view-container')!).transform
    );
    assert(
      financesTransform === 'none',
      `#finances-view-container settled transform="${financesTransform}"`
    );

    await page.click('#transaction-row-tx-overlay-1');
    await assertOverlayMatchesViewport(
      page,
      '#add-transaction-modal-backdrop[role="dialog"]',
      '#close-add-tx-modal-btn',
      'FinancesView -> Edit Transaction Modal (AddTransactionModal)'
    );

    await page.click('#transaction-delete-tx-overlay-1');
    await page.waitForSelector('#tx-undo-toast-banner', { state: 'visible' });
    const toastMetrics = await page.evaluate(() => {
      const r = document.getElementById('tx-undo-toast-banner')!.getBoundingClientRect();
      return {
        right: r.right,
        bottom: r.bottom,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
      };
    });
    assert(
      approxEq(toastMetrics.right, toastMetrics.innerWidth - 20, 4) &&
        approxEq(toastMetrics.bottom, toastMetrics.innerHeight - 20, 4),
      `FinancesView -> Undo delete toast anchored to viewport bottom-right (${Math.round(toastMetrics.right)},${Math.round(toastMetrics.bottom)} vs ${toastMetrics.innerWidth - 20},${toastMetrics.innerHeight - 20})`
    );
    await page.click('#tx-undo-toast-btn');

    // 4. InsightsView -> DailyLifeCheckinModal
    await page.click('#tab-nav-insights');
    await page.waitForSelector('#insights-view', { state: 'visible' });
    await page.waitForTimeout(350);

    const insightsTransform = await page.evaluate(
      () => window.getComputedStyle(document.getElementById('insights-view')!).transform
    );
    assert(
      insightsTransform === 'none',
      `#insights-view settled transform="${insightsTransform}"`
    );

    await page.getByRole('button', { name: 'Log Daily Check-In' }).click();
    await assertOverlayMatchesViewport(
      page,
      '[role="dialog"][aria-labelledby="daily-checkin-modal-title"]',
      'button[aria-label="Close modal"]',
      'InsightsView -> Log Daily Check-In (DailyLifeCheckinModal)'
    );

    // 5. AcademicsView -> VtuHubView Import Result Modal
    await page.click('#tab-nav-academics');
    await page.waitForSelector('#academics-view', { state: 'visible' });
    await page.click('#subtab-academics-vtu');
    await page.waitForSelector('#vtu-open-import-results-modal-btn', { state: 'visible' });
    await page.waitForTimeout(350);

    const academicsTransform = await page.evaluate(
      () => window.getComputedStyle(document.getElementById('academics-view')!).transform
    );
    assert(
      academicsTransform === 'none',
      `#academics-view settled transform="${academicsTransform}"`
    );

    await page.click('#vtu-open-import-results-modal-btn');
    await assertOverlayMatchesViewport(
      page,
      '#academics-view div.fixed.inset-0',
      'button:has-text("✕")',
      'AcademicsView -> VtuHubView Import Results Modal'
    );

    // 6. HabitsView 7-Day Grid Responsive Layout & Touch Targets (360px, 768px, 1280px)
    console.log('\n[6. HabitsView Responsive 7-Day Grid @ 360px, 768px, 1280px]');
    // Navigate via mobile/desktop nav to Habits
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.click('#tab-nav-habits');
    await page.waitForSelector('#habits-seven-day-card', { state: 'visible' });
    await page.waitForTimeout(350);

    // 6a. Desktop 1280px & Tablet 768px checks
    for (const width of [1280, 768]) {
      await page.setViewportSize({ width, height: 720 });
      await page.waitForTimeout(100);
      const desktopMetrics = await page.evaluate(() => {
        const scrollWidth = document.documentElement.scrollWidth;
        const innerWidth = window.innerWidth;
        const mobileHeader = document.querySelector('[data-testid="habits-mobile-weekday-header"]') as HTMLElement | null;
        const mobileHeaderDisplay = mobileHeader ? window.getComputedStyle(mobileHeader).display : 'missing';
        const deleteBtn = document.getElementById('habit-delete-habit-overlay-1') as HTMLElement | null;
        const deleteRect = deleteBtn ? deleteBtn.getBoundingClientRect() : null;
        const deleteAriaLabel = deleteBtn?.getAttribute('aria-label') || '';
        const row = document.getElementById('habit-row-habit-overlay-1')!;
        const infoCol = row.children[0].getBoundingClientRect();
        const checksCol = row.children[1].getBoundingClientRect();
        return {
          scrollWidth,
          innerWidth,
          mobileHeaderDisplay,
          deleteVisible: !!deleteRect && deleteRect.width > 0 && deleteRect.height > 0,
          deleteAriaLabel,
          horizontalNonOverlapping: infoCol.right <= checksCol.left + 1,
        };
      });
      assert(
        desktopMetrics.scrollWidth <= desktopMetrics.innerWidth,
        `HabitsView @ ${width}px: no horizontal page scroll (${desktopMetrics.scrollWidth} <= ${desktopMetrics.innerWidth})`
      );
      assert(
        desktopMetrics.mobileHeaderDisplay === 'none',
        `HabitsView @ ${width}px: mobile sticky header hidden (display=${desktopMetrics.mobileHeaderDisplay})`
      );
      assert(
        desktopMetrics.deleteVisible && desktopMetrics.deleteAriaLabel === 'Delete habit Morning Hydration',
        `HabitsView @ ${width}px: row delete button visible with aria-label`
      );
      assert(
        desktopMetrics.horizontalNonOverlapping,
        `HabitsView @ ${width}px: info column and 7-day checks sit side-by-side without overlap`
      );
    }

    // 6b. Mobile 360px checks: 3-line stacked row, sticky 3-letter weekday grid alignment, >=44x44 buttons, no horizontal scroll
    await page.setViewportSize({ width: 360, height: 720 });
    await page.waitForTimeout(150);

    const mobileMetrics = await page.evaluate(() => {
      const scrollWidth = document.documentElement.scrollWidth;
      const innerWidth = window.innerWidth;
      const mobileHeader = document.querySelector('[data-testid="habits-mobile-weekday-header"]') as HTMLElement | null;
      const headerCS = mobileHeader ? window.getComputedStyle(mobileHeader) : null;
      const headerCells = mobileHeader
        ? Array.from(mobileHeader.querySelectorAll('.grid > div')).map((el) => ({
            text: el.querySelector('span')?.textContent?.trim() || '',
            rect: el.getBoundingClientRect(),
          }))
        : [];
      const row = document.getElementById('habit-row-habit-overlay-1')!;
      const infoWrap = row.children[0] as HTMLElement;
      const line1 = infoWrap.children[0].getBoundingClientRect();
      const line2 = infoWrap.children[1].getBoundingClientRect();
      const line3 = row.children[1].getBoundingClientRect();
      const checkBtns = Array.from(
        row.querySelectorAll<HTMLButtonElement>('[id^="habit-check-habit-overlay-1-"]')
      ).map((btn) => ({
        id: btn.id,
        ariaLabel: btn.getAttribute('aria-label') || '',
        ariaPressed: btn.getAttribute('aria-pressed') || '',
        rect: btn.getBoundingClientRect(),
      }));
      const rowDeleteBtn = document.getElementById('habit-delete-habit-overlay-1');
      const rowDeleteDisplay = rowDeleteBtn ? window.getComputedStyle(rowDeleteBtn).display : 'missing';

      return {
        scrollWidth,
        innerWidth,
        headerPosition: headerCS?.position || '',
        headerDisplay: headerCS?.display || '',
        headerCells,
        stackedLines: line1.bottom <= line2.top + 1 && line2.bottom <= line3.top + 1,
        rowDeleteDisplay,
        checkBtns,
      };
    });

    assert(
      mobileMetrics.scrollWidth <= mobileMetrics.innerWidth,
      `HabitsView @ 360px: no horizontal page scroll (${mobileMetrics.scrollWidth} <= ${mobileMetrics.innerWidth})`
    );
    assert(
      mobileMetrics.headerDisplay !== 'none' && mobileMetrics.headerPosition === 'sticky',
      `HabitsView @ 360px: weekday header visible and sticky (position=${mobileMetrics.headerPosition})`
    );
    assert(
      mobileMetrics.headerCells.length === 7 &&
        mobileMetrics.headerCells.every((c) => /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/.test(c.text)),
      `HabitsView @ 360px: sticky header renders 7 three-letter weekday labels (${mobileMetrics.headerCells.map((c) => c.text).join(',')})`
    );
    assert(
      mobileMetrics.stackedLines,
      'HabitsView @ 360px: row stacks cleanly into line 1 (name+badges), line 2 (streak/best/configure), line 3 (7-day grid) with no overlap'
    );
    assert(
      mobileMetrics.rowDeleteDisplay === 'none',
      `HabitsView @ 360px: row delete button hidden on mobile (display=${mobileMetrics.rowDeleteDisplay})`
    );
    assert(
      mobileMetrics.checkBtns.length === 7 &&
        mobileMetrics.checkBtns.every((b) => b.rect.width >= 44 && b.rect.height >= 44),
      `HabitsView @ 360px: all 7 check buttons are >=44x44px (min=${Math.min(...mobileMetrics.checkBtns.map((b) => b.rect.width)).toFixed(1)}x${Math.min(...mobileMetrics.checkBtns.map((b) => b.rect.height)).toFixed(1)})`
    );
    assert(
      mobileMetrics.checkBtns.every((b, idx) => {
        const hRect = mobileMetrics.headerCells[idx].rect;
        return Math.abs(b.rect.x - hRect.x) <= 1.5 && Math.abs(b.rect.width - hRect.width) <= 1.5;
      }),
      'HabitsView @ 360px: each check button aligns with its sticky weekday header column'
    );
    assert(
      mobileMetrics.checkBtns.every(
        (b) =>
          /^Morning Hydration, (Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2} [A-Z][a-z]{2}, (done|not done)$/.test(
            b.ariaLabel
          ) && (b.ariaPressed === 'true' || b.ariaPressed === 'false')
      ),
      'HabitsView @ 360px: check buttons have full aria-label ("Habit, Day D Mon, done/not done") and aria-pressed'
    );

    // Toggle first check button and verify aria-pressed + aria-label update
    const firstCheckId = mobileMetrics.checkBtns[0].id;
    const beforePressed = mobileMetrics.checkBtns[0].ariaPressed;
    await page.click(`#${firstCheckId}`);
    const afterCheck = await page.evaluate((id: string) => {
      const el = document.getElementById(id)!;
      return {
        ariaPressed: el.getAttribute('aria-pressed'),
        ariaLabel: el.getAttribute('aria-label'),
      };
    }, firstCheckId);
    assert(
      afterCheck.ariaPressed !== beforePressed &&
        afterCheck.ariaLabel?.endsWith(afterCheck.ariaPressed === 'true' ? ', done' : ', not done'),
      `Check button toggle updates aria-pressed (${beforePressed} -> ${afterCheck.ariaPressed}) and aria-label`
    );

    // Open detail modal on 360px and verify delete button is accessible inside it
    await page.getByRole('button', { name: 'Configure / Vacation' }).first().click();
    const modalDeleteVisible = await page
      .locator('[role="dialog"] button[aria-label="Delete habit Morning Hydration"]')
      .isVisible();
    assert(
      modalDeleteVisible,
      'HabitsView @ 360px: Delete Habit button with aria-label is accessible inside detail modal'
    );
    await page.locator('[role="dialog"] button[aria-label="Close modal"]').click();

    assert(pageErrors.length === 0, `Zero uncaught page errors (got ${pageErrors.length})`);

    console.log('--- All Headless Chromium Overlay & animate-fadeIn Layout Tests Passed! ---');
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.env.NODE_ENV = prevNodeEnv;
  }
}

runBrowserOverlayLayoutTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
