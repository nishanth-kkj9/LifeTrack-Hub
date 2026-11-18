import fs from 'fs';
import path from 'path';
import type { AddressInfo } from 'net';

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
  candidates.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/google/chrome');
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
  throw new Error('Could not locate playwright-core for headless Chromium NoteDetailModal test.');
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

async function runNoteDetailBrowserTests() {
  console.log('--- Starting Headless Chromium NoteDetailModal & 6-Line Clamp Tests ---');

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

    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();

    const pageErrors: string[] = [];
    page.on('pageerror', (err: Error) => pageErrors.push(err.message));

    const ts = Date.now();
    const fourteenLines = Array.from({ length: 14 }, (_, i) => `Line ${i + 1}: detail row`).join('\n');
    const threeLines = 'Line 1\nLine 2\nLine 3';

    const seeded = {
      tasks: [],
      transactions: [],
      exams: [],
      habits: [],
      notes: [
        {
          id: 'note-14-browser',
          title: 'Fourteen Line Browser Note',
          content: fourteenLines,
          category: 'Formulas',
          pinned: false,
          createdAt: ts - 60_000,
          contentUpdatedAt: ts - 60_000,
          updatedAt: ts - 60_000,
        },
        {
          id: 'note-3-browser',
          title: 'Three Line Browser Note',
          content: threeLines,
          category: 'Study',
          pinned: false,
          createdAt: ts - 120_000,
          contentUpdatedAt: ts - 120_000,
          updatedAt: ts - 120_000,
        },
      ],
      dailyMetrics: [],
      budget: { monthlyBudget: 0, savingsGoal: 0 },
      version: 1,
      lastUpdated: ts,
    };

    await page.addInitScript((dataStr: string) => {
      localStorage.setItem('lifetrack_app_data_v1', dataStr);
    }, JSON.stringify(seeded));

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.click('#tab-nav-notes');
    await page.waitForSelector('#notes-view-container', { state: 'visible' });
    await page.waitForTimeout(300);

    // 1. Measure 6-line clamp geometry in Chromium: height === 6 * lineHeight (no partial 7th line)
    const clampMetrics = await page.evaluate(() => {
      const longEl = document.getElementById('note-preview-note-14-browser')!;
      const shortEl = document.getElementById('note-preview-note-3-browser')!;
      const csLong = window.getComputedStyle(longEl);
      const csShort = window.getComputedStyle(shortEl);
      const longRect = longEl.getBoundingClientRect();
      const shortRect = shortEl.getBoundingClientRect();
      return {
        longLineHeight: parseFloat(csLong.lineHeight),
        longMaxHeight: parseFloat(csLong.maxHeight),
        longOverflow: csLong.overflow,
        longHeight: longRect.height,
        longClientHeight: longEl.clientHeight,
        longScrollHeight: longEl.scrollHeight,
        shortLineHeight: parseFloat(csShort.lineHeight),
        shortHeight: shortRect.height,
        hasShowMoreLong: Boolean(document.getElementById('note-show-more-note-14-browser')),
        hasShowMoreShort: Boolean(document.getElementById('note-show-more-note-3-browser')),
      };
    });

    assert(
      approxEq(clampMetrics.longHeight, clampMetrics.longLineHeight * 6, 0.5) &&
        approxEq(clampMetrics.longMaxHeight, clampMetrics.longLineHeight * 6, 0.5) &&
        clampMetrics.longOverflow === 'hidden' &&
        clampMetrics.longScrollHeight > clampMetrics.longClientHeight,
      `14-line card preview clips cleanly at exactly 6 lines (${clampMetrics.longHeight}px == 6 * ${clampMetrics.longLineHeight}px, scrollHeight=${clampMetrics.longScrollHeight}px, zero half-line)`
    );
    assert(
      clampMetrics.hasShowMoreLong === true && clampMetrics.hasShowMoreShort === false,
      `"Show more" shows on 14-line note and stays hidden on 3-line note (${clampMetrics.shortHeight}px)`
    );

    // 2. Open 14-line note via title click -> overlay bounding box equals viewport + shows "Line 14"
    await page.click('#note-open-title-note-14-browser');
    const overlayLoc = page.locator('#note-detail-modal-backdrop[role="dialog"]');
    await overlayLoc.waitFor({ state: 'visible', timeout: 5000 });

    const viewport = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    }));
    const oRect = await overlayLoc.boundingBox();
    const closeRect = await overlayLoc.locator('#close-note-detail-modal-btn').boundingBox();
    const detailText = await page.locator('#note-detail-content').textContent();

    assert(
      oRect !== null &&
        approxEq(oRect.x, 0) &&
        approxEq(oRect.y, 0) &&
        approxEq(oRect.width, viewport.innerWidth) &&
        approxEq(oRect.height, viewport.innerHeight),
      `NoteDetailModal overlay bounding box (${Math.round(oRect!.x)},${Math.round(oRect!.y)},${Math.round(oRect!.width)},${Math.round(oRect!.height)}) equals viewport (0,0,${viewport.innerWidth},${viewport.innerHeight})`
    );
    assert(
      closeRect !== null && closeRect.y >= 0 && closeRect.y + closeRect.height <= viewport.innerHeight,
      'NoteDetailModal close button is inside viewport'
    );
    assert(
      (detailText || '').includes('Line 14: detail row'),
      'Opening 14-line note displays "Line 14" inside NoteDetailModal'
    );

    // 3. Escape closes NoteDetailModal
    await page.keyboard.press('Escape');
    await overlayLoc.waitFor({ state: 'detached', timeout: 5000 });
    assert(
      (await overlayLoc.count()) === 0,
      'Pressing Escape closes NoteDetailModal in browser'
    );

    assert(pageErrors.length === 0, `Zero uncaught page errors (got ${pageErrors.length})`);

    console.log('--- All Headless Chromium NoteDetailModal & 6-Line Clamp Tests Passed! ---');
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.env.NODE_ENV = prevNodeEnv;
  }
}

runNoteDetailBrowserTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
