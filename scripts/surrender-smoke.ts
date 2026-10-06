/**
 * Browser regression checks against a running local app. All inspection/appeal
 * requests are intercepted: this script never calls Gemini or uses an API key.
 *
 * CHAIR_BASE_URL=http://127.0.0.1:3100 PLAYWRIGHT_MODULE=/path/to/playwright \
 *   node --import tsx scripts/surrender-smoke.ts
 * PLAYWRIGHT_MODULE is optional when Playwright is installed locally.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { demos } from '../lib/demos';

const requireModule = createRequire(import.meta.url);
const { chromium } = requireModule(process.env.PLAYWRIGHT_MODULE || 'playwright');
const baseURL = process.env.CHAIR_BASE_URL || 'http://127.0.0.1:3100';
const victory = 'Took you a minute, but welcome to furniture science.';
type Reply = { objection: string; conceded: boolean; wait?: Promise<void>; status?: number };

async function main() {
  const artifacts = await mkdtemp(join(tmpdir(), 'chair-surrender-smoke-'));
  const blue = await sharp({ create: { width: 80, height: 120, channels: 3, background: '#0000ff' } }).png().toBuffer();
  const photo = await sharp({ create: { width: 160, height: 120, channels: 3, background: '#ff0000' } })
    .composite([{ input: blue, left: 80, top: 0 }]).png().toBuffer();
  const browser = await chromium.launch({ headless: true, channel: process.env.CHAIR_BROWSER_CHANNEL || 'chrome' });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors: string[] = [];
  const downloads: any[] = [];
  const replies: Reply[] = [];
  let report = demos[0].report;
  let appealCalls = 0;
  let inspectCalls = 0;
  let fixtureError: unknown;
  page.on('pageerror', (error: Error) => errors.push(error.message));
  page.on('download', (download: any) => downloads.push(download));
  await page.addInitScript(() => {
    const recorded = window as typeof window & { chairSmoke: { celebrations: number; scrolls: (string | undefined)[] } };
    recorded.chairSmoke = { celebrations: 0, scrolls: [] };
    const originalScroll = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (options?: boolean | ScrollIntoViewOptions) {
      recorded.chairSmoke.scrolls.push(typeof options === 'object' ? options.behavior : undefined);
      originalScroll.call(this, options);
    };
    new MutationObserver(records => {
      for (const record of records) for (const added of record.addedNodes) {
        if (added instanceof Element) {
          if (added.matches('[data-testid="confetti"]')) recorded.chairSmoke.celebrations++;
          recorded.chairSmoke.celebrations += added.querySelectorAll('[data-testid="confetti"]').length;
        }
      }
    }).observe(document, { subtree: true, childList: true });
  });
  await page.route('**/api/**', async (route: any) => {
    try {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === '/api/inspect') {
        inspectCalls++;
        return await route.fulfill({ json: { caseId: randomUUID(), report } });
      }
      assert.equal(path, '/api/appeal', 'Unexpected API request');
      if (request.method() === 'DELETE') return await route.fulfill({ status: 204 });
      appealCalls++;
      const body = request.postDataJSON();
      const reply = replies.shift();
      assert.ok(reply, `Unexpected appeal: ${body.objection}`);
      assert.equal(body.objection, reply.objection);
      if (reply.wait) await reply.wait;
      if (reply.status) return await route.fulfill({ status: reply.status, json: { error: 'The inspector is busy. Please retry.' } });
      await route.fulfill({ json: {
        response: reply.conceded ? 'Agreement recorded by the bureau.' : `Bureau response ${appealCalls}: the original verdict stands.`,
        conceded: reply.conceded,
        ...(body.demoId ? { concessionDetection: 'gemini' } : {}),
      } });
    } catch (error) {
      fixtureError = error;
      await route.abort().catch(() => {});
    }
  });
  const certificate = () => page.locator('.certificate-card');
  const certificateID = () => certificate().getAttribute('data-certificate-id');
  const celebrationCount = () => page.evaluate(() => (window as any).chairSmoke.celebrations);
  const surrenderButton = () => page.getByRole('button', { name: /🏳️ Surrender/ });
  const downloadLink = () => page.getByRole('link', { name: /Download certificate/ });
  async function inspect(verdict: 'CHAIR' | 'NOT A CHAIR' = 'CHAIR') {
    report = verdict === 'CHAIR' ? demos[0].report : demos[2].report;
    await page.locator('input[type="file"]').setInputFiles({ name: 'red-blue-suspect.png', mimeType: 'image/png', buffer: photo });
    await page.getByRole('button', { name: /Inspect this object/ }).click();
    await page.locator('.verdict').waitFor();
    assert.match(await page.locator('.verdict').innerText(), new RegExp(`^${verdict}`));
    assert.equal(await certificate().count(), 0, 'New inspection clears certificate');
    assert.equal(await page.getByText(victory, { exact: true }).count(), 0, 'New inspection clears victory');
    assert.equal(await page.locator('.appeal-response').count(), 0, 'New inspection clears debate');
  }
  async function send(objection: string, conceded = false) {
    const prior = await page.locator('.appeal-response').count();
    replies.push({ objection, conceded });
    await page.locator('#objection').fill(objection);
    await page.getByRole('button', { name: /Appeal verdict/ }).click();
    await page.waitForFunction((count: number) => document.querySelectorAll('.appeal-response').length === count, prior + 1);
    if (fixtureError) throw fixtureError;
    await page.waitForFunction(() => !(document.querySelector('#objection') as HTMLTextAreaElement).disabled);
  }
  async function accepted(objections: number, title = 'Official Certificate of Chairhood.') {
    await downloadLink().waitFor();
    assert.equal(await certificate().count(), 1);
    assert.equal(await page.getByText(victory, { exact: true }).count(), 1);
    assert.equal(await certificate().getByRole('heading', { name: title, exact: true }).count(), 1);
    assert.match(await certificate().innerText(), new RegExp(`Certified after ${objections} objections`));
    assert.match(await certificate().innerText(), /The holder initially resisted the findings\./);
    assert.ok(await certificateID());
    assert.ok(await certificate().locator('time').getAttribute('dateTime'));
    assert.equal(await page.locator('.certificate-preview').evaluate((img: HTMLImageElement) => img.naturalWidth), 2400);
    assert.equal(await page.locator('.certificate-preview').evaluate((img: HTMLImageElement) => img.naturalHeight), 1800);
  }
  async function downloadAndVerify(label: string, includesPhoto: boolean) {
    const pending = page.waitForEvent('download');
    await downloadLink().click();
    const download = await pending;
    const filename = download.suggestedFilename();
    assert.match(filename, /\.png$/);
    const path = join(artifacts, `${label}-${filename}`);
    await download.saveAs(path);
    const bytes = await readFile(path);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, 2400);
    assert.equal(metadata.height, 1800);
    if (includesPhoto) {
      const { data, info } = await sharp(bytes).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      let red = 0, bluePixels = 0;
      for (let i = 0; i < data.length; i += info.channels) {
        if (data[i] > 245 && data[i + 1] < 10 && data[i + 2] < 10) red++;
        if (data[i] < 10 && data[i + 1] < 10 && data[i + 2] > 245) bluePixels++;
      }
      assert.ok(red > 20000 && bluePixels > 20000, 'Downloaded PNG contains the actual two-color uploaded photo');
    }
    return filename;
  }
  function pass(message: string) { console.log(`PASS ${message}`); }

  try {
    await page.goto(baseURL);
    await inspect();
    await send('That is clearly lunch.');
    for (const falsePositive of ["It isn’t a chair", "You want me to say it’s a chair", 'What happens if I agree?']) {
      await send(falsePositive);
      assert.equal(await certificate().count(), 0, `Must not accept: ${falsePositive}`);
    }
    pass('Structured false responses preserve all objections and never accept negation, quotation, or hypothetical agreement');

    const callsBeforeButton = appealCalls;
    const celebrationsBefore = await celebrationCount();
    const downloadCount = downloads.length;
    await surrenderButton().evaluate((button: HTMLButtonElement) => { button.click(); button.click(); button.click(); });
    await accepted(4);
    assert.equal(appealCalls, callsBeforeButton, 'Button surrender makes no API call');
    assert.equal(downloads.length, downloadCount, 'Surrender never triggers automatic download');
    assert.equal(await celebrationCount(), celebrationsBefore + 1, 'Exactly one confetti celebration');
    assert.equal(await page.locator('.appeal-response').count(), 4, 'Entire debate survives surrender');
    assert.match(await certificate().innerText(), /Portable seating for ants/);
    assert.doesNotMatch(await certificate().innerText(), /DEMO/);
    assert.ok(await page.evaluate(() => (window as any).chairSmoke.scrolls.length > 0), 'Certificate brought into view');
    const stableID = await certificateID();
    const stableDate = await certificate().locator('time').getAttribute('dateTime');
    const firstFilename = await downloadAndVerify('chair-button', true);
    await page.screenshot({ path: join(artifacts, 'chair-button.png'), fullPage: true });
    pass('Button is immediate, idempotent across rapid clicks, preserves debate, scrolls to the certificate, and downloads a 2400×1800 PNG with the photo');

    await send('I still dispute the mayonnaise evidence.');
    await send("Okay, you win, it’s a chair.", true);
    await accepted(4);
    assert.equal(await certificateID(), stableID);
    assert.equal(await certificate().locator('time').getAttribute('dateTime'), stableDate);
    assert.equal(await celebrationCount(), celebrationsBefore + 1);
    assert.equal(await page.locator('.appeal-response').count(), 6);
    assert.equal(await downloadAndVerify('chair-repeat', true), firstFilename);
    pass('Continued argument and later agreement keep the same certificate ID/date/count, one victory, one celebration, and download');

    await inspect();
    await send('The bread is not load bearing.');
    const beforeChat = await celebrationCount();
    await send("Okay, you win, it’s a chair.", true);
    await accepted(1);
    assert.equal(await page.locator('.appeal-response').count(), 2, 'Concession remains in debate');
    assert.notEqual(await certificateID(), stableID);
    assert.equal(await celebrationCount(), beforeChat + 1);
    pass('Chat surrender uses structured conceded=true and excludes the concession itself from objection count');

    await inspect('NOT A CHAIR');
    assert.match(await surrenderButton().innerText(), /fine, it’s not a chair/);
    await send("Okay, it’s a chair.");
    assert.equal(await certificate().count(), 0, 'Agreement with opposite verdict must not accept');
    await send("Okay, you win, it’s not a chair.", true);
    await accepted(1, 'Certificate of Suspicious Non-Chair Status.');
    assert.match(await certificate().innerText(), /Table in witness protection/);
    await downloadAndVerify('non-chair-chat', true);
    pass('NOT A CHAIR reverses button wording and agreement target, issuing the non-chair certificate');

    await inspect('NOT A CHAIR');
    await surrenderButton().click();
    await accepted(0, 'Certificate of Suspicious Non-Chair Status.');
    pass('NOT A CHAIR button surrender issues a certificate with zero objections');

    for (const pendingConcession of [false, true]) {
      await inspect();
      let release!: () => void;
      const wait = new Promise<void>(resolve => { release = resolve; });
      const objection = pendingConcession ? 'I concede the chair verdict.' : 'I am filing a pending objection.';
      replies.push({ objection, conceded: pendingConcession, wait });
      const priorCalls = appealCalls;
      await page.locator('#objection').fill(objection);
      await page.getByRole('button', { name: /Appeal verdict/ }).click();
      await page.waitForFunction(() => (document.querySelector('#objection') as HTMLTextAreaElement).disabled);
      while (appealCalls === priorCalls) await new Promise(resolve => setTimeout(resolve, 10));
      const celebrations = await celebrationCount();
      assert.equal(await surrenderButton().isEnabled(), true, 'Button works during pending appeal');
      await surrenderButton().click();
      await certificate().waitFor();
      await page.locator('.certificate-preview').waitFor();
      assert.match(await certificate().innerText(), /Certified after 1 objections/);
      assert.equal(await page.getByRole('button', { name: /Download certificate/ }).isDisabled(), true, 'Download waits for final count');
      const pendingID = await certificateID();
      release();
      await page.waitForFunction(() => !(document.querySelector('#objection') as HTMLTextAreaElement).disabled);
      await accepted(pendingConcession ? 0 : 1);
      assert.equal(await certificateID(), pendingID, 'Pending response does not replace certificate');
      assert.equal(await celebrationCount(), celebrations + 1, 'Pending concession does not celebrate twice');
    }
    pass('Surrender works while an appeal is pending; resolved concession adjusts count without replacing or celebrating again');

    await inspect();
    replies.push({ objection: 'This objection encounters a provider failure.', conceded: false, status: 429 });
    await page.locator('#objection').fill('This objection encounters a provider failure.');
    await page.getByRole('button', { name: /Appeal verdict/ }).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.locator('.appeal-response').count(), 1, 'Failed submission stays visible');
    assert.match(await page.locator('.appeal-response').innerText(), /This objection encounters a provider failure\./);
    await surrenderButton().click();
    await accepted(1);
    pass('Failed submitted objection is retained in the debate and surrender count');

    await inspect();
    let releaseFailure!: () => void;
    const failWait = new Promise<void>(resolve => { releaseFailure = resolve; });
    replies.push({ objection: 'Pending objection will fail.', conceded: false, status: 429, wait: failWait });
    const callsBeforeFailure = appealCalls;
    await page.locator('#objection').fill('Pending objection will fail.');
    await page.getByRole('button', { name: /Appeal verdict/ }).click();
    while (appealCalls === callsBeforeFailure) await new Promise(resolve => setTimeout(resolve, 10));
    await surrenderButton().click();
    await certificate().waitFor();
    releaseFailure();
    await page.waitForFunction(() => !(document.querySelector('#objection') as HTMLTextAreaElement).disabled);
    await accepted(1);
    assert.match(await page.locator('.appeal-response').innerText(), /Pending objection will fail\./);
    pass('Pending provider failure retains objection and unlocks certificate download after surrender');

    await inspect();
    let releaseOld!: () => void;
    const oldWait = new Promise<void>(resolve => { releaseOld = resolve; });
    replies.push({ objection: 'Late concession from previous inspection.', conceded: true, wait: oldWait });
    await page.locator('#objection').fill('Late concession from previous inspection.');
    await page.getByRole('button', { name: /Appeal verdict/ }).click();
    await page.waitForFunction(() => (document.querySelector('#objection') as HTMLTextAreaElement).disabled);
    await page.getByRole('button', { name: /Cancel & reset/ }).click();
    releaseOld();
    await page.getByRole('button', { name: /The sandwich/ }).click();
    assert.equal(await certificate().count(), 0);
    assert.equal(await page.locator('.appeal-response').count(), 0);
    await surrenderButton().click();
    await accepted(0);
    assert.match(await certificate().innerText(), /DEMO/);
    await downloadAndVerify('demo', false);
    pass('Reset ignores stale in-flight results and scripted sample certificates are labeled DEMO');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: /Inspect another/ }).click();
    await page.getByRole('button', { name: /The actual chair/ }).click();
    const reducedBefore = await celebrationCount();
    await surrenderButton().click();
    await accepted(0, 'Certificate of Suspicious Non-Chair Status.');
    assert.equal(await celebrationCount(), reducedBefore, 'Reduced motion suppresses confetti');
    assert.equal(await page.locator('[data-testid="confetti"]').count(), 0);
    const reducedScroll = await page.evaluate(() => (window as any).chairSmoke.scrolls.at(-1));
    assert.notEqual(reducedScroll, 'smooth', 'Reduced motion suppresses smooth scrolling');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(artifacts, 'mobile-reduced-motion-demo.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Mobile page has no horizontal overflow');
    pass('Reduced motion suppresses confetti/smooth scroll; certificate remains available on mobile');

    if (fixtureError) throw fixtureError;
    assert.deepEqual(errors, [], 'No browser runtime errors');
    assert.equal(replies.length, 0, 'Every expected appeal was exercised');
    console.log(`Verified ${inspectCalls} photo inspections, ${appealCalls} mocked appeals. Artifacts: ${artifacts}`);
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
