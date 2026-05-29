import type { Page } from 'playwright';
import type { Detector, DetectorContext } from './context.js';
import type { RawFinding } from '../types.js';

const SUCCESS_RE = /(success|thank you|thanks|confirmed|order (placed|received)|received|we'?ll be in touch|check your email|submitted|saved|welcome)/i;
const SUBMIT_TEXT_RE = /(submit|create|sign ?up|register|continue|next|save|place order|pay|checkout|send|log ?in|sign ?in|subscribe|apply)/i;

interface Snapshot {
  url: string;
  textLen: number;
  alerts: number;
  invalidField: boolean;
  successText: boolean;
}

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate((successSrc) => {
    const re = new RegExp(successSrc, 'i');
    const text = document.body?.innerText || '';
    const alerts = document.querySelectorAll('[role="alert"], [aria-live], .error, .invalid, .field-error, [class*="error" i]').length;
    const invalidField = Array.from(document.querySelectorAll('input, select, textarea')).some(
      (el) => (el as HTMLInputElement).validity && !(el as HTMLInputElement).validity.valid,
    );
    return { url: location.href, textLen: text.length, alerts, invalidField, successText: re.test(text) };
  }, SUCCESS_RE.source);
}

async function fillForm(page: Page, formIdx: number, email: string): Promise<boolean> {
  const form = page.locator('form').nth(formIdx);
  const inputs = form.locator('input:visible, textarea:visible, select:visible');
  const n = await inputs.count().catch(() => 0);
  let filledAny = false;
  for (let i = 0; i < n; i++) {
    const el = inputs.nth(i);
    const type = (await el.getAttribute('type').catch(() => '') || '').toLowerCase();
    const name = ((await el.getAttribute('name').catch(() => '')) || '') + ' ' + ((await el.getAttribute('placeholder').catch(() => '')) || '');
    try {
      if (type === 'checkbox' || type === 'radio') { await el.check({ timeout: 1000 }); filledAny = true; }
      else if (type === 'email' || /email/i.test(name)) { await el.fill(email, { timeout: 1000 }); filledAny = true; }
      else if (type === 'password') { await el.fill('Passw0rd!23', { timeout: 1000 }); filledAny = true; }
      else if (type === 'tel' || /phone/i.test(name)) { await el.fill('5551234567', { timeout: 1000 }); filledAny = true; }
      else if (type === 'number') { await el.fill('1', { timeout: 1000 }); filledAny = true; }
      else if (type === '' || type === 'text' || type === 'search' || el) { await el.fill('QA Test 123', { timeout: 1000 }); filledAny = true; }
    } catch { /* skip uncooperative field */ }
  }
  return filledAny;
}

async function findSubmit(page: Page, formIdx: number) {
  const form = page.locator('form').nth(formIdx);
  let btn = form.locator('button[type="submit"], input[type="submit"]').first();
  if (await btn.count() === 0) {
    const buttons = form.locator('button, [role="button"]');
    const bn = await buttons.count();
    for (let i = 0; i < bn; i++) {
      const t = (await buttons.nth(i).innerText().catch(() => '')) || '';
      if (SUBMIT_TEXT_RE.test(t)) { btn = buttons.nth(i); break; }
      if (i === bn - 1) btn = buttons.first();
    }
  }
  return btn;
}

/**
 * Class 5 (broken forms) + class 9 (silent async). For each form we click the
 * submit control and assert SOMETHING observable happened (navigation, a
 * network call, a DOM change, a validation message, or a success message).
 * - nothing at all happened           -> form/submit-noop (the button is dead)
 * - a request fired but the UI is inert-> async/no-success-feedback (silent)
 * - an invalid email was accepted      -> form/no-validation
 * The clean control page's working form (which navigates on submit) is the
 * explicit false-positive guard.
 */
