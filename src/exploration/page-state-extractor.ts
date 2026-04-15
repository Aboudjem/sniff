import type { Page } from 'playwright';
import type { PageState, InteractiveElement, FormField } from './types.js';

/**
 * Extract the current page state from the live DOM via Playwright's page.evaluate().
 * Returns interactive elements (buttons, links, submits) and form fields (inputs, selects, textareas).
 */
export async function extractPageState(page: Page): Promise<PageState> {
  const url = page.url();
  const title = await page.title();

  const { interactiveElements, formFields } = await page.evaluate(() => {
    function getSelector(el: Element): string {
      // Prefer data-testid > #id > [name] > CSS path
      const testId = el.getAttribute('data-testid');
      if (testId) return `[data-testid="${testId}"]`;

      const id = el.getAttribute('id');
      if (id) return `#${id}`;

      const name = el.getAttribute('name');
      if (name) {
        const tag = el.tagName.toLowerCase();
        return `${tag}[name="${name}"]`;
      }

      // Build a minimal CSS path
      const parts: string[] = [];
      let current: Element | null = el;
      while (current && current !== document.body) {
        const tag = current.tagName.toLowerCase();
        const parentEl: Element | null = current.parentElement;
        if (parentEl) {
          const currentTag = current.tagName;
          const siblings = Array.from(parentEl.children).filter(
            (c: Element) => c.tagName === currentTag,
          );
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            parts.unshift(`${tag}:nth-of-type(${index})`);
          } else {
            parts.unshift(tag);
          }
        } else {
          parts.unshift(tag);
        }
        current = parentEl;
      }
      return parts.join(' > ');
    }

    function truncate(text: string, maxLen: number): string {
      const trimmed = text.trim().replace(/\s+/g, ' ');
      return trimmed.length > maxLen ? trimmed.slice(0, maxLen) + '...' : trimmed;
    }

    // Interactive elements: a, button, [role="button"], input[type="submit"]
    const interactiveSelectors = 'a, button, [role="button"], input[type="submit"]';
    const interactiveEls = Array.from(document.querySelectorAll(interactiveSelectors));
    const interactiveElements = interactiveEls.map((el) => ({
      selector: getSelector(el),
      tag: el.tagName.toLowerCase(),
      text: truncate(el.textContent ?? '', 100),
      type: el.getAttribute('type') ?? undefined,
      role: el.getAttribute('role') ?? undefined,
      visited: false, // caller tracks visited state
    }));

    // Form fields: input, select, textarea
    const formSelectors = 'input:not([type="submit"]):not([type="hidden"]), select, textarea';
    const formEls = Array.from(document.querySelectorAll(formSelectors));
    const formFields = formEls.map((el) => ({
      selector: getSelector(el),
      name: el.getAttribute('name') ?? '',
      type: el.getAttribute('type') ?? el.tagName.toLowerCase(),
      required: el.hasAttribute('required'),
      placeholder: el.getAttribute('placeholder') ?? undefined,
    }));

    return { interactiveElements, formFields };
  });

  return {
    url,
    title,
    interactiveElements: interactiveElements as InteractiveElement[],
    formFields: formFields as FormField[],
  };
}
