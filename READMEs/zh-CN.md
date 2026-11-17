<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/hero-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/hero-light.svg">
  <img alt="sniff: find broken pages before users do. A map of app pages where the browser walk reaches /crash, which returns HTTP 500, with its two repro steps. Three chips: bugs caught before users, steps to repeat it, broken merges blocked. The command npx sniff-qa --url http://localhost:3000, and the works-with line." src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/hero-light.svg" width="100%">
</picture>

<p align="center">
  <a href="https://www.npmjs.com/package/sniff-qa"><img src="https://img.shields.io/npm/v/sniff-qa?style=flat-square&color=FF006E&logo=npm&label=npm" alt="npm version"></a>
  <a href="https://github.com/Aboudjem/sniff/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Aboudjem/sniff/ci.yml?style=flat-square&color=00D4FF&label=CI" alt="CI"></a>
  <a href="../LICENSE"><img src="https://img.shields.io/badge/license-Apache_2.0-7C3AED?style=flat-square" alt="License Apache 2.0"></a>
</p>

<p align="center"><a href="../README.md">English</a> · <b>简体中文</b> · <a href="ja.md">日本語</a> · <a href="es.md">Español</a> · <a href="fr.md">Français</a></p>

<p align="center"><b>在用户发现之前，找出你的 Web 应用里坏掉的页面。</b></p>

sniff 在真实浏览器里打开你正在运行的应用，像用户一样点击。

| 用户之前发现 bug | 附带复现步骤 | 拦住坏的合并 |
|:--|:--|:--|
| 预埋的 21 个 bug 全部找到，误报 0 个：`npm run build && npm run proof`。 | 每个页面 bug 都附带路由、复现步骤和修复建议。 | `--fail-on` 遇到 critical 或 high 的 bug 时以 1 退出，CI 就会拦住合并。 |

**适用于：** 任何 MCP 客户端、任何能读 skills 的智能体，或只用命令行。MCP 是智能体调用工具的方式。

已测试：Claude Code、Codex CLI。巡查靠的是浏览器，不是模型。

- **它是什么：** 一个为你正在运行的 Web 应用找 bug 的工具。你不用写测试。
- **何时使用：** 改完代码之后，合并或发布之前。
- **你会得到：** 先是结论，然后是每个 bug 的路由、步骤和修复建议。

```bash
npx sniff-qa --url http://localhost:3000
```

## 你会得到什么

这是本仓库预埋 bug 的测试应用上的一份真实报告 (2026-11-17，sniff 0.9.3)：

