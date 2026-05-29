import type { Detector, DetectorContext } from './context.js';
import type { RawFinding } from '../types.js';

const FORWARD_RE = /\b(next|continue|forward|proceed|step\s?2|go on)\b/i;
const BACK_RE = /\b(back|previous|prev|go back)\b/i;
const FINISH_RE = /\b(finish|done|complete|submit|next|continue|confirm)\b/i;
const PRIMARY_ACTION_RE = /\b(checkout|buy now|buy|purchase|add to cart|place order|get started|sign\s?up|start free|book now|proceed to|continue to)\b/i;
const SENTINEL = 'SNIFFSTATE12345';

/**
 * Class 6 (state-loss), class 7 (flow dead-end), class 12 (unclear action).
 */
export const flowDetector: Detector = async (ctx: DetectorContext): Promise<RawFinding[]> => {
  const findings: RawFinding[] = [];

  // ── State-loss + dead-end (multi-step flows only) ─────────────────────
  await ctx.freshNavigate();
  const trackSel = await ctx.page
    .evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input')) as HTMLInputElement[];
      const el = inputs.find((i) => {
        const t = (i.type || 'text').toLowerCase();
        const s = getComputedStyle(i);
        return ['text', 'email', 'search', 'tel', ''].includes(t) && s.display !== 'none' && s.visibility !== 'hidden';
      });
      if (!el) return null;
      if (el.id) return `#${CSS.escape(el.id)}`;
      if (el.name) return `[name="${CSS.escape(el.name)}"]`;
      return null;
    })
    .catch(() => null);

  const forward = ctx.page.locator('button:visible, a:visible, [role="button"]').filter({ hasText: FORWARD_RE }).first();
  const hasForward = (await forward.count().catch(() => 0)) > 0;

  if (trackSel && hasForward) {
    await ctx.page.fill(trackSel, SENTINEL, { timeout: 1500 }).catch(() => {});
    await forward.click({ timeout: 2000 }).catch(() => {});
    await ctx.page.waitForTimeout(800);

    // Dead-end: after advancing, fill any inputs on this step then look for a
    // forward/finish control that is permanently disabled with no enabled path.
    await ctx.page.locator('input[type="checkbox"]:visible').first().check({ timeout: 800 }).catch(() => {});
    const deadEnd = await ctx.page
      .evaluate((sources: string[]) => {
        const [finishSrc, fwdSrc] = sources;
        const finishRe = new RegExp(finishSrc, 'i');
        const fwdRe = new RegExp(fwdSrc, 'i');
        const ctrls = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="submit"]')) as HTMLElement[];
        const visible = ctrls.filter((c) => {
          const s = getComputedStyle(c);
          const r = c.getBoundingClientRect();
          return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
        });
        const forwardish = visible.filter((c) => finishRe.test(c.textContent || '') || fwdRe.test(c.textContent || ''));
        if (forwardish.length === 0) return false;
        const anyEnabled = forwardish.some((c) => !(c as HTMLButtonElement).disabled && c.getAttribute('aria-disabled') !== 'true');
        return !anyEnabled; // a forward/finish control exists but all are disabled
      }, [FINISH_RE.source, FORWARD_RE.source])
      .catch(() => false);

    if (deadEnd) {
      findings.push({
        ruleId: 'flow/dead-end',
        issueClass: 7,
        title: 'Multi-step flow dead-ends (no enabled way forward)',
        severity: 'high',
        confidence: 'likely',
        steps: [`Navigate to ${ctx.route}`, 'Advance past the first step', 'Fill the step inputs', 'The only forward/finish control stays disabled — the flow cannot be completed'],
        suggestedFix: 'Enable the forward/finish control when the step is valid, or provide another way to complete the flow.',
        dedupeKey: 'dead-end',
      });
    }

    // Go back and check the earlier field survived.
    const back = ctx.page.locator('button:visible, a:visible, [role="button"]').filter({ hasText: BACK_RE }).first();
    if ((await back.count().catch(() => 0)) > 0) {
      await back.click({ timeout: 2000 }).catch(() => {});
    } else {
      await ctx.page.goBack({ timeout: 3000 }).catch(() => {});
    }
    await ctx.page.waitForTimeout(700);

    const restored = await ctx.page.locator(trackSel).inputValue({ timeout: 1500 }).catch(() => null);
    if (restored !== null && restored !== SENTINEL) {
      findings.push({
        ruleId: 'flow/state-loss',
        issueClass: 6,
        title: 'Form state lost on back navigation',
        severity: 'high',
        confidence: 'likely',
        steps: [`Navigate to ${ctx.route}`, `Enter a value in the first field`, 'Advance to the next step', 'Go back', 'The value was wiped (state not preserved)'],
        suggestedFix: 'Preserve multi-step form state (keep it in state/store or restore it on back) so users do not lose their progress.',
        dedupeKey: 'state-loss',
      });
    }
  }

  // ── Unclear / buried primary action (class 12) ────────────────────────
  await ctx.freshNavigate().catch(() => {});
  const buried = await ctx.page
    .evaluate((actionSrc) => {
      const re = new RegExp(actionSrc, 'i');
      // Anchors only: tiny buttons are a tap-target concern (handled separately);
      // this detector is about navigation CTAs that are visually buried.
      const els = Array.from(document.querySelectorAll('a[href]')) as HTMLElement[];
      const out: Array<{ text: string; reason: string }> = [];
      for (const el of els) {
        const text = (el.textContent || '').trim();
        if (!text || !re.test(text)) continue;
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        const fontSize = parseFloat(s.fontSize) || 16;
        const opacity = parseFloat(s.opacity);
        const offscreen = r.right < 0 || r.bottom < 0 || r.left > (window.innerWidth || 1280);
        let reason = '';
        if (fontSize < 12) reason = `tiny font (${fontSize}px)`;
        else if (!Number.isNaN(opacity) && opacity < 0.4) reason = `near-transparent (opacity ${opacity})`;
        else if (r.width > 0 && r.width < 8) reason = 'almost zero width';
        else if (offscreen) reason = 'positioned off-screen';
        if (reason) out.push({ text: text.slice(0, 40), reason });
      }
      return out;
    }, PRIMARY_ACTION_RE.source)
    .catch(() => []);

  for (const b of buried) {
    findings.push({
      ruleId: 'flow/unclear-action',
      issueClass: 12,
      title: `Primary action "${b.text}" is hard to find`,
      severity: 'low',
      confidence: 'uncertain',
      steps: [`Navigate to ${ctx.route}`, `The primary action "${b.text}" is rendered with low prominence: ${b.reason}`],
      suggestedFix: 'Give the primary action clear visual prominence (readable size, sufficient contrast, obvious placement).',
      dedupeKey: `unclear:${b.text}`,
    });
  }

  return findings;
};
