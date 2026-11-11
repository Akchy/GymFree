import { expect, test, type Page } from '@playwright/test';
import { basePath } from '../../vite.config';

/** First screen or setup, depending on whether the build has Supabase settings. */
const FIRST_SCREEN = /Let's set you up|Your gym plan, built around your week/;

/** Opens the app on a fresh device and starts without an account (works with or without Supabase settings). */
async function start(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: FIRST_SCREEN })).toBeVisible();
  const local = page.getByRole('button', { name: 'Use without an account' });
  if (await local.isVisible()) await local.click();
  await expect(page.getByRole('heading', { name: "Let's set you up" })).toBeVisible();
}

/** The main nav: a bottom bar on phones, a sidebar from 768px. */
function mainNav(page: Page) {
  return page.getByRole('navigation', { name: 'Main' });
}

/** Settings: the gear on Home (phones) or the pinned sidebar link (wide). */
async function openSettings(page: Page) {
  await page.goto('./#/');
  await page.getByRole('link', { name: 'Settings' }).click();
}

async function onboard(page: Page) {
  await page.getByText('Build muscle').click();
  await page.getByRole('button', { name: 'Next' }).click();
  // Routine: Tue, Thu, Sat; 45 minutes; gym equipment
  for (const d of ['Mon', 'Wed', 'Fri']) await page.getByRole('group', { name: 'Training days' }).getByText(d).click();
  for (const d of ['Tue', 'Thu', 'Sat']) await page.getByRole('group', { name: 'Training days' }).getByText(d).click();
  await page.getByText('Mostly sitting (desk job, little walking)').click();
  await page.getByText('Intermediate (6+ months)').click();
  await page.getByRole('group', { name: 'Equipment' }).getByText('Barbell & rack').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByText('This step is optional')).toBeVisible();
  await page.getByLabel('Nickname').fill('Riley');
  await page.getByLabel('Age').fill('29');
  await page.getByLabel('Height (cm)').fill('178');
  await page.getByLabel('Body weight (kg)').fill('74');
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: /Suggested plan: Build muscle/ })).toBeVisible();
  await expect(page.getByText(/kcal/)).toBeVisible();
  await page.getByRole('button', { name: 'Save my plan' }).click();
  await expect(page.getByRole('heading', { name: 'Hi, Riley' })).toBeVisible();
}

