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
  throw new Error('Could not locate playwright-core for headless Chromium Notes UX test.');
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runNotesUxResponsiveBrowserTests() {
  console.log('--- Starting Headless Chromium Notes UX, Keyboard & 360/768/1280px Tests ---');

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

    const now = Date.now();
    const yesterday = now - 2 * 86_400_000;
    const seeded = {
      tasks: [],
      transactions: [],
      exams: [],
      habits: [],
      notes: [
        {
          id: 'note-ux-1',
          title: 'Fourier Identities',
          content: 'Verify **Parseval** theorem at https://example.com/math',
          category: 'Formulas',
          pinned: true,
          createdAt: yesterday,
          contentUpdatedAt: now - 5 * 60_000,
          updatedAt: now - 5 * 60_000,
        },
        {
          id: 'note-ux-2',
          title: 'Lecture Checklist',
          content: '- [x] Review slides\n- [ ] Solve problems',
          category: 'Study',
          pinned: false,
          createdAt: yesterday,
          contentUpdatedAt: yesterday,
          updatedAt: yesterday,
        },
      ],
      dailyMetrics: [],
      budget: { monthlyBudget: 0, savingsGoal: 0 },
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
    await page.click('#mobile-more-disclosure button:has-text("Notes & Scratchpad")');
    await page.waitForSelector('#notes-view-container', { state: 'visible' });
    await page.waitForTimeout(250);

    // 1. Verify 360px layout: no horizontal overflow, single compact stats row (text-sm), search + New Note on one line, tabs scroll snap + fade
    const metrics360 = await page.evaluate(() => {
      const docOverflow = document.documentElement.scrollWidth > window.innerWidth;
      const searchBox = document.getElementById('notes-search-input')!.getBoundingClientRect();
      const addBtnBox = document.getElementById('notes-add-note-btn')!.getBoundingClientRect();
      const statsRow = document.getElementById('notes-stats-row')!;
      const statCards = Array.from(statsRow.children).map((el) => ({
        text: el.textContent || '',
        rect: el.getBoundingClientRect(),
        valueFontSize: window.getComputedStyle(el.querySelectorAll('p')[1]).fontSize,
      }));
      const tabsScroll = document.getElementById('notes-category-tabs-scroll')!;
      const tabsFade = document.getElementById('notes-category-tabs-fade')!;
      const fadeRect = tabsFade.getBoundingClientRect();
      const tabsCs = window.getComputedStyle(tabsScroll);
      const pinnedBtnBox = document.getElementById('notes-pinned-only-btn')!.getBoundingClientRect();
      const tabsWrapperBox = document.getElementById('notes-category-tabs-wrapper')!.getBoundingClientRect();

      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        docOverflow,
        searchBox: { left: searchBox.left, right: searchBox.right, top: searchBox.top, bottom: searchBox.bottom },
        addBtnBox: { left: addBtnBox.left, right: addBtnBox.right, top: addBtnBox.top, bottom: addBtnBox.bottom },
        statCardsCount: statCards.length,
        statTopsEqual: statCards.every((c) => Math.abs(c.rect.top - statCards[0].rect.top) <= 2),
        statLabels: statCards.map((c) => c.text),
        statFontSizes: statCards.map((c) => c.valueFontSize),
        tabsScrollType: tabsCs.scrollSnapType,
        tabsScrollable: tabsScroll.scrollWidth > tabsScroll.clientWidth,
        fadeWidth: fadeRect.width,
        tabsWrapperBottom: tabsWrapperBox.bottom,
        pinnedBtnTop: pinnedBtnBox.top,
      };
    });

    assert(
      !metrics360.docOverflow,
      `360px has zero horizontal page scroll (${metrics360.scrollWidth} <= ${metrics360.innerWidth})`
    );
    assert(
      Math.abs(metrics360.searchBox.top - metrics360.addBtnBox.top) <= 6 &&
        metrics360.searchBox.right <= metrics360.addBtnBox.left + 1 &&
        metrics360.addBtnBox.right <= metrics360.innerWidth,
      `360px keeps search + New Note on one line with zero overlap`
    );
    assert(
      metrics360.statCardsCount === 3 &&
        metrics360.statTopsEqual &&
        metrics360.statLabels.some((t) => t.includes('Total Notes') && t.includes('2')) &&
        metrics360.statLabels.some((t) => t.includes('Pinned') && t.includes('1')) &&
        metrics360.statLabels.some((t) => t.includes('Updated today') && t.includes('1')) &&
        metrics360.statLabels.every((t) => !t.includes('Total Words') && !t.includes('Topics & Categories')) &&
        metrics360.statFontSizes.every((fs) => fs === '14px'),
      '360px renders Total Notes, Pinned, and Updated today in one compact text-sm (14px) row'
    );
    assert(
      metrics360.tabsScrollType.includes('x') &&
        metrics360.tabsScrollable &&
        metrics360.fadeWidth >= 16 &&
        metrics360.pinnedBtnTop >= metrics360.tabsWrapperBottom - 1,
      '360px category tabs have scroll snap, horizontal scroll, gradient fade edge, and zero overlap'
    );

    // 2. Verify 768px & 1280px viewports
    for (const vp of [
      { width: 768, height: 900 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(vp);
      await page.waitForTimeout(150);
      const vpMetrics = await page.evaluate(() => {
        const searchBox = document.getElementById('notes-search-input')!.getBoundingClientRect();
        const addBtnBox = document.getElementById('notes-add-note-btn')!.getBoundingClientRect();
        const tabsWrapperBox = document.getElementById('notes-category-tabs-wrapper')!.getBoundingClientRect();
        const pinnedBtnBox = document.getElementById('notes-pinned-only-btn')!.getBoundingClientRect();
        const card1 = document.getElementById('note-card-note-ux-1')!.getBoundingClientRect();
        const card2 = document.getElementById('note-card-note-ux-2')!.getBoundingClientRect();
        return {
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          searchRight: searchBox.right,
          addBtnLeft: addBtnBox.left,
          addBtnRight: addBtnBox.right,
          tabsRight: tabsWrapperBox.right,
          pinnedLeft: pinnedBtnBox.left,
          cardsOverlap:
            !(card1.right <= card2.left + 1 || card2.right <= card1.left + 1 || card1.bottom <= card2.top + 1 || card2.bottom <= card1.top + 1),
        };
      });
      assert(
        vpMetrics.scrollWidth <= vpMetrics.innerWidth &&
          vpMetrics.searchRight <= vpMetrics.addBtnLeft + 1 &&
          vpMetrics.addBtnRight <= vpMetrics.innerWidth &&
          vpMetrics.tabsRight <= vpMetrics.pinnedLeft + 1 &&
          !vpMetrics.cardsOverlap,
        `${vp.width}px layout has zero horizontal scroll and zero element overlap (${JSON.stringify(vpMetrics)})`
      );
    }

    // 3. Quick Capture keyboard shortcuts (Esc when empty, Esc asks "Discard draft?" when non-empty, Ctrl+Enter saves)
    await page.click('#notes-quick-capture-trigger');
    await page.waitForSelector('#notes-quick-title-input', { state: 'visible' });
    await page.press('#notes-quick-title-input', 'Escape');
    assert(
      (await page.locator('#notes-quick-capture-form').count()) === 0,
      'Quick capture Esc closes immediately when empty without discard prompt'
    );

    await page.click('#notes-quick-capture-trigger');
    await page.fill('#notes-quick-title-input', 'Keyboard Shortcut Note');
    await page.fill('#notes-quick-content-input', 'Saved with Ctrl+Enter');
    await page.press('#notes-quick-content-input', 'Escape');
    const discardPrompt = page.locator('#notes-quick-discard-prompt');
    await discardPrompt.waitFor({ state: 'visible' });
    assert(
      ((await discardPrompt.textContent()) || '').includes('Discard draft?'),
      'Quick capture Esc shows "Discard draft?" prompt when text exists'
    );

    await page.click('#notes-quick-discard-cancel-btn');
    await discardPrompt.waitFor({ state: 'detached' });
    assert(
      (await discardPrompt.count()) === 0 &&
        (await page.inputValue('#notes-quick-title-input')) === 'Keyboard Shortcut Note',
      'Clicking "Keep writing" dismisses prompt and preserves draft text'
    );

    await page.press('#notes-quick-content-input', 'Control+Enter');
    await page.waitForSelector('#notes-quick-capture-form', { state: 'detached' });
    const bodyTextAfterQuickSave = await page.locator('#notes-view-container').textContent();
    assert(
      (bodyTextAfterQuickSave || '').includes('Keyboard Shortcut Note') &&
        (bodyTextAfterQuickSave || '').includes('Saved with Ctrl+Enter'),
      'Quick capture Ctrl+Enter saves new note and closes quick capture'
    );

    // 4. In-card Edit: finish-other-note guard, Esc cancels, Ctrl+Enter saves
    await page.click('#note-edit-note-ux-1');
    await page.waitForSelector('#note-edit-content-note-ux-1', { state: 'visible' });
    await page.fill('#note-edit-content-note-ux-1', 'Unsaved edit draft');

    // Attempt to edit note 2 while note 1 is still being edited
    await page.click('#note-edit-note-ux-2');
    const noticeLoc = page.locator('#note-edit-notice-note-ux-2');
    await noticeLoc.waitFor({ state: 'visible' });
    assert(
      ((await noticeLoc.textContent()) || '').includes('Finish editing the other note') &&
        (await page.inputValue('#note-edit-content-note-ux-1')) === 'Unsaved edit draft' &&
        (await page.locator('#note-edit-form-note-ux-2').count()) === 0,
      'Clicking Edit on another card keeps first edit intact, saves nothing, and shows "Finish editing the other note"'
    );

    // Esc cancels first card edit without saving
    await page.press('#note-edit-content-note-ux-1', 'Escape');
    await page.waitForSelector('#note-edit-form-note-ux-1', { state: 'detached' });
    assert(
      ((await page.locator('#note-card-note-ux-1').textContent()) || '').includes('Parseval') &&
        !((await page.locator('#note-card-note-ux-1').textContent()) || '').includes('Unsaved edit draft'),
      'In-card edit Esc cancels without saving unsaved changes'
    );

    // Re-open Edit on note 1 and save with Ctrl+Enter
    await page.click('#note-edit-note-ux-1');
    await page.fill('#note-edit-content-note-ux-1', 'Updated via Ctrl+Enter');
    await page.press('#note-edit-content-note-ux-1', 'Control+Enter');
    await page.waitForSelector('#note-edit-form-note-ux-1', { state: 'detached' });
    assert(
      ((await page.locator('#note-card-note-ux-1').textContent()) || '').includes('Updated via Ctrl+Enter'),
      'In-card edit Ctrl+Enter saves changes cleanly'
    );

    // 5. Empty state "No notes match these filters" + "Clear filters"
    await page.click('#notes-pinned-only-btn');
    await page.fill('#notes-search-input', 'nonexistent-xyz-term');
    const emptyStateLoc = page.locator('#notes-empty-state');
    await emptyStateLoc.waitFor({ state: 'visible' });
    assert(
      ((await emptyStateLoc.textContent()) || '').includes('No notes match these filters') &&
        (await page.locator('#notes-clear-filters-btn').count()) === 1,
      'Empty state shows "No notes match these filters" and "Clear filters" when filters are active'
    );

    await page.click('#notes-clear-filters-btn');
    await page.waitForSelector('#note-card-note-ux-1', { state: 'visible' });
    assert(
      (await page.inputValue('#notes-search-input')) === '' &&
        (await page.locator('#note-card-note-ux-2').count()) === 1,
      '"Clear filters" resets search, pin, and category filters and restores notes'
    );

    assert(pageErrors.length === 0, `Zero uncaught page errors (got ${pageErrors.length})`);

    console.log('--- All Headless Chromium Notes UX, Keyboard & 360/768/1280px Tests Passed! ---');
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.env.NODE_ENV = prevNodeEnv;
  }
}

runNotesUxResponsiveBrowserTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
