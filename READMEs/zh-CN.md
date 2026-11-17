<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/hero-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/hero-light.svg">
  <img alt="sniff" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/hero-light.svg" width="100%">
</picture>

<p align="center">
  <a href="https://www.npmjs.com/package/sniff-qa"><img src="https://img.shields.io/npm/v/sniff-qa?style=flat-square&color=FF006E&logo=npm&label=npm" alt="npm version"></a>
  <a href="https://github.com/Aboudjem/sniff/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Aboudjem/sniff/ci.yml?style=flat-square&color=00D4FF&label=CI" alt="CI"></a>
  <a href="../LICENSE"><img src="https://img.shields.io/badge/license-Apache_2.0-7C3AED?style=flat-square" alt="License Apache 2.0"></a>
</p>

<p align="center"><a href="../README.md">English</a> · <b>简体中文</b> · <a href="ja.md">日本語</a> · <a href="es.md">Español</a> · <a href="fr.md">Français</a></p>

<p align="center"><b>在用户发现之前，找出你的 Web 应用里坏掉的地方。</b></p>

<p align="center"><a href="#你会得到什么">你会得到什么</a> · <a href="#安装">安装</a> · <a href="#工作原理">工作原理</a> · <a href="#兼容的智能体">兼容的智能体</a> · <a href="#证据">证据</a> · <a href="#常见问题">常见问题</a> · <a href="#局限">局限</a></p>

```bash
npx sniff-qa --url http://localhost:3000
```

## 你会得到什么

一份报告：先给结论，再列出最该先修的三项，然后是每一条发现。
下面是在本仓库的埋点 bug 测试应用上真实运行得到的报告（2026-11-17，sniff 0.9.2）。

```text
  VERDICT  FAIL: 26 findings (1 critical, 13 high, 11 medium, 1 low)
  Walked 12 pages, checked 13 links, in 53.8s. 1 low-confidence finding hidden, show with --all.

  Fix these first:
    1. Page returns HTTP 500 on /crash  [critical]
    2. Page returns HTTP 404 on /dead  [high]
    3. Page returns HTTP 404 on /missing  [high]

  Every finding, with the steps that reproduce it:

  CRITICAL (1)
    • [confirmed] Page returns HTTP 500
      /crash  (route/broken-page)
        - Navigate to /crash
        - Server responded with HTTP 500
      fix: The route throws server-side. Check the server logs/handler for this path and return a valid page or a proper error page.
      shot: sniff-reports/crawl/_crash-desktop.png
```

你改了一个表单，结果一个你从没打开过的页面开始返回 500。
sniff 在真实浏览器中打开你正在运行的应用，像用户一样逐页点击。
它报告的每个页面 bug 都附带复现步骤。

### 为什么用它

- **直接修，不用找。** 每条页面发现都给出路由、步骤和修复建议，大多数还附截图。
- **能找到真 bug 的证据。** 在故意埋入的 bug 上测试：21 个全部找到，干净页面上 0 条误报（`npm run build && npm run proof`）。
- **拦住有问题的合并。** 出现 critical 或 high 发现时，`--fail-on` 以 1 退出；`npx sniff-qa ci` 会写好 GitHub Actions 文件。不需要 API 密钥。

它需要你的应用在运行，并且会提交真实表单，所以请用开发或预发布环境的应用。
第一次巡查会下载一次浏览器，在 Mac 上约占 720 MB 磁盘。

要在克隆的仓库里复现这个示例，先启动测试应用，再在另一个终端里巡查它：

```bash
node sniff-tests/planted-bugs/server.mjs 4517
npx sniff-qa --url http://localhost:4517
```

<img alt="sniff walking a buggy app and streaming findings with severity, confidence, steps to reproduce, and a fix" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/demo.gif" width="100%">

## 安装

需要 Node.js 22 或更新版本。任选一种方式。

**命令行，不需要编辑器。** 启动你的应用，然后在另一个终端里巡查它：

```bash
npx sniff-qa --url http://localhost:3000
```

npm 包名是 `sniff-qa`。不要运行 `npx sniff`：那是一个无关的包。