test.describe('GymFree end-to-end', () => {
  test('first run without an account: onboard and keep the data on this device', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    await start(page);
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await onboard(page);

    const stored = JSON.parse((await page.evaluate(() => localStorage.getItem('gymx:local')))!);
    expect(stored.state).toMatchObject({ goal: 'gain-muscle', profile: { name: 'Riley' } });
    expect(await page.evaluate(() => localStorage.getItem('gymx:mode'))).toBe('"local"');
    expect(consoleErrors).toEqual([]);
  });

  test('opens straight into the app after a reload (no lock)', async ({ page }) => {
    await start(page);
    await onboard(page);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Hi, Riley' })).toBeVisible();
    await page.goto('./#/settings');
    await expect(page.getByText(/passphrase|Lock now/i)).toHaveCount(0);
    await expect(page.getByText('Your data is stored on this device only.')).toBeVisible();
  });

  test('fixed plan: learn an exercise in place and come back to the plan', async ({ page }) => {
    await start(page);
    await onboard(page);
    await mainNav(page).getByRole('link', { name: 'Plan' }).click();
    await expect(page.getByRole('heading', { name: 'My weekly plan' })).toBeVisible();
    // Read-only: no form controls until the user chooses to edit
    await expect(page.locator('main input, main select')).toHaveCount(0);

    const firstItem = page.locator('.exercise-item').first();
    const exName = (await firstItem.locator('summary strong').textContent())!;
    await firstItem.locator('summary').click();
    const photo = firstItem.locator('.how-to .demo img').first();
    await expect(photo).toBeVisible();
    expect(await photo.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
    await expect(firstItem.locator('.how-to ol li').first()).toBeVisible();

    await firstItem.getByRole('link', { name: 'Open full guide' }).click();
    await expect(page.getByRole('heading', { name: exName })).toBeVisible();
    await page.getByRole('link', { name: '← Back to my plan' }).click();
    await expect(page.getByRole('heading', { name: 'My weekly plan' })).toBeVisible();

    // Browser back also returns to the plan
    await page.locator('.exercise-item').first().locator('summary').click();
    await page.getByRole('link', { name: 'Open full guide' }).first().click();
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'My weekly plan' })).toBeVisible();
  });

  test('workout mode: sideways swipes flip the page both ways, and nothing drags or zooms', async ({ page }) => {
    test.skip(test.info().project.name !== 'mobile', 'workout mode is for phones');
    await start(page);
    await onboard(page);
    await page.goto('./#/plan');
    await page.getByRole('link', { name: 'Start this workout' }).first().click();
    const card = page.locator('.reel-page').first();
    await expect(card).toBeVisible();
    await expect(page.locator('meta[name=viewport]')).toHaveAttribute('content', /user-scalable=no/);
    const cdp = await page.context().newCDPSession(page);
    const swipe = async (from: number, to: number, y: number) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from, y }] });
      for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from + ((to - from) * i) / 8, y: y + i }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    // Front → how-to → front, swiping left then right, over the photo and over the steps
    for (const [from, to, y, flipped] of [[320, 60, 500, true], [320, 60, 500, false], [60, 320, 300, true], [60, 320, 300, false]] as const) {
      await swipe(from, to, y);
      if (flipped) await expect(card).toHaveClass(/flipped/);
      else await expect(card).not.toHaveClass(/flipped/);
    }
    expect(await page.evaluate(() => [scrollX, document.querySelector('.reel-feed')!.scrollLeft, document.querySelector('.reel-feed')!.scrollTop])).toEqual([0, 0, 0]);
    await page.getByRole('link', { name: /Close workout/ }).click();
    await expect(page.locator('meta[name=viewport]')).not.toHaveAttribute('content', /user-scalable=no/);
  });

  test('edit the plan only when asked, then log a workout set by set', async ({ page }) => {
    await start(page);
    await onboard(page);
    await page.goto('./#/plan');
    await page.locator('section.plan-view').first().getByRole('link', { name: /^Edit / }).click();
    await expect(page.getByRole('heading', { name: /^Edit / })).toBeVisible();
    await expect(page.locator('.plan-day')).toHaveCount(1);
    const firstDay = page.locator('.plan-day').first();
    await firstDay.getByLabel('Day name').fill('Chest & Arms');
    await firstDay.getByLabel('Day name').blur();
    await firstDay.getByText('show all exercises').click();
    await firstDay.getByLabel(/^Add exercise to/).selectOption('hammer-curl');
    await expect(page.locator('.plan-day').first().getByRole('link', { name: 'Hammer Curl' })).toBeVisible();
    await page.getByRole('link', { name: 'Done' }).click();
    await expect(page.getByRole('heading', { name: 'My weekly plan' })).toBeVisible();
    const chestDay = page.locator('section.plan-view', { hasText: 'Chest & Arms' });
    await expect(chestDay.getByText('Hammer Curl')).toBeVisible();

    await chestDay.getByRole('link', { name: 'Start this workout' }).click();
    // Phones open workout mode (the list view is one link away); other devices the list view
    if (test.info().project.name === 'mobile') {
      await expect(page.locator('.reel-page').first()).toBeVisible();
      await expect(page.locator('.topbar')).toHaveCount(0);
      await page.getByRole('link', { name: 'Switch to list view' }).click();
    } else {
      await expect(page.locator('.reel')).toHaveCount(0);
    }
    await expect(page.getByRole('heading', { name: 'Chest & Arms' })).toBeVisible();
    // Every exercise starts with exactly one empty set
    const entries = page.locator('.log-entry');
    const count = await entries.count();
    for (let i = 0; i < count; i++) await expect(entries.nth(i).locator('.set-row')).toHaveCount(1);
    await expect(page.getByLabel('Hammer Curl set 1 reps')).toHaveValue('');

    const hammer = page.locator('.log-entry', { hasText: 'Hammer Curl' });
    await hammer.getByRole('button', { name: 'How to do Hammer Curl' }).click();
    await expect(hammer.locator('.how-to .demo img').first()).toBeVisible();

    await page.getByLabel('Hammer Curl set 1 reps').fill('12');
    await page.getByLabel('Hammer Curl set 1 weight (kg)').fill('14');
    await hammer.getByRole('button', { name: '+ Add set' }).click(); // re-renders the wheels onto the typed values
    // Turn the weight wheel one row down (2.5 kg rows; 14 sits on the 15 row), then step back with ↓.
    const weight = hammer.locator('.num-wheel', { has: page.getByLabel('Hammer Curl set 1 weight (kg)') });
    await weight.hover();
    await page.mouse.wheel(0, 34);
    await expect(page.getByLabel('Hammer Curl set 1 weight (kg)')).toHaveValue('17.5');
    await page.waitForTimeout(400); // a tap right after a flick is ignored (it is the flick ending)
    await weight.locator('.num-wheel-scroll').click({ position: { x: 20, y: 51 } }); // the middle row
    if (test.info().project.name === 'mobile') {
      // On a phone the wheel only turns: a tap neither types nor opens the keyboard.
      await expect(page.getByLabel('Hammer Curl set 1 weight (kg)')).not.toBeFocused();
      await expect(page.getByLabel('Hammer Curl set 1 weight (kg)')).toHaveAttribute('inputmode', 'none');
    } else {
      await expect(page.getByLabel('Hammer Curl set 1 weight (kg)')).toBeFocused();
    }
    await page.getByLabel('Hammer Curl set 1 weight (kg)').press('ArrowDown');
    await expect(page.getByLabel('Hammer Curl set 1 weight (kg)')).toHaveValue('15');
    await page.getByLabel('Hammer Curl set 2 reps').fill('10');
    await page.getByRole('button', { name: 'Save workout' }).click();

    await expect(page.getByRole('heading', { name: 'History', exact: true })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Workout saved');
    await expect(page.locator('a.history-row')).toHaveCount(1);
    await expect(page.locator('a.history-row')).toContainText('Chest & Arms');
    await expect(page.locator('a.history-row')).toContainText('1 ex');
    await page.getByRole('link', { name: 'Stats' }).click();
    await page.getByLabel('Exercise to chart').selectOption('hammer-curl');
    await expect(page.getByText(/Hammer Curl.*est\. 1RM/)).toBeVisible();

    await page.getByLabel(/^Weight \(kg\)/).fill('73.5');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByText(/Latest 73.5 kg/)).toBeVisible();
  });

  test('edit a past workout: change the reps, save, and see the new value', async ({ page }) => {
    await start(page);
    await onboard(page);
    await page.goto('./#/log/free');
    await page.getByLabel('Add exercise').selectOption('push-up');
    await page.getByLabel('Push-up set 1 reps').fill('12');
    await page.getByRole('button', { name: 'Save workout' }).click();
    await expect(page.getByRole('heading', { name: 'History', exact: true })).toBeVisible();
    await page.locator('a.history-row').first().click();
    await expect(page.locator('.detail-exercise')).toContainText('12');
    await page.getByRole('link', { name: 'Edit' }).click();
    await page.getByLabel('Push-up set 1 reps').fill('20');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('status')).toContainText('Workout updated');
    await expect(page.locator('.detail-exercise')).toContainText('20');
    await expect(page.locator('.detail-exercise')).not.toContainText('12');
  });

  test('controls follow the app theme (no stock dropdowns in setup)', async ({ page }) => {
    await start(page);
    await expect(page.locator('select')).toHaveCount(0);
    await page.getByText('Build muscle').click();
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.locator('main select')).toHaveCount(0);
    const chip = page.locator('label.chip', { hasText: '45 min' });
    const bg = await chip.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    // Remaining selects elsewhere are restyled, not native
    for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Save my plan' }).click();
    await page.goto('./#/exercises');
    const appearance = await page.getByLabel('Muscle group').evaluate((el) => getComputedStyle(el).appearance);
    expect(['none', 'base-select']).toContain(appearance);
    const cb = await page.locator('#only-mine').evaluate((el) => getComputedStyle(el).appearance);
    expect(cb).toBe('none');
  });

  test('extended library loads as it is needed', async ({ page, request }) => {
    await start(page);
    await onboard(page);
    expect(await (await request.get('sw.js')).text()).not.toContain('exercises/library/close-grip');
    await mainNav(page).getByRole('link', { name: 'Exercises' }).click();
    await page.getByText('only my equipment').click();
    const cards = page.locator('.exercise-card');
    await expect(cards).toHaveCount(24);
    await page.locator('.load-more').scrollIntoViewIfNeeded();
    await expect.poll(() => cards.count()).toBeGreaterThan(24);

    await page.goto('./#/exercises/close-grip-ez-bar-curl');
    await expect(page.getByRole('heading', { name: 'Close-Grip EZ Bar Curl' })).toBeVisible();
    await expect(page.locator('.detail ol li').first()).toBeVisible();
    const photo = page.locator('.demo-large img').first();
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  });

  test('exercise library shows animations and still images', async ({ page }) => {
    await start(page);
    await onboard(page);
    await mainNav(page).getByRole('link', { name: 'Exercises' }).click();
    await page.getByLabel('Muscle group').selectOption('legs');
    await page.getByPlaceholder('Search exercises').fill('squat');
    await expect(page.locator('.exercise-card').first()).toBeVisible();
    await page.getByRole('link', { name: /Barbell Back Squat/ }).click();
    await expect(page.getByRole('heading', { name: 'Barbell Back Squat' })).toBeVisible();
    const demo = page.locator('.demo-large .demo');
    await expect(demo).toHaveAttribute('aria-label', /animation/);
    // The end photo cross-fades over the start photo
    const endPhoto = demo.locator('img').nth(1);
    const opacities = new Set<string>();
    for (let i = 0; i < 8; i++) {
      opacities.add(await endPhoto.evaluate((el) => Number(getComputedStyle(el).opacity).toFixed(1)));
      await page.waitForTimeout(250);
    }
    expect(opacities.size).toBeGreaterThan(1);
    await page.getByRole('button', { name: 'Show still images' }).click();
    await expect(demo).toHaveAttribute('aria-label', /start and end position/);
    await expect(demo.getByText('1. Start')).toBeVisible();

    // Exercises without photos fall back to the stick-figure animation
    await page.goto('./#/exercises/burpee');
    await expect(page.locator('.demo-large svg')).toHaveAttribute('aria-label', /animation/);
  });

  test('reduced motion users get still images', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await start(page);
    await onboard(page);
    await page.goto('./#/exercises/push-up');
    await expect(page.locator('.demo-large .demo')).toHaveAttribute('aria-label', /start and end position/);
    await context.close();
  });

  test('settings: backup round-trip and delete data', async ({ page }) => {
    await start(page);
    await onboard(page);
    await openSettings(page);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download backup' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^gym-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const backupPath = await download.path();

    page.on('dialog', (d) => d.accept());
    await page.getByLabel('Type DELETE to confirm').fill('DELETE');
    await page.getByRole('button', { name: 'Delete all my data' }).click();
    await expect(page.getByRole('heading', { name: FIRST_SCREEN })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('gymx:local'))).toBeNull();

    // Start over, then restore the backup from settings (replaces current data)
    await start(page);
    await page.getByText('Build muscle').click();
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Save my plan' }).click();
    await page.goto('./#/settings');
    await page.getByLabel('Backup file').setInputFiles(backupPath);
    await page.getByRole('button', { name: 'Restore backup' }).click();
    await expect(page.getByRole('heading', { name: 'Hi, Riley' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Hi, Riley' })).toBeVisible();
  });

  test('number wheels turn with a finger swipe, without moving the page', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'touch only');
    await start(page);
    await onboard(page);
    await page.goto('./#/log/free');
    await page.getByLabel('Add exercise').selectOption('push-up');
    const reps = page.locator('.log-entry .num-wheel').first();
    await reps.scrollIntoViewIfNeeded();
    await expect(reps.locator('input')).toHaveValue('');
    const box = (await reps.boundingBox())!;
    const scrollY = await page.evaluate(() => window.scrollY);
    // A real touch drag (CDP touch events), finger moving up two rows: the values go up.
    const cdp = await page.context().newCDPSession(page);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2 + 30;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - 7 * i }] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(reps.locator('input')).not.toHaveValue('');
    expect(Number(await reps.locator('input').inputValue())).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  });

  test('bottom bar fits at 360px: no sideways scroll, each tab reachable', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await start(page);
    await onboard(page);
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await overflow()).toBeLessThanOrEqual(0);
    const nav = mainNav(page);
    await expect(nav).toBeVisible();
    const bar = (await nav.boundingBox())!;
    expect(bar.y + bar.height).toBeLessThanOrEqual(740);
    expect(bar.width).toBeLessThanOrEqual(360);
    for (const [name, heading] of [['History', 'History'], ['Plan', 'My weekly plan'], ['Exercises', 'Exercise library'], ['Home', 'Hi, Riley']] as const) {
      const link = nav.getByRole('link', { name });
      await expect(link).toBeVisible();
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await link.click();
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      await expect(link).toHaveAttribute('aria-current', 'page');
      expect(await overflow()).toBeLessThanOrEqual(0);
    }
    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page.getByText('Your data is stored on this device only.')).toBeVisible();
  });

  test('sidebar shows at 1280px with Settings pinned inside it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await start(page);
    await onboard(page);
    const nav = mainNav(page);
    const box = (await nav.boundingBox())!;
    expect(box.x).toBe(0);
    expect(box.width).toBeLessThan(300);
    expect(box.height).toBeGreaterThanOrEqual(780);
    for (const name of ['Home', 'History', 'Plan', 'Exercises', 'Settings']) await expect(nav.getByRole('link', { name })).toBeVisible();
    await nav.getByRole('link', { name: 'History' }).click();
    await expect(page.getByRole('heading', { name: 'History', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });

  test("never stuck on 'Loading…' when the app's files are missing (stale page after a deploy)", async ({ page }) => {
    await page.route(/\/assets\/main-[^/]+\.js$/, (route) => route.fulfill({ status: 404, body: 'Not found' }));
    await page.goto('./');
    await expect(page.getByText('Loading…')).toBeVisible();
    const reload = page.getByRole('link', { name: 'Reload' });
    await expect(reload).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Taking longer than usual.')).toBeVisible();
    await page.unroute(/\/assets\/main-[^/]+\.js$/);
    await reload.click();
    await expect(page.getByRole('heading', { name: FIRST_SCREEN })).toBeVisible();
  });

  test('installable and works fully offline after the first visit', async ({ page, context }) => {
    await page.goto('./');
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    const manifest = await (await page.request.get(manifestHref!)).json();
    expect(manifest).toMatchObject({ short_name: 'GymFree', display: 'standalone', start_url: './' });
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
    for (const icon of manifest.icons) expect((await page.request.get(icon.src)).ok()).toBe(true);

    // Service worker installs and precaches the whole app
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    const cached = await page.evaluate(async () => {
      const keys = await caches.keys();
      const cache = await caches.open(keys.find((k) => k.startsWith('gymfree-'))!);
      return (await cache.keys()).map((r) => new URL(r.url).pathname);
    });
    const base = basePath();
    expect(cached).toEqual(expect.arrayContaining([base, `${base}index.html`, `${base}manifest.webmanifest`, `${base}exercises/push-up-0.webp`]));

    await start(page);
    await onboard(page);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Hi, Riley' })).toBeVisible();
    await page.goto('./#/exercises/goblet-squat');
    const photo = page.locator('.demo-large img').first();
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBeGreaterThan(0);
    await page.goto('./#/settings');
    await expect(page.getByRole('heading', { name: 'Install & offline' })).toBeVisible();
    await context.setOffline(false);
  });

  test('ships a strict Content-Security-Policy and loads no third-party resources', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith('http://localhost:4173')) external.push(r.url());
    });
    await page.goto('./');
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    await expect(page.getByRole('heading', { name: FIRST_SCREEN })).toBeVisible();
    expect(external).toEqual([]);
  });
});
