# Sniff — Launch Plan (June 2026)

**Supernova Standard Pillar 1 · Prepared 2026-05-30**

---

## The one-law framing

Stars come from velocity on a channel whose audience you don't own. Sniff's job is not "post the repo" — it is: **engineer a post-worthy artifact → get borrowed reach to point at it → stack 2+ referrers in one window → let Trending compound.**

Sniff is the strongest launch candidate in the dogfood corpus: 100% precision, 441 tests, CLI + MCP server, demo GIF, multi-CLI installer, GitHub Pages site, and a zero-API-key install story that fits in one sentence.

---

## Phase 0 — Dark prep (now → launch day)

Prepare these artifacts before any public post:

- [ ] A 2–4-tweet thread (GIF first, one-sentence hook, 21/21 bugs stat, install command)
- [ ] A niche-subreddit body for r/ClaudeAI and r/mcp (problem-first: "I got tired of writing Playwright tests so I built a scanner that walks my app for me")
- [ ] A dev.to / personal blog origin story (≤800 words; what broke, what I built, what it found on a real app)
- [ ] PRs queued to awesome-mcp-servers, awesome-claude-code, and the MCP Registry (see Phase 1)
- [ ] A short Loom / MP4 screen recording showing the one-liner finding a real bug (30–60 s) — the demo GIF is already done but a voiced walkthrough converts better in subreddits

---

## Phase 1 — Registry submissions (highest ROI, do first)

Sniff ships an MCP server (`npx -y sniff-qa --mcp`). These registries are always-on discovery channels:

### 1. Official MCP Registry
- URL: `registry.mcp.run` (via `mcp-publisher` CLI)
- Method: `npm publish` is already done (`sniff-qa` v0.7.0 on npm) → `npx mcp-publisher init` → `login github` → `publish` with namespace `io.github.aboudjem/sniff-qa`
- Feeds: Cursor `/mcp` suggestions, VS Code MCP panel, Claude Desktop MCP list
- Effort: ~30 min, permanent drip

### 2. Smithery
- URL: `smithery.ai`
- Method: submit via the web form at `smithery.ai/submit` — provide the npm package name, MCP transport (`stdio`), and the start command (`npx -y sniff-qa --mcp`)
- Smithery is the highest-traffic MCP discovery directory; sniff's zero-config story fits the featured-tool pattern

### 3. awesome-mcp-servers (punkpeye/awesome-mcp-servers)
- Method: open a PR adding sniff to the "Testing & QA" section
- One-liner: `| [sniff-qa](https://github.com/Aboudjem/sniff) | Autonomous QA scanner — walks your running app in a browser and reports bugs with proof. CLI + MCP. No API key. | |`
- This repo has ~25 k stars and is indexed by every MCP directory aggregator

### 4. hesreallyhim/awesome-claude-code
- Method: **web-UI issue form ONLY** — do NOT open a PR, it is auto-closed
- Navigate to the repo's Issues tab → "Add a tool / plugin" template → fill in sniff details
- Category: QA / Testing

---

## Phase 2 — Launch day (target: any weekday, 12:00–16:00 UTC)

Open a 2-hour window and stack all channels simultaneously:

| Order | Action | Channel |
|:--|:--|:--|
| 1 | Post the 2–4-tweet thread (GIF first) | X/Twitter |
| 2 | Post to r/ClaudeAI (problem-first body) | Reddit |
| 3 | Post to r/mcp ("built an MCP QA scanner") | Reddit |
| 4 | Merge the awesome-mcp-servers PR (have it approved already) | GitHub |
| 5 | Publish dev.to origin-story post | dev.to |
| 6 | Drop the Loom link in Claude Code Discord / any dev Slack you're in | Discord |

Do NOT cold-post to Hacker News as the author. Engineer the demo so a third party carries it (ask a respected HN user who's used sniff to submit; or wait for the dev.to post to get picked up).

---

## Phase 3 — Second wave (2–4 weeks post-launch)

- Ship v0.8 with one high-signal feature (e.g. GitHub Actions native summary output, or a `--watch` mode)
- Court a dev YouTuber or newsletter (Changelog Nightly, TLDR AI) with the "21/21 bugs, 0 false positives" headline
- If the MCP Registry submission is live, ping the Anthropic DevRel team on X — they regularly reshare MCP server launches

---

## Key messages (copy-paste ready)

**One-liner:** "Point it at your running app. It walks the real user flows in a browser and tells you what's actually broken — with proof."

**Stat hook:** "21 planted bugs. 21 found. 0 false positives. 441 tests. One command, no API key."

**MCP angle:** "It's also an MCP server — `npx -y sniff-qa --mcp` and any MCP client (Claude Code, Cursor, VS Code) can run a QA walk as a tool call."

---

## What to avoid

- Cold "Show HN" from the author account — went 0-for-N in the 15-repo corpus
- Posting to Product Hunt before Twitter/Reddit momentum is established
- Posting outside the 12:00–16:00 UTC weekday window
- Splitting channels across multiple days (kills the velocity spike)