export const formsDetector: Detector = async (ctx: DetectorContext): Promise<RawFinding[]> => {
  const findings: RawFinding[] = [];
  const formCount = await ctx.page.locator('form').count().catch(() => 0);
  if (formCount === 0) return findings;

  const limit = Math.min(formCount, 2);
  for (let f = 0; f < limit; f++) {
    // ── Pass A: submit with valid values, observe any effect ──────────────
    await ctx.freshNavigate();
    const hasSubmit = (await findSubmit(ctx.page, f).then((b) => b.count()).catch(() => 0)) > 0;
    if (!hasSubmit) continue;

    await fillForm(ctx.page, f, 'qa.tester@example.org');
    const before = await snapshot(ctx.page);

    let postRequest = false;
    let anyRequest = false;
    const onReq = (req: import('playwright').Request) => {
      anyRequest = true;
      if (req.method() === 'POST' || req.method() === 'PUT' || req.method() === 'PATCH') postRequest = true;
    };
    ctx.page.on('request', onReq);
    const submit = await findSubmit(ctx.page, f);
    await submit.click({ timeout: 2000 }).catch(() => {});
    await ctx.page.waitForTimeout(1200);
    ctx.page.off('request', onReq);

    const after = await snapshot(ctx.page).catch(() => before);
    const urlChanged = after.url !== before.url;
    const domChanged = Math.abs(after.textLen - before.textLen) > 8;
    const newAlert = after.alerts > before.alerts || after.invalidField;
    const success = after.successText && !before.successText;
    const observableEffect = urlChanged || domChanged || newAlert || success || anyRequest;

    if (!observableEffect) {
      findings.push({
        ruleId: 'form/submit-noop',
        issueClass: 5,
        title: 'Submit button does nothing',
        severity: 'high',
        confidence: 'likely',
        steps: [`Navigate to ${ctx.route}`, 'Fill the form with valid values', 'Click the submit button', 'Nothing happens: no navigation, no request, no message, no visible change'],
        suggestedFix: 'Wire the submit handler (or form action). A dead submit button blocks the whole flow.',
        dedupeKey: `submit-noop:${f}`,
      });
    } else if (postRequest && !urlChanged && !domChanged && !success) {
      findings.push({
        ruleId: 'async/no-success-feedback',
        issueClass: 9,
        title: 'Form submits but shows no success feedback',
        severity: 'high',
        confidence: 'likely',
        steps: [`Navigate to ${ctx.route}`, 'Fill and submit the form', 'A request was sent, but the UI shows no success message, redirect, or change'],
        suggestedFix: 'Render a clear success state (message/redirect) after the request resolves; users cannot tell if the action worked.',
        needsOutOfBandVerification: true,
        dedupeKey: `no-success:${f}`,
      });
    }

    // ── Pass B: invalid email accepted with no validation ─────────────────
    const hasEmail = await ctx.page
      .locator('form').nth(f)
      .locator('input[type="email"], input[name*="email" i], input[placeholder*="email" i]')
      .count().catch(() => 0);
    if (hasEmail > 0) {
      await ctx.freshNavigate();
      await fillForm(ctx.page, f, 'notanemail');
      const b2 = await snapshot(ctx.page);
      const submit2 = await findSubmit(ctx.page, f);
      await submit2.click({ timeout: 2000 }).catch(() => {});
      await ctx.page.waitForTimeout(1000);
      const a2 = await snapshot(ctx.page).catch(() => b2);
      // Validation fired if the field is marked invalid or a new error appeared.
      const validationFired = a2.invalidField || a2.alerts > b2.alerts;
      if (!validationFired) {
        findings.push({
          ruleId: 'form/no-validation',
          issueClass: 5,
          title: 'Invalid email accepted without validation',
          severity: 'medium',
          confidence: 'likely',
          steps: [`Navigate to ${ctx.route}`, 'Enter an invalid email ("notanemail")', 'Submit the form', 'No validation error fires and the value is accepted'],
          suggestedFix: 'Validate the email field (use type="email" or explicit validation) and show an inline error for invalid input.',
          dedupeKey: `no-validation:${f}`,
        });
      }
    }
  }

  return findings;
};
