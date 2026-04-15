import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { ExplorationProvider } from '../ai/types.js';
import type { PageState, ExplorationActionLog, ExplorationDecision } from './types.js';
import { selectPayload } from './edge-cases.js';

const execFile = promisify(execFileCb);

const VALID_ACTIONS = new Set(['click', 'fill', 'navigate', 'scroll', 'done']);

/**
 * Claude Code CLI-based ExplorationProvider.
 * Falls back to a deterministic heuristic if the CLI is unavailable.
 */
export class ClaudeExplorationProvider implements ExplorationProvider {
  async decideNextAction(
    pageState: PageState,
    history: ExplorationActionLog[],
  ): Promise<ExplorationDecision> {
    try {
      return await this.callClaude(pageState, history);
    } catch (err) {
      // Fallback on ENOENT (CLI not installed) or any other error
      if (
        err instanceof Error &&
        'code' in err &&
        (err as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        return this.deterministicFallback(pageState, history);
      }
      // On any other error (timeout, parse failure, etc.), also fall back
      return this.deterministicFallback(pageState, history);
    }
  }

  private async callClaude(
    pageState: PageState,
    history: ExplorationActionLog[],
  ): Promise<ExplorationDecision> {
    const systemPrompt = `You are a chaos monkey exploring a web application to find bugs.
You will be given the current page state (URL, title, interactive elements, form fields) and recent action history.
Respond with ONLY a JSON object matching this shape:
{
  "action": "click" | "fill" | "navigate" | "scroll" | "done",
  "selector": "CSS selector for click/fill targets",
  "value": "value to fill for fill actions — use edge-case data like XSS payloads, SQL injection, Unicode, boundary values",
  "url": "URL for navigate actions",
  "reasoning": "why you chose this action"
}

Priorities:
1. Fill form fields with hostile/edge-case values (XSS, SQLi, Unicode, boundary)
2. Click submit buttons to trigger form validation
3. Click buttons and interactive elements not yet visited
4. Navigate to unvisited links
5. Return {"action":"done","reasoning":"..."} when all elements have been tested`;

    const recentHistory = history.slice(-5).map((h) => ({
      step: h.step,
      action: h.action,
      selector: h.target.selector,
      url: h.url,
    }));

    const userPrompt = JSON.stringify({
      currentPage: {
        url: pageState.url,
        title: pageState.title,
        interactiveElements: pageState.interactiveElements.slice(0, 20),
        formFields: pageState.formFields.slice(0, 15),
      },
      recentHistory,
    });

    const { stdout } = await execFile('claude', [
      '--print',
      '--output-format', 'json',
      '--system-prompt', systemPrompt,
      userPrompt,
    ], {
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });

    // Parse Claude Code JSON envelope: {"type":"result","subtype":"success","result":"..."}
    const envelope = JSON.parse(stdout);
    const rawContent = envelope.result ?? stdout;

    // Extract JSON from the response (may contain markdown fences)
    const jsonStr = typeof rawContent === 'string'
      ? rawContent.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      : JSON.stringify(rawContent);

    const decision = JSON.parse(jsonStr) as ExplorationDecision;

    // Validate decision shape (T-04-05: reject unknown action types)
    if (!decision.action || !VALID_ACTIONS.has(decision.action)) {
      return { action: 'done', reasoning: 'Invalid action type in AI response' };
    }

    if (!decision.reasoning) {
      decision.reasoning = 'AI provided no reasoning';
    }

    return decision;
  }

  /**
   * Deterministic fallback when Claude Code CLI is unavailable.
   * Strategy: fill first unfilled form field -> click first unvisited button -> navigate first unvisited link -> done.
   */
  private deterministicFallback(
    pageState: PageState,
    history: ExplorationActionLog[],
  ): ExplorationDecision {
    const stepIndex = history.length;
    const visitedSelectors = new Set(history.map((h) => h.target.selector));

    // 1. Fill first unfilled form field
    for (const field of pageState.formFields) {
      if (!visitedSelectors.has(field.selector)) {
        const { value } = selectPayload(field.type, stepIndex);
        return {
          action: 'fill',
          selector: field.selector,
          value,
          reasoning: `Deterministic fallback: filling form field "${field.name}" (${field.type}) with edge-case payload`,
        };
      }
    }

    // 2. Click first unvisited button/submit
    const buttons = pageState.interactiveElements.filter(
      (el) => el.tag === 'button' || el.type === 'submit',
    );
    for (const btn of buttons) {
      if (!visitedSelectors.has(btn.selector)) {
        return {
          action: 'click',
          selector: btn.selector,
          reasoning: `Deterministic fallback: clicking unvisited button "${btn.text}"`,
        };
      }
    }

    // 3. Navigate to first unvisited link
    const links = pageState.interactiveElements.filter((el) => el.tag === 'a');
    for (const link of links) {
      if (!visitedSelectors.has(link.selector)) {
        return {
          action: 'click',
          selector: link.selector,
          reasoning: `Deterministic fallback: clicking unvisited link "${link.text}"`,
        };
      }
    }

    // 4. Done — all elements visited
    return {
      action: 'done',
      reasoning: 'Deterministic fallback: all visible elements have been visited',
    };
  }
}
