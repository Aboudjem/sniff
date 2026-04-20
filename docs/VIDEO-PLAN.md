# Sniff — demo video plan

Three videos, three lengths, three audiences. Shoot once, cut three ways from the same recording.

---

## Video 1 · 30-second hero (for the top of the README + social)

**Goal:** make someone install sniff before the clip ends.

**Script (voice-over, 90 words max):**

> 0:00 — "You ship a feature. A user finds the bug before you do."
> 0:05 — "Sniff is a cat that reads your code, opens your app, and finds bugs before shipping."
> 0:12 — *`npx sniff-qa`* typed on-screen — nothing else.
> 0:16 — Terminal spinners, sniff finds: missing alt text, bad contrast, slow LCP, broken link.
> 0:22 — *`/sniff-fix`* — the bugs get patched, diff flashes on screen.
> 0:27 — "One command. Eight checks. Zero config. Zero API keys."
> 0:30 — Mascot blinks. Logo. GitHub URL.

**Shots:**
1. Terminal close-up, `cd ~/projects/my-app` → `npx sniff-qa`
2. Split screen: terminal + live browser Sniff is driving (headed mode)
3. Report summary: 4 findings with severity dots
4. `/sniff-fix` — diffs flying past
5. Mascot close-up with tail wag — logo lockup

**Tools:**
- Recording: [Screen Studio](https://screen.studio) (macOS, auto-zoom, smooth cursor) — or [OBS](https://obsproject.com) if you want free.
- Terminal: [WezTerm](https://wezfurlong.org/wezterm/) or [Ghostty](https://ghostty.org/) (ligatures, transparent background for compositing).
- Voice: ElevenLabs "Adam" or your own mic + [AudioDenoise](https://www.cleanvoice.ai).
- Shell replay: record `npx sniff-qa` once, replay it perfectly with [asciinema](https://asciinema.org) + [agg](https://github.com/asciinema/agg) to GIF if you want a lightweight inline asset.

---

## Video 2 · 90-second demo (for landing page / YouTube card / tweet)

**Structure:**

| Time | Beat | Visual |
|------|------|--------|
| 0–5s | Hook — "QA is boring so you skip it. Until you can't." | Fast montage: red screens, user complaints, PR comments |
| 5–20s | What sniff does | Mascot wakes up · terminal · one command runs |
| 20–50s | Live scan on a real Next.js app | Source scan → browser opens → AI explores → findings appear |
| 50–70s | The fix loop | `/sniff-fix` applies safe fixes, diff view, re-run → green |
| 70–85s | Editor integration | Claude / Cursor / VSCode asks: *"Scan this project"* — same output inline |
| 85–90s | Close | `npx sniff-qa` — GitHub · npm · free forever |

**On-screen text beats (no voice-over option):**
- "No API key."
- "No Playwright install."
- "No config."
- "Just one command."

**Assets you already have:**
- `.github/assets/sniff-diagram.svg` — works as an animated intro card.
- `.github/assets/logo-dark.svg` — mascot blink is already looping in SVG. Record it, loop it on the outro.

---

## Video 3 · 3-minute walkthrough (for docs / dev-relations / conference talk)

**Chapters (mark in YouTube description):**

1. **0:00 — The problem** · why manual QA fails (30s)
2. **0:30 — Install** · `npx sniff-qa` on a fresh React app (20s)
3. **0:50 — First scan, source-only** · dead links, API endpoints, broken imports (40s)
4. **1:30 — Dev-server scan** · accessibility, visual, performance, AI explorer (50s)
5. **2:20 — Fix loop** · `/sniff-fix`, manual fix review, re-run (30s)
6. **2:50 — CI integration** · `sniff ci`, GitHub Actions, JUnit output (20s)
7. **3:10 — Editor integration** · MCP demo in Cursor (20s)
8. **3:30 — Outro** · "One command. Eight checks. Zero config."

**Stock footage tricks:**
- For the "boring QA" montage: royalty-free dev footage from [Pexels](https://pexels.com) + [Coverr](https://coverr.co).
- Transitions: keep minimal — cross-fade only. Sniff is a CLI tool; flashy video undermines the "just a command" story.

---

## Distribution

- **X / Twitter**: post Video 1 as native video. Caption: *"Your code has bugs you haven't found yet. npx sniff-qa 🐱"* + repo link.
- **LinkedIn**: post Video 2 with a 2-paragraph writeup on why zero-config QA matters in 2026. Tag Playwright, Anthropic.
- **Reddit (r/webdev, r/javascript)**: post Video 3 as "I built an open-source QA CLI, here's a full walkthrough". Engage in comments.
- **Hacker News**: *Show HN: Sniff — zero-config AI QA CLI*. Link the README. Do NOT embed video in HN post — paste the 90s video link in the first comment instead.
- **YouTube Shorts**: chop Video 1 into 4 × 7s clips, each highlighting one finding type (a11y, perf, dead link, visual regression).
- **README.md**: embed Video 1 at top via GitHub video attachment (drag-drop into a PR description, copy the `user-attachments` URL).

---

## Budget

- Free path: OBS + DaVinci Resolve (free) + your voice = $0.
- Cheap path: Screen Studio ($89 one-time) + ElevenLabs ($5/mo) + Descript (free tier) = under $100 total.
- Don't pay for stock footage — Pexels + Coverr cover every shot you'll need.

## Timeline

One 2-hour block:
- 30 min: prep a demo app (Next.js blog with 4 seeded bugs), install sniff
- 30 min: record 4 takes of the full walkthrough
- 60 min: cut the 90s version; the 30s and 3m versions are trims of that master

Ship Video 1 tonight. Video 2 end of week. Video 3 for launch day.
