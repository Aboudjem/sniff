# Walking a logged-in app

By default sniff walks whatever an anonymous visitor can reach. On most apps that is the marketing
pages and a login wall. `--storage-state` points sniff at a Playwright storage-state file so the
walk runs as a signed-in user.

## Make the file

Storage state is a plain JSON file that Playwright writes for you. Log in once, save the session:

```js
// save-auth.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto('https://localhost:3000/login');
// Log in by hand in the window that opened, then press enter in the terminal.
await new Promise((r) => process.stdin.once('data', r));
await page.context().storageState({ path: 'auth.json' });
await browser.close();
```

```bash
node save-auth.mjs
```

## Use it

```bash
sniff --url http://localhost:3000 --storage-state auth.json
```

Or set it once in your config, which the CLI and the MCP server both read:

```js
export default {
  browser: {
    storageState: 'auth.json',
  },
};
```

The flag wins over the config key. The config key holds a path, not a credential, so it is safe to
commit; the file it points at is not. Add `auth.json` to `.gitignore`.

A missing or unparseable file stops the run with an error rather than quietly walking logged out and
reporting every page as a login wall. sniff cannot tell a live session from an expired one, so a
stale file still produces an anonymous crawl. Regenerate it when the walk starts finding login
pages.

## What gets redacted

A storage-state file holds live session cookies and bearer tokens, and sniff writes reports that
quote captured URLs and console output. Loading the file therefore also arms a redactor.

Redacted from every text artifact sniff writes, replaced with `[redacted]`:

- every cookie value in the file
- every `localStorage` value, and every string inside one that is itself JSON, which is how most apps
  store `{"accessToken": "..."}`
- every string in `indexedDB` state
- the percent-encoded form of each of the above, since a cookie value with `=` or `/` in it arrives
  URL-encoded when it shows up in a captured request
- any `Authorization: Bearer <token>` or `"authorization": "<token>"` value, even one that never
  came from the file

That covers the JSON report, the HTML report, stdout, the progress lines on stderr, and the file
names of screenshots.

Two honest limits:

- **Screenshot pixels are not redacted.** A logged-in walk renders your session UI into the PNGs
  under `sniff-reports/crawl/` by design; that is what makes the reproduction proof useful. Treat the
  report directory as sensitive on an authenticated run.
- **Values shorter than four characters are skipped.** Replacing a two-character string would corrupt
  unrelated report text.

## Scope

`--storage-state` applies to the flow-walk, which is the default `sniff` and `sniff --url` run. The
browser audit behind the `sniff_run` MCP tool reads the same setting from the `browser.storageState`
config key. `--explore` and `--discover` build their own browser contexts and still walk
unauthenticated.