```text
  VERDICT  FAIL: 26 findings (1 critical, 13 high, 11 medium, 1 low), 1 low-confidence finding hidden
  Walked 12 pages, checked 13 links, in 55.2s. --all shows the hidden one.

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

请使用开发或预发布环境的应用：巡查会点击按钮并提交真实表单。

<p align="center"><a href="#你会得到什么">你会得到什么</a> · <a href="#安装">安装</a> · <a href="#工作原理">工作原理</a> · <a href="#兼容的智能体">兼容的智能体</a> · <a href="#证据">证据</a> · <a href="#常见问题">常见问题</a> · <a href="#局限">局限</a></p>

## 安装

**无需安装即可试用。** 先启动你的应用，再在另一个终端里巡查它：

```bash
npx sniff-qa --url http://localhost:3000
```

npm 包名是 `sniff-qa`。不要运行 `npx sniff`：那是一个无关的包。

**推荐：Vercel 的 skills CLI。** `npx skills` 是 Vercel 开源的智能体 skills 安装工具。

```bash
npx skills add Aboudjem/sniff -g
```

支持 70 多个智能体：在菜单中选择你的 ([支持的智能体](https://github.com/vercel-labs/skills#supported-agents))。
在终端里它会显示智能体菜单。在脚本里它会装进所有智能体的文件夹，所以要加上 `-a <agent>`。
`-g` 会为你的所有项目安装。只用于当前项目：去掉 `-g`。
它只安装 3 个 skills。MCP 服务器是另外一行命令，见下文。

<p><a href="https://skills.sh/aboudjem/sniff"><img alt="skills.sh: sniff on the Vercel skills directory" src="https://img.shields.io/badge/skills.sh-000000?style=flat-square&logo=vercel&logoColor=white" height="24"></a> <a href="https://skills.sh/aboudjem/sniff">skills.sh/aboudjem/sniff</a></p>

**或者直接装进某一个智能体。** 需要 Node.js 22 或更高版本。

<p><a href="#claude-code"><img alt="Claude Code" src="https://img.shields.io/badge/Claude_Code-D97757?style=flat-square&logo=claude&logoColor=white" height="24"></a> <a href="#codex"><img alt="Codex" src="https://img.shields.io/badge/Codex-000000?style=flat-square&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyBmaWxsPSJ3aGl0ZSIgcm9sZT0iaW1nIiB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI%2BPHRpdGxlPk9wZW5BSTwvdGl0bGU%2BPHBhdGggZD0iTTIyLjI4MTkgOS44MjExYTUuOTg0NyA1Ljk4NDcgMCAwIDAtLjUxNTctNC45MTA4IDYuMDQ2MiA2LjA0NjIgMCAwIDAtNi41MDk4LTIuOUE2LjA2NTEgNi4wNjUxIDAgMCAwIDQuOTgwNyA0LjE4MThhNS45ODQ3IDUuOTg0NyAwIDAgMC0zLjk5NzcgMi45IDYuMDQ2MiA2LjA0NjIgMCAwIDAgLjc0MjcgNy4wOTY2IDUuOTggNS45OCAwIDAgMCAuNTExIDQuOTEwNyA2LjA1MSA2LjA1MSAwIDAgMCA2LjUxNDYgMi45MDAxQTUuOTg0NyA1Ljk4NDcgMCAwIDAgMTMuMjU5OSAyNGE2LjA1NTcgNi4wNTU3IDAgMCAwIDUuNzcxOC00LjIwNTggNS45ODk0IDUuOTg5NCAwIDAgMCAzLjk5NzctMi45MDAxIDYuMDU1NyA2LjA1NTcgMCAwIDAtLjc0NzUtNy4wNzI5em0tOS4wMjIgMTIuNjA4MWE0LjQ3NTUgNC40NzU1IDAgMCAxLTIuODc2NC0xLjA0MDhsLjE0MTktLjA4MDQgNC43NzgzLTIuNzU4MmEuNzk0OC43OTQ4IDAgMCAwIC4zOTI3LS42ODEzdi02LjczNjlsMi4wMiAxLjE2ODZhLjA3MS4wNzEgMCAwIDEgLjAzOC4wNTJ2NS41ODI2YTQuNTA0IDQuNTA0IDAgMCAxLTQuNDk0NSA0LjQ5NDR6bS05LjY2MDctNC4xMjU0YTQuNDcwOCA0LjQ3MDggMCAwIDEtLjUzNDYtMy4wMTM3bC4xNDIuMDg1MiA0Ljc4MyAyLjc1ODJhLjc3MTIuNzcxMiAwIDAgMCAuNzgwNiAwbDUuODQyOC0zLjM2ODV2Mi4zMzI0YS4wODA0LjA4MDQgMCAwIDEtLjAzMzIuMDYxNUw5Ljc0IDE5Ljk1MDJhNC40OTkyIDQuNDk5MiAwIDAgMS02LjE0MDgtMS42NDY0ek0yLjM0MDggNy44OTU2YTQuNDg1IDQuNDg1IDAgMCAxIDIuMzY1NS0xLjk3MjhWMTEuNmEuNzY2NC43NjY0IDAgMCAwIC4zODc5LjY3NjVsNS44MTQ0IDMuMzU0My0yLjAyMDEgMS4xNjg1YS4wNzU3LjA3NTcgMCAwIDEtLjA3MSAwbC00LjgzMDMtMi43ODY1QTQuNTA0IDQuNTA0IDAgMCAxIDIuMzQwOCA3Ljg3MnptMTYuNTk2MyAzLjg1NThMMTMuMTAzOCA4LjM2NCAxNS4xMTkyIDcuMmEuMDc1Ny4wNzU3IDAgMCAxIC4wNzEgMGw0LjgzMDMgMi43OTEzYTQuNDk0NCA0LjQ5NDQgMCAwIDEtLjY3NjUgOC4xMDQydi01LjY3NzJhLjc5Ljc5IDAgMCAwLS40MDctLjY2N3ptMi4wMTA3LTMuMDIzMWwtLjE0Mi0uMDg1Mi00Ljc3MzUtMi43ODE4YS43NzU5Ljc3NTkgMCAwIDAtLjc4NTQgMEw5LjQwOSA5LjIyOTdWNi44OTc0YS4wNjYyLjA2NjIgMCAwIDEgLjAyODQtLjA2MTVsNC44MzAzLTIuNzg2NmE0LjQ5OTIgNC40OTkyIDAgMCAxIDYuNjgwMiA0LjY2ek04LjMwNjUgMTIuODYzbC0yLjAyLTEuMTYzOGEuMDgwNC4wODA0IDAgMCAxLS4wMzgtLjA1NjdWNi4wNzQyYTQuNDk5MiA0LjQ5OTIgMCAwIDEgNy4zNzU3LTMuNDUzN2wtLjE0Mi4wODA1TDguNzA0IDUuNDU5YS43OTQ4Ljc5NDggMCAwIDAtLjM5MjcuNjgxM3ptMS4wOTc2LTIuMzY1NGwyLjYwMi0xLjQ5OTggMi42MDY5IDEuNDk5OHYyLjk5OTRsLTIuNTk3NCAxLjQ5OTctMi42MDY3LTEuNDk5N1oiLz48L3N2Zz4%3D" height="24"></a> <a href="#cursor"><img alt="Cursor" src="https://img.shields.io/badge/Cursor-000000?style=flat-square&logo=cursor&logoColor=white" height="24"></a> <a href="#gemini-cli"><img alt="Gemini CLI" src="https://img.shields.io/badge/Gemini-8E75B2?style=flat-square&logo=googlegemini&logoColor=white" height="24"></a> <a href="#github-copilot"><img alt="GitHub Copilot" src="https://img.shields.io/badge/Copilot-000000?style=flat-square&logo=githubcopilot&logoColor=white" height="24"></a> <a href="#opencode"><img alt="OpenCode" src="https://img.shields.io/badge/OpenCode-211E1E?style=flat-square&logo=opencode&logoColor=white" height="24"></a></p>

#### Claude Code

已测试安装。

```bash
npx skills add Aboudjem/sniff -g -a claude-code
```

MCP 服务器，已测试，适用于你的所有项目：

```bash
claude mcp add -s user sniff-qa -- npx -y sniff-qa --mcp
```

只用于当前项目：去掉 `-s user`。

#### Codex

已测试安装。

```bash
npx skills add Aboudjem/sniff -g -a codex
```

MCP 服务器，已测试，适用于你的所有项目：

```bash
codex mcp add sniff-qa -- npx -y sniff-qa --mcp
```

#### Cursor

已测试安装。

```bash
npx skills add Aboudjem/sniff -g -a cursor
```

#### Gemini CLI

已测试安装。

```bash
npx skills add Aboudjem/sniff -g -a gemini-cli
```

或者添加扩展，它也会带上 MCP 服务器 (已测试安装)：

```bash
gemini extensions install https://github.com/Aboudjem/sniff
```

#### GitHub Copilot

已测试安装。

```bash
npx skills add Aboudjem/sniff -g -a github-copilot
```

#### OpenCode

已测试安装。

```bash
npx skills add Aboudjem/sniff -g -a opencode
```

#### Claude Code 插件

一步添加 skills 和 MCP 服务器，通过 [10x marketplace](https://github.com/Aboudjem/10x) 安装：

```bash
claude plugin marketplace add Aboudjem/10x
claude plugin install sniff@10x
```

其他 MCP 客户端运行 `npx -y sniff-qa --mcp`。各编辑器的配置片段在 [docs/editors.md](../docs/editors.md)。

#### 首次运行

第一次巡查会下载约 440 MB，只下载一次。在 Mac 上约占 730 MB 磁盘。
它会获取浏览器引擎 (Playwright、axe-core 和 Lighthouse) 以及浏览器本身 Chromium。
想提前下载，运行：

```bash
npx sniff-qa install
```

它最后会显示耗时。在缓存为空的 Mac 上显示 43 秒 (2026-11-17，sniff 0.9.3)。
磁盘上留下 193 MB 引擎和 530 MB Chromium。
大小因平台而异。在 macOS 上重新测量：

```bash
du -sm ~/.cache/sniff-qa/engine/* ~/Library/Caches/ms-playwright
```

`npx sniff-qa doctor` 会检查 Node、浏览器和你的开发服务器。

MCP 服务器在这些下载之前就会启动。npm 缓存为空时，`npx -y sniff-qa@0.9.1 --mcp`
在 3.1 到 4.9 秒内响应了第一个请求 (5 次运行，2026-11-17)。0.9.0 版本需要 37 到 93 秒，
超过了 Claude Code 30 秒的连接上限。要重新测量，在本仓库的克隆中运行：

```bash
npm run cold-start -- 0.9.1 5
```

巡查会先打印进度，再输出报告。结果有四种拿法：

| 输出       | 参数        | 用途                           |
| :--------- | :---------- | :----------------------------- |
| 终端报告   | (默认)      | 马上阅读结果                   |
| HTML 页面  | `--report`  | 分享：一个包含全部内容的文件   |
| JSON       | `--json`    | 脚本和其他工具                 |
| 退出码     | `--fail-on` | 遇到真实 bug 时让 CI 失败      |

| 退出码 | 含义                                                                      |
| :----- | :------------------------------------------------------------------------ |
| `0`    | 没有发现达到 `--fail-on` 的严重级别 (默认：critical 和 high)              |
| `1`    | 有发现达到该级别、超出了 `assert` 的上限，或 sniff 无法运行               |

<details>
<summary>在项目中安装与 CI</summary>

要拦住坏的合并，在 CI 中使用 `--fail-on`。默认是 critical 和 high。
`npm install -D sniff-qa` 把它加入项目。`npx sniff-qa ci` 会写出一个 GitHub Actions 工作流，
它会缓存浏览器并保存报告。没有运行中的应用时，第一次运行只读取你的源码。
打开其中的 `Start the app` 步骤 (去掉 `#`) 并加上 `--url`，即可巡查应用。
</details>

## 工作原理

例子：你改了一个表单，结果一个你从没打开过的页面出现了服务器错误 (HTTP 500)。
sniff 会巡查你的链接能到达的页面，所以能在用户之前发现这个错误。

<img alt="sniff walking a buggy app and streaming findings with severity, confidence, steps to reproduce, and a fix" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/demo.gif" width="100%">

<img alt="How sniff works: crawl, act, assert, prove, report" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/how-it-works.svg" width="100%">

1. **找到应用。** 使用 `--url`，或常用端口上的开发服务器。
2. **巡查应用。** 没有窗口的 Chromium 会跟随链接、点击按钮、填写表单，就像用户一样。
3. **判断发生了什么。** 每个页面都会检查 12 类 bug。
4. **给出证明。** 一个发现必须有路由和步骤。有的话还会附上截图以及控制台或网络日志。
5. **报告。** 先给结论，再列出最该先修的问题，最后是细节。

12 类 bug：

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg">
  <img alt="The 12 classes of bugs sniff finds" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg" width="100%">
</picture>

没有运行中的应用时，`sniff` 会改为读取你的源码 (`sniff scan`)。它会标出调试语句、
占位文字和坏掉的 import，并告诉你如何开始真正的巡查。

MCP 服务器给你的智能体提供以下工具：

| 工具             | 作用                                                    |
| :--------------- | :------------------------------------------------------ |
| `sniff`          | 统一入口：`mode: "walk"`、`"scan"` 或 `"report"`        |
| `sniff_scan`     | 只扫描源码，不用浏览器                                  |
| `sniff_run`      | 源码扫描加浏览器检查                                    |
| `sniff_discover` | 根据源码写出测试路径并运行它们                          |
| `sniff_install`  | 下载引擎和 Chromium，并显示进度                         |
| `sniff_report`   | 读取最近一次保存的结果                                  |

`--caps scan,report` 把服务器限制为 `sniff_scan`、`sniff_report` 和主工具 `sniff`。这时它完全不用浏览器。

## 兼容的智能体

每一行都在 2026-11-17 测试过。前五行用 sniff 0.9.0 构建，安装相关的行用 0.9.4。

| 智能体         | 运行了什么                                                                          | 测试日期   |
| :------------- | :---------------------------------------------------------------------------------- | :--------- |
| Claude Code    | 把 sniff 作为 MCP 服务器的 `claude -p` 调用了 `sniff_scan` 并读到 2 个发现         | 2026-11-17 |
| Codex CLI      | 把 sniff 作为 MCP 服务器的 `codex exec` 调用了 `sniff_scan` 并读到 2 个发现        | 2026-11-17 |
| Gemini CLI     | `gemini extensions validate .` 接受了 `gemini-extension.json`                       | 2026-11-17 |
| 任何 MCP 客户端 | `node sniff-tests/mcp-smoke.mjs` 列出 6 个工具，一次巡查返回 20 个发现             | 2026-11-17 |
| Skills CLI     | `npx skills@1.9.0 add Aboudjem/sniff` 把 3 个 skills 装进了临时文件夹               | 2026-11-17 |
| Claude Code    | `claude mcp add -s user` 把 sniff-qa 写入一次性主目录的 `.claude.json` | 2026-11-17 |
| Codex CLI      | `codex mcp add` 把 sniff-qa 写入一次性主目录的 `config.toml` | 2026-11-17 |
| Gemini CLI     | `gemini extensions install` 在一次性主目录中安装并启用了 sniff | 2026-11-17 |
| Cursor         | `skills add -g -a cursor` 把 3 个 skills 放进一次性的 `~/.agents/skills` | 2026-11-17 |
| GitHub Copilot | `skills add -g -a github-copilot` 把 3 个 skills 放进 `~/.agents/skills` | 2026-11-17 |
| OpenCode       | `skills add -g -a opencode` 把 3 个 skills 放进 `~/.agents/skills` | 2026-11-17 |
| Claude Code    | `skills add -g -a claude-code` 把 3 个 skills 放进 `~/.claude/skills` | 2026-11-17 |
| Codex CLI      | `skills add -g -a codex` 把 3 个 skills 放进 `~/.agents/skills` | 2026-11-17 |
| Gemini CLI     | `skills add -g -a gemini-cli` 把 3 个 skills 放进 `~/.agents/skills` | 2026-11-17 |
| Skills CLI     | 没有终端时，`skills add -g` 装进了所有智能体的文件夹 | 2026-11-17 |

有文档但今天未测试：Windsurf 和 Zed。Cursor、Copilot 和 OpenCode 只测试了安装。
它们的配置片段在 [docs/editors.md](../docs/editors.md)。

## 证据

下面的命令会重新打印本页的数字。第一条打印测试应用上的得分。

```bash
npm run build && npm run proof
```

它启动预埋 bug 的测试应用，巡查它，并给报告打分。2026-11-17 的输出：

```text
  Recall:    21/21  (100%)
  Findings:  27 deduped (27 raw)
  Matched:   27   Candidate FP: 0   Precision proxy: 100%
  Hard FP on clean page (/clean): 0
```

上面的示例显示 26 个发现，并说明隐藏了 1 个低置信度发现。证据运行使用 `--all`，所以计入全部 27 个。

测试应用包含 21 个故意加入的 bug (预埋 bug)，覆盖全部 12 类。它还有一个没有 bug 的干净页面。
评分脚本是 [sniff-tests/score-fixture.mjs](../sniff-tests/score-fixture.mjs)。
bug 清单在 [sniff-tests/planted-bugs/MANIFEST.json](../sniff-tests/planted-bugs/MANIFEST.json)。

要得到和示例相同的报告，先启动测试应用。然后在另一个终端里运行 sniff：

```bash
node sniff-tests/planted-bugs/server.mjs 4517
npx sniff-qa --url http://localhost:4517
```
```bash
npm test
```

2026-11-17 打印 `Test Files  54 passed (54)` 和 `Tests  603 passed (603)`。
测试套件包含一个针对测试应用的检查。如果 sniff 找到的预埋 bug 少于 85%，构建就会失败。
如果 sniff 在干净页面上报告了任何问题，也会失败。

```bash
node sniff-tests/mcp-smoke.mjs
```

打印 6 个 MCP 工具，以及上表中提到的 20 个发现。

## 常见问题

**需要 API key 或账号吗？**
不需要。巡查和源码扫描都在你的机器上运行。除非你自己配置可选的 AI 探索，否则不会发送任何内容。

**巡查会改动我应用里的数据吗？**
会。巡查会点击按钮并提交真实表单，所以请把它指向开发或预发布环境的应用。

**什么都没崩溃，为什么以 1 退出？**
以 1 退出表示它找到了达到失败级别的 bug，所以 CI 会让构建失败。传入 `--fail-on none` 可以始终以 0 退出。

**它会修改我的代码吗？**
不会。巡查和扫描从不碰你的源码。只有 `sniff fix` 会编辑文件，而且只在你运行它时。

**能巡查需要登录的应用吗？**
能。传入 `--storage-state auth.json`。该文件中的 Cookie 和令牌值在写出的报告中会被隐藏。

更多解答见 [docs/faq.md](../docs/faq.md)。

## 局限

- 巡查需要一个运行中的应用。没有的话，只能得到源码扫描。
- 第一次巡查需要联网，下载一次引擎和 Chromium：约 440 MB，之后在 Mac 上约占 730 MB 磁盘。
- 在此之前，用到浏览器的 MCP 工具会返回 `needsSetup`，智能体会先调用 `sniff_install`。
- 死链检查会跟随外部链接，所以巡查会请求你的页面所链接的第三方 URL。
- 隐藏机密只作用于报告文字，不作用于截图。已登录页面的截图可能显示私人数据。
- 它找的是用户能看到的问题。它不读你的服务器日志，也不测负载。

## 了解更多

- [docs/editors.md](../docs/editors.md)：各智能体的安装和 MCP 配置片段
- [docs/authenticated-walks.md](../docs/authenticated-walks.md)：巡查需要登录的应用
- [docs/assert-budgets.md](../docs/assert-budgets.md)：在 `sniff.config` 中按严重级别限制发现数量
- [docs/comparison.md](../docs/comparison.md)：sniff 与 linter 和端到端测试工具的区别
- [CHANGELOG.md](../CHANGELOG.md) · [CONTRIBUTING.md](../CONTRIBUTING.md) · [LICENSE](../LICENSE)

---

<p align="center"><sub>Built by <a href="https://github.com/Aboudjem">Adam Boudjemaa</a> · <a href="../LICENSE">Apache 2.0</a> · built on <a href="https://playwright.dev">Playwright</a> and <a href="https://github.com/dequelabs/axe-core">axe-core</a></sub></p>

<p align="center"><sub>本文档由机器辅助翻译，英文版 <a href="../README.md">README.md</a> 为准。</sub></p>
