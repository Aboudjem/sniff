import type { Page } from 'playwright';

export interface DiscoveredElement {
  tag: string;
  type: 'clickable' | 'input' | 'form' | 'link';
  text: string;
  selector: string;
  attributes: Record<string, string>;
}

export async function discoverElements(page: Page): Promise<DiscoveredElement[]> {
  return page.$$eval(
    'a, button, [role="button"], input[type="submit"], [onclick], input, textarea, select, form',
    (elements) => {
      function buildSelector(el: Element): string {
        const testId = el.getAttribute('data-testid');
        if (testId) return `[data-testid="${testId}"]`;

        const id = el.getAttribute('id');
        if (id) return `#${id}`;

        const name = el.getAttribute('name');
        if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;

        const tag = el.tagName.toLowerCase();
        const classList = el.className && typeof el.className === 'string'
          ? el.className.trim().split(/\s+/).slice(0, 2).join('.')
          : '';
        return classList ? `${tag}.${classList}` : tag;
      }

      function classifyElement(el: Element): 'clickable' | 'input' | 'form' | 'link' {
        const tag = el.tagName.toLowerCase();
        if (tag === 'form') return 'form';
        if (tag === 'a') return 'link';
        if (tag === 'input' || tag === 'textarea' || tag === 'select') {
          const type = el.getAttribute('type');
          if (type === 'submit') return 'clickable';
          return 'input';
        }
        return 'clickable';
      }

      function extractAttributes(el: Element): Record<string, string> {
        const attrs: Record<string, string> = {};
        const relevant = ['href', 'type', 'role', 'aria-label', 'name', 'placeholder', 'action', 'method'];
        for (const name of relevant) {
          const val = el.getAttribute(name);
          if (val != null) {
            attrs[name] = val;
          }
        }
        return attrs;
      }

      return elements.map((el) => ({
        tag: el.tagName.toLowerCase(),
        type: classifyElement(el),
        text: (el.textContent ?? '').trim().slice(0, 100),
        selector: buildSelector(el),
        attributes: extractAttributes(el),
      }));
    },
  );
}