**Claude Code 插件**，通过 [10x 插件市场](https://github.com/Aboudjem/10x)：

```bash
claude plugin marketplace add Aboudjem/10x
claude plugin install sniff@10x
```

**适用于任意智能体的技能**，通过 Vercel 的 skills CLI：

```bash
npx skills add Aboudjem/sniff
```

**MCP 服务器**，适用于任意 MCP 客户端：

```bash
claude mcp add sniff-qa -- npx -y sniff-qa --mcp
```

第一次巡查会下载两样东西，只下载一次：浏览器引擎（Playwright、axe-core 和
Lighthouse）以及 Chromium。要提前完成下载，运行：

```bash
npx sniff-qa install
```

它最后会打印耗时。在 npm 缓存为空的 Mac 上，它打印了 34 秒（2026-11-17，sniff 0.9.1）。
磁盘上留下 193 MB 引擎和 528 MB Chromium。在 macOS 上重新测量：

```bash
du -sm ~/.cache/sniff-qa/engine/* ~/Library/Caches/ms-playwright
```

`npx sniff-qa doctor` 会检查 Node、浏览器和你的开发服务器。

MCP 服务器在这些下载之前就会启动。npm 缓存为空时，`npx -y sniff-qa@0.9.1 --mcp`
在 3.1 到 4.9 秒内响应了第一次握手（5 次运行，2026-11-17）。0.9.0 版本需要 37 到 93 秒，
超过了 Claude Code 30 秒的连接上限。要重新测量，在本仓库的克隆中运行：

```bash
npm run cold-start -- 0.9.1 5
```

巡查时会打印进度行，最后输出报告。结果有四种取用方式：

| 输出      | 参数        | 用途                     |
| :-------- | :---------- | :----------------------- |
| 终端报告  | （默认）    | 马上阅读结果             |
| HTML 页面 | `--report`  | 发给别人，一个独立的文件 |
| JSON      | `--json`    | 脚本和其他工具           |
| 退出码    | `--fail-on` | 遇到真 bug 时让 CI 失败  |

| 退出码 | 含义                                                          |
| :----- | :------------------------------------------------------------ |
| `0`    | 没有发现达到 `--fail-on` 的严重级别（默认：critical 和 high） |
| `1`    | 有发现达到了该级别、超出了 `assert` 预算，或 sniff 无法运行   |

<details>
<summary>在项目中安装与 CI</summary>

`npm install -D sniff-qa` 会把它加入项目。`npx sniff-qa ci` 会写一个 GitHub Actions 工作流，
带浏览器缓存和报告产物。
</details>

## 工作原理

<img alt="How sniff works: crawl, act, assert, prove, report" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/how-it-works.svg" width="100%">

1. **找到应用。** 使用 `--url`，或常见端口上的开发服务器。
2. **巡查应用。** 无头 Chromium 像用户一样点链接、按按钮、填表单。
3. **判断发生了什么。** 每个页面都检查 12 类 bug。
4. **给出证据。** 一条发现必须有路由和步骤。有截图和控制台或网络日志时也会附上。
5. **报告。** 先给结论，再给最该先修的清单，最后是细节。

这 12 类：

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg">
  <img alt="The 12 classes of bugs sniff finds" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg" width="100%">
</picture>

没有应用在运行时，`sniff` 会改为读取你的源码（`sniff scan`）。它会标出调试语句、
占位文本和失效的 import，并告诉你如何开始真正的巡查。

MCP 服务器提供以下工具：

| 工具             | 作用                                             |
| :--------------- | :----------------------------------------------- |
| `sniff`          | 统一入口：`mode: "walk"`、`"scan"` 或 `"report"` |
| `sniff_scan`     | 只扫描源码，不用浏览器                           |
| `sniff_run`      | 源码扫描加浏览器检查                             |
| `sniff_discover` | 根据源码生成场景并执行                           |
| `sniff_install`  | 下载 Playwright 浏览器                           |
| `sniff_report`   | 读取上次保存的结果                               |

`--caps scan,report` 会把服务器限制为 `sniff_scan`、`sniff_report` 和统一的 `sniff` 工具，完全不用浏览器。

## 兼容的智能体

每一行都在 2026-11-17 用 sniff 0.9.0 构建测试过。

| 智能体          | 运行了什么                                                                    | 测试日期   |
| :-------------- | :---------------------------------------------------------------------------- | :--------- |
| Claude Code     | 把 sniff 作为 MCP 服务器的 `claude -p` 调用了 `sniff_scan` 并读取了 2 条发现  | 2026-11-17 |
| Codex CLI       | 把 sniff 作为 MCP 服务器的 `codex exec` 调用了 `sniff_scan` 并读取了 2 条发现 | 2026-11-17 |
| Gemini CLI      | `gemini extensions validate .` 接受了 `gemini-extension.json`                 | 2026-11-17 |
| 任意 MCP 客户端 | `node sniff-tests/mcp-smoke.mjs` 列出了 6 个工具，一次巡查返回了 20 条发现    | 2026-11-17 |
| skills CLI      | `npx skills@1.9.0 add Aboudjem/sniff` 把 3 个技能装进了临时文件夹             | 2026-11-17 |

有文档、今天未测试：Cursor、带 Copilot 的 VS Code、Windsurf、OpenCode 和 Zed。
它们的配置片段在 [docs/editors.md](../docs/editors.md)。

## 证据

三条命令可以重新打印本页的数字。第一条打印测试应用上的得分。

```bash
npm run build && npm run proof
```

它启动埋点 bug 测试应用，巡查一遍，并给报告打分。2026-11-17 的输出：

```text
  Recall:    21/21  (100%)
  Findings:  27 deduped (27 raw)
  Matched:   27   Candidate FP: 0   Precision proxy: 100%
  Hard FP on clean page (/clean): 0
```

上面的示例显示 26 条发现，这次运行算出 27 条。证据运行使用了 `--all`，它会加上那 1 条低置信度发现。

测试应用包含覆盖全部 12 类的 21 个埋点 bug，外加一个干净的对照页面。
打分脚本是 [sniff-tests/score-fixture.mjs](../sniff-tests/score-fixture.mjs)。
bug 列在 [sniff-tests/planted-bugs/MANIFEST.json](../sniff-tests/planted-bugs/MANIFEST.json) 中。

```bash
npm test
```

2026-11-17 打印了 `Test Files  53 passed (53)` 和 `Tests  576 passed (576)`。
测试套件包含测试应用的门槛。召回率低于 85% 时会让构建失败。
干净页面上出现任何发现也会失败。

```bash
node sniff-tests/mcp-smoke.mjs
```

打印 6 个 MCP 工具，以及上表中提到的 20 条发现。

## 常见问题

**需要 API 密钥或账号吗？**
不需要。巡查和源码扫描都在你的机器上运行。除非你自己配置可选的 AI 探索，否则不会向任何地方发送数据。

**巡查会改动我应用里的数据吗？**
可能会。巡查会点按钮、提交真实表单，所以请把它指向开发或预发布环境的应用。

**明明没有崩溃，为什么以 1 退出？**
退出码 1 表示它发现了达到失败级别的 bug，所以 CI 会让构建失败。传入 `--fail-on none` 可以始终以 0 退出。

**它会改我的代码吗？**
不会。巡查和扫描从不触碰你的源码。只有 `sniff fix` 会修改文件，而且只在你运行它时。

**能巡查需要登录的应用吗？**
能。传入 `--storage-state auth.json`。该文件中的 Cookie 和令牌值会在写出的报告中被遮盖。

更多回答见 [docs/faq.md](../docs/faq.md)。

## 局限

- 巡查需要正在运行的应用。没有应用时，你只能得到源码扫描。
- 第一次巡查需要联网，以便一次性下载浏览器引擎和 Chromium，在 Mac 上占 721 MB 磁盘。
- 在此之前，MCP 浏览器工具会返回 `needsSetup`，智能体会先调用 `sniff_install`。
- 死链检查会跟随外部链接，所以巡查会请求你的页面所链接的第三方 URL。
- 遮盖只作用于报告文字，不作用于截图像素。已登录页面的截图可能显示私人数据。
- 它找的是用户能看到的问题。它不读服务器日志，也不测量负载。

## 了解更多

- [docs/editors.md](../docs/editors.md)：每个智能体的安装和 MCP 配置片段
- [docs/authenticated-walks.md](../docs/authenticated-walks.md)：巡查需要登录的应用
- [docs/assert-budgets.md](../docs/assert-budgets.md)：在 `sniff.config` 中按严重级别限制发现数量
- [docs/comparison.md](../docs/comparison.md)：sniff 与 linter 和 E2E 框架的区别
- [CHANGELOG.md](../CHANGELOG.md) · [CONTRIBUTING.md](../CONTRIBUTING.md) · [LICENSE](../LICENSE)

---

<p align="center"><sub>Built by <a href="https://github.com/Aboudjem">Adam Boudjemaa</a> · <a href="../LICENSE">Apache 2.0</a> · built on <a href="https://playwright.dev">Playwright</a> and <a href="https://github.com/dequelabs/axe-core">axe-core</a></sub></p>

<p align="center"><sub>本文档由机器辅助翻译，英文版 <a href="../README.md">README.md</a> 为准。</sub></p>
