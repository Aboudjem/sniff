<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/logo-light.svg">
  <img alt="Sniff" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/logo-light.svg" width="100%">
</picture>

<p align="center">
  <a href="https://www.npmjs.com/package/sniff-qa"><img src="https://img.shields.io/npm/v/sniff-qa?color=ef4444&logo=npm&label=npm&style=flat-square" alt="npm"></a>
  <a href="https://www.npmjs.com/package/sniff-qa"><img src="https://img.shields.io/npm/dm/sniff-qa?color=ef4444&logo=npm&label=downloads&style=flat-square" alt="npm downloads"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache_2.0-ef4444?style=flat-square" alt="License"></a>
  <a href="https://github.com/Aboudjem/sniff/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Aboudjem/sniff/ci.yml?style=flat-square&label=CI" alt="CI"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%E2%89%A522-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node"></a>
  <a href="https://github.com/Aboudjem/10x"><img src="https://img.shields.io/badge/10x-marketplace-ef4444?style=flat-square" alt="10x marketplace"></a>
  <a href="https://github.com/Aboudjem/sniff/stargazers"><img src="https://img.shields.io/github/stars/Aboudjem/sniff?style=flat-square&color=ef4444" alt="Stars"></a>
</p>

<p align="center">
  <a href="../README.md">English</a> ·
  <b>简体中文</b> ·
  <a href="ja.md">日本語</a> ·
  <a href="es.md">Español</a> ·
  <a href="fr.md">Français</a>
</p>

<p align="center"><b>将其指向正在运行的应用，它会在真实浏览器中走完真实用户流程，并告诉你哪里真的坏了，附带证明。</b></p>

<p align="center">
  <a href="#快速开始">快速开始</a> ·
  <a href="#它能发现什么">它能发现什么</a> ·
  <a href="#为什么可以信任它">为何值得信任</a> ·
  <a href="#它是如何工作的">工作原理</a> ·
  <a href="#演示">演示</a> ·
  <a href="#常见问题">常见问题</a>
</p>

![sniff demo](../.github/assets/demo.gif)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/sniff-diagram.svg">
  <img alt="Sniff 流程：你的运行中应用 -> 无头浏览器遍历 -> 附带证明的发现结果" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/sniff-diagram.svg" width="100%">
</picture>

---

## 这是什么？

Sniff 是一款自主 QA 扫描工具。你将其指向一个正在运行的 Web 应用，它会**在真实（无头）浏览器中走完应用的真实用户流程**（点击按钮、填写表单、跟随链接），并报告哪里真的出了问题。

它**不是**代码检查工具，也**不是**静态扫描器。它会打开你的页面，像用户一样与之交互，并观察发生了什么。

它报告的每个 Bug 都附带**证明**：确切的页面、有序的复现步骤、截图，以及捕获问题的控制台或网络摘录。没有复现证明的发现不算发现。

```bash
npx sniff-qa --url http://localhost:3000
```

一条命令，无需配置，无需 API 密钥，无需 Playwright 安装。将其指向正在运行的应用，或者直接在项目中运行 `npx sniff-qa`，它会自动检测常用端口上的开发服务器。

> Sniff 需要遍历**正在运行的应用**。如果没有开发服务器在运行，它会退回到源代码扫描模式，并告诉你如何启动真正的遍历流程。详见[快速开始](#快速开始)。

---

## 快速开始

你需要 **Node.js 22+** 以及一个可以在本地运行的 Web 应用（或一个 URL）。

> **命名说明：** npm 包名为 **`sniff-qa`**，请使用 `npx sniff-qa` 或 `npm install -D sniff-qa`。安装后，二进制文件名为 **`sniff`**（`sniff-qa` 二进制也可用）。不要运行 `npx sniff`，那是另一个包。

### 1. 启动你的应用

```bash
npm run dev        # 或者你启动应用的其他方式
```

### 2. 开始遍历

在另一个终端中：

```bash
npx sniff-qa --url http://localhost:3000     # 指向正在运行的应用
```

这是最可靠的单行命令。Sniff 还会**自动检测**常用端口上的开发服务器，因此在项目目录下通常可以直接运行 `npx sniff-qa` 而无需任何参数。如果你的应用运行在非标准端口（或自动检测未命中），请传入 `--url`（始终有效）。它也可以遍历已部署的 URL：

```bash
npx sniff-qa --url https://staging.myapp.com
```

> **发现 Bug 时会以非零状态退出，这是故意的。** 发现问题的遍历会以退出码 `1` 退出，从而让 CI 构建失败；这**不是**崩溃（你会看到 `✓ Scan complete` 这一行）。传入 `--fail-on none` 可使其始终以 `0` 退出。

> **首次运行会下载浏览器。** Sniff 首次打开浏览器时，会下载一个 Chromium 构建版本（约 165 MB，仅需一次）。你会看到下载进度。首次运行需要互联网连接，之后会缓存在本地。

### 3. 阅读报告

发现结果会打印到终端，按严重程度分组，每条都带有复现步骤。想要一个可分享的页面？

```bash
npx sniff-qa --url http://localhost:3000 --report   # 运行遍历后生成 sniff-reports/sniff-report.html（自包含文件）
```

**没有应用在运行？** Sniff 不会静默失败。它会执行源代码扫描并打印清晰的下一步提示（启动开发服务器或传入 `--url`），让你能够进行真正的流程遍历。你也可以主动运行源代码扫描：

```bash
npx sniff-qa scan         # 仅源代码扫描，不打开浏览器
```

遇到问题？运行 `npx sniff-qa doctor` 检查你的环境（Node、浏览器、开发服务器）。

---

## 它能发现什么

Sniff 遍历你的应用，查找 **12 类真实 Bug**：

| # | 类别 | 示例 |
|:--|:------|:---------|
| 1 | **页面/路由损坏** | 4xx/5xx 响应、空白渲染、崩溃页面 |
| 2 | **链接失效** | 无效的内部和外部链接 |
| 3 | **控制台和网络错误** | *交互过程中*未捕获的异常和失败的请求 |
| 4 | **空数据和假数据** | 数据缺失，以及 `lorem ipsum`、`TODO`、`test@test.com` 等占位符 |
| 5 | **表单损坏** | 失效的提交按钮、从不触发的验证 |
| 6 | **状态丢失** | 填完表单后点击返回，内容被清空 |
| 7 | **流程回退/死路** | 无法完成的用户旅程 |
| 8 | **加载和错误状态异常** | 无限转圈、缺少错误状态 |
| 9 | **异步结果损坏** | 已提交但无成功反馈（标记为"需要带外验证"） |
| 10 | **响应式问题** | 内容溢出和过小的点击目标（375px 移动端检测） |
| 11 | **无障碍性** | 缺少 alt 文字和标签、对比度不足，通过 [axe-core](https://github.com/dequelabs/axe-core) 检测 |
| 12 | **主要操作不明确** | 核心行动号召被埋没或含糊不清 |

每条发现结果都包含：

- **复现证明**：确切的路由、有序的步骤、截图，以及控制台/网络摘录。
- **严重程度**，让你优先修复最重要的问题。
- **置信度**：`confirmed`（已确认）、`likely`（可能）或 `uncertain`（不确定）。不确定的发现默认隐藏，添加 `--all` 可查看。
- **修复建议。**

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg">
  <img alt="Sniff 能发现的 Bug 类别" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg" width="100%">
</picture>

---

## 为什么可以信任它

大多数扫描工具会用大量误报淹没你，直到你停止阅读它们。Sniff 的设计方向恰恰相反。

我们在一个预先植入了 **21 个 Bug（覆盖全部 12 类）** 的固定应用上进行了测量，同时还有一个干净的对照页面（应产生零发现结果）：

| | 旧引擎 | 新引擎 |
|:--|:--|:--|
| 发现的 Bug | 9 / 21 (43%) | **21 / 21 (100%)** |
| 精确率 | ~13% | **100%** |
| 误报数 | 125 | **0** |
| 干净页面上的发现数 | 不适用 | **0** |
| 核心命令 | 崩溃 | 正常运行 |

这些数字已作为回归测试锁定。完整测试套件共 **441 个测试**。

**它如何将误报保持在接近零的水平：**

- 内置**噪声过滤器**，过滤掉与你的 Bug 无关的杂项：favicon、分析请求、热模块替换日志、预期的认证重定向、引擎中止。
- 无障碍性发现由 **axe-core** 支撑，该工具本身的设计目标就是零误报。
- **不确定的发现默认被抑制**（使用 `--all` 可查看）。
- 一个损坏的页面只报告**一次**，不会在每个指向它的链接处重复标记。

如果 Sniff 无法证明一个 Bug，它就不会声称存在这个 Bug。

---

## 它有何不同？

代码检查工具读取你的源文件，从不运行你的应用。端到端框架要求*你*来编写测试。链接检查工具只检查链接。Sniff 驱动你的真实应用并对结果作出判断。

| | **Sniff** | linkinator | pa11y | Playwright codegen | QA-Wolf 类服务 |
|:--|:--|:--|:--|:--|:--|
| 在浏览器中走真实用户流程 | **是** | 否 | 否 | 由你编写脚本 | 是 |
| 零配置、无需编写测试 | **是** | 是 | 是 | 否（需编写测试） | 否（需入驻） |
| 链接失效检测 | **是** | 是 | 否 | 手动 | 手动 |
| 无障碍性检测 (axe-core) | **是** | 否 | **是** | 手动 | 部分 |
| 空数据/占位符/假数据检测 | **是** | 否 | 否 | 否 | 否 |
| 状态丢失（返回键清空表单） | **是** | 否 | 否 | 手动 | 手动 |
| 每条发现附带一份复现证明 | **是** | 否 | 部分 | 否 | 不定 |
| 自包含 HTML 报告 | **是** | 否 | 部分 | 否 | 控制台面板 |
| 本地运行、无需账号和 API 密钥 | **是** | 是 | 是 | 是 | 否（需注册服务） |

Sniff 通过一条命令独特地实现了：捕获**空数据/占位符数据**、**状态丢失**和**异步结果损坏**，并提供一份完整的证明报告，**无需编写任何脚本，也无需注册任何服务**。

---

## 命令

```
sniff                  遍历你的应用（自动检测开发服务器）。默认模式。
sniff --url <url>      遍历指定的 URL
sniff scan             仅源代码扫描，不打开浏览器（占位符、TODO、死链等）
sniff report           显示上次运行的结果
sniff doctor           检查你的环境（Node、浏览器、配置、开发服务器）
sniff ci               生成 GitHub Actions 工作流
sniff fix              自动修复安全问题（console.log、debugger 等）
sniff --help           显示所有命令和参数
sniff --version        显示版本号
```

### 常用参数

| 参数 | 功能说明 |
|:-----|:-------------|
| `--url <url>` | 遍历此 URL，而非自动检测 |
| `--report` | 将自包含 HTML 报告写入 `sniff-reports/sniff-report.html` |
| `--all` | 同时显示低置信度（`uncertain`）的发现结果 |
| `--max-pages <n>` | 限制遍历页面数量上限（默认：25） |
| `--no-mobile` | 跳过 375px 响应式检测 |
| `--headed` | 遍历时显示浏览器窗口 |
| `--json` | 机器可读的 JSON 输出 |
| `--ci` | CI 模式（输出稳定，非交互式） |
| `--fail-on <sev>` | 在严重程度达到或超过此级别时以非零状态退出 |

---

## 演示

针对一个有问题的应用的真实运行：21 个真实问题、零误报，每条发现结果都附有严重程度、置信度、复现步骤和修复建议。观看 Sniff 遍历应用并实时输出发现结果（动态演示在本 README 顶部播放，[`.github/assets/demo.gif`](../.github/assets/demo.gif)）。

以下是同一次运行的终端静态截图：

<img alt="Sniff 遍历一个有问题的应用并报告 21 个真实问题，零误报" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/demo.svg" width="100%">

---

## 在 AI 编辑器中使用

Sniff 同时也作为 MCP 服务器发布。添加一次后，直接让你的助手"扫描这个项目中的 Bug"或"遍历我的应用"即可。如果你的应用正在运行，Sniff 会自动检测它，无需传入 URL。

**一个统一的 `sniff` 工具，三种模式：**

- `walk`：**推荐。** 遍历正在运行的应用的真实流程（即上文的流程遍历）。
- `scan`：仅源代码扫描，不打开浏览器。
- `report`：显示上次运行的结果。

（`run` 和 `discover` 是为向后兼容而保留的旧版模式。）

### 斜杠命令和 MCP 工具

作为 Claude Code 插件，Sniff 添加了三个斜杠命令：

| 斜杠命令 | 功能说明 |
|:--------------|:-------------|
| `/sniff` | 遍历正在运行的应用并发现真实 Bug（流程遍历）。 |
| `/sniff-fix` | 扫描并自动修复安全问题（多余的 `console.log`、`debugger` 等）。 |
| `/sniff-report` | 显示上次运行的结果。 |

作为 MCP 服务器，接口为**一个统一的 `sniff` 工具**，接受 `{ mode, rootDir, baseUrl? }` 参数。上述三种模式（`walk` / `scan` / `report`）是驱动它的方式，你应该使用这个统一工具。单一用途的独立工具（`sniff_scan`、`sniff_run`、`sniff_report`，以及 `sniff_discover` 和 `sniff_install`）为向后兼容和范围化能力而保留注册，但新工作应通过统一的 `sniff` 工具进行。

### 将技能安装到任意 AI CLI

上述 MCP 服务器适用于所有支持 MCP 的客户端。如需将 `/sniff` 技能直接加载到其他 CLI，请运行单行安装命令。它会将三个技能符号链接到该 CLI 的技能目录；`--update` 可拉取最新版本并重新链接，`--uninstall` 可移除它们。

```bash
curl -fsSL https://raw.githubusercontent.com/Aboudjem/sniff/main/install.sh | bash -s codex
```

在 Windows 上，请从检出目录运行 `install.ps1 <platform>`（符号链接需要开发者模式或提升权限的 Shell）。

| 平台 | 技能目录 | 单行命令 |
|:--|:--|:--|
| Claude Code | （插件） | `claude plugin install sniff@10x` |
| Codex / Gemini / OpenCode / Pi | `~/.agents/skills` | `install.sh codex` |
| VS Code (Copilot) | `~/.copilot/skills` | `install.sh copilot` |
| Trae | `~/.trae/skills` | `install.sh trae` |
| Vibe | `~/.vibe/skills` | `install.sh vibe` |
| OpenClaw | `~/.openclaw/skills` | `install.sh openclaw` |
| Antigravity | `~/.gemini/antigravity/skills` | `install.sh antigravity` |
| Hermes / Cline / Kimi | `~/.<cli>/skills` | `install.sh hermes` |

CLI 版本之间技能目录的约定可能会变化。如果某个链接无法解析，请退回到 MCP 服务器（适用于所有平台）。运行 `install.sh all` 可一次性链接所有平台。

<details>
<summary><b>Claude Code</b></summary>

从 [10x marketplace](https://github.com/Aboudjem/10x) 一键安装插件：

```bash
claude plugin marketplace add Aboudjem/10x
claude plugin install sniff@10x
```

或仅添加 MCP 服务器：

```bash
claude mcp add sniff-qa npx -- -y sniff-qa --mcp
```
</details>

<details>
<summary><b>Cursor</b></summary>

添加到 `~/.cursor/mcp.json`：

```json
{ "mcpServers": { "sniff-qa": { "command": "npx", "args": ["-y", "sniff-qa", "--mcp"] } } }
```
</details>

<details>
<summary><b>VS Code (Copilot)</b></summary>

添加到 `.vscode/mcp.json`：

```json
{ "servers": { "sniff-qa": { "type": "stdio", "command": "npx", "args": ["-y", "sniff-qa", "--mcp"] } } }
```
</details>

<details>
<summary><b>Codex CLI</b></summary>

```bash
codex mcp add sniff-qa -- npx -y sniff-qa --mcp
```
</details>

<details>
<summary><b>Gemini CLI</b></summary>

添加到 `~/.gemini/mcp_config.json`：

```json
{ "mcpServers": { "sniff-qa": { "command": "npx", "args": ["-y", "sniff-qa", "--mcp"] } } }
```
</details>

<details>
<summary><b>Windsurf</b></summary>

添加到 `~/.codeium/windsurf/mcp_config.json`：

```json
{ "mcpServers": { "sniff-qa": { "command": "npx", "args": ["-y", "sniff-qa", "--mcp"] } } }
```
</details>

<details>
<summary><b>Continue.dev</b></summary>

添加到 `.continue/mcpServers/sniff-qa.yaml`：

```yaml
mcpServers:
  sniff-qa: { command: npx, args: ["-y", "sniff-qa", "--mcp"], type: stdio }
```
</details>

> 首次基于浏览器的遍历会下载 Chromium（约 165 MB）。通过 MCP 使用时，Sniff 会返回一个结构化的 `needsSetup` 响应，而非在编辑器中阻塞等待漫长的下载：按照提示完成安装后，再次发起请求即可。

---

## 它是如何工作的

1. **找到应用。** Sniff 自动检测正在运行的开发服务器（或由你传入 `--url`）。
2. **遍历流程。** 它在无头浏览器中打开页面，像用户一样与之交互（点击、填写表单、跟随链接），覆盖桌面端和 375px 移动端检测。
3. **监控一切。** 遍历过程中记录控制台错误、失败的网络请求、渲染异常、缺少反馈以及无障碍性问题。
4. **过滤噪声。** 内置噪声过滤器和 axe-core 剔除误报；不确定的发现被保留不展示。
5. **附证明报告。** 每条存留的发现结果都包含严重程度、置信度、复现步骤、截图和修复建议，在终端中显示，并可选生成 HTML 报告。

<img alt="Sniff 的工作原理：爬取、交互、断言、证明、报告" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/how-it-works.svg" width="100%">

---

## CI 集成

在流水线中运行 Sniff，并在发现真实 Bug 时使构建失败：

```bash
npx sniff-qa --ci --fail-on high
```

生成一个可直接提交的 GitHub Actions 工作流：

```bash
npx sniff-qa ci
```

这会写入 `.github/workflows/sniff.yml`，包含浏览器缓存和报告产物配置。

---

## 常见问题

**没有开发服务器时能用吗？**
Sniff 的设计目标是遍历*正在运行*的应用，那是它最能发挥价值的地方。如果没有服务器在运行，它不会静默失败：它会执行源代码扫描，并告诉你确切的下一步（启动开发服务器或传入 `--url`）。你也可以主动运行 `npx sniff-qa scan` 来获取源代码扫描结果。

**首次运行会下载什么？**
Sniff 首次打开浏览器时，会下载一个 Chromium 构建版本（约 165 MB，仅需一次，之后缓存在本地）。你会看到下载进度，首次运行需要互联网连接。不会安装其他任何东西，也不会创建账号。

**需要 API 密钥吗？**
不需要。Sniff 完全在你的本地机器上运行，无需 API 密钥，无需注册。你的代码和应用不会离开你的电脑。

**它与代码检查工具有何不同？**
代码检查工具读取源文件，从不运行你的应用，因此它看不到失效的提交按钮、无限转圈、被清空的表单或 500 页面。Sniff 打开你的真实应用，与之交互，并报告真正出错的内容，附带截图和复现步骤。

**它与 Playwright codegen（或编写端到端测试）有何不同？**
Playwright codegen 录制一个由*你*编写和维护的脚本，它只测试你点击的路径。Sniff 不需要你维护任何东西：它自行探索你的流程并对结果作出判断，能捕获录制的快乐路径从不检查的内容（空数据/占位符数据、状态丢失、缺少成功反馈）。

**它会修改我的代码吗？**
遍历过程中不会。遍历和扫描是只读操作。单独的 `sniff fix` 命令会应用安全的自动修复（如多余的 `console.log`/`debugger`），且仅在你主动运行时生效。

**支持哪些技术栈？**
任何可以在浏览器中打开的 Web 应用：React、Next.js、Vue、Svelte、Angular、Remix、SvelteKit、Astro、纯 HTML 等。它遍历渲染后的应用，因此框架对浏览器检测没有影响。

---

## 一流支持的平台

Claude Code · Cursor · VS Code (Copilot) · Codex · Gemini CLI · Windsurf · Continue.dev，通过 MCP 服务器（命令 `npx`，参数 `["-y", "sniff-qa", "--mcp"]`）或直接使用 CLI。

---

## Star 历史

<a href="https://star-history.com/#Aboudjem/sniff&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Aboudjem/sniff&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Aboudjem/sniff&type=Date" />
    <img alt="Aboudjem/sniff 的 Star 历史图表" src="https://api.star-history.com/svg?repos=Aboudjem/sniff&type=Date" width="70%" />
  </picture>
</a>

---

## 贡献

欢迎提交 Issue 和 PR。详见 [CONTRIBUTING.md](../CONTRIBUTING.md)。

---

<p align="center">
  <sub>
    构建于 <a href="https://playwright.dev">Playwright</a> · <a href="https://github.com/dequelabs/axe-core">axe-core</a> · <a href="https://developer.chrome.com/docs/lighthouse">Lighthouse</a> · <a href="https://github.com/mapbox/pixelmatch">pixelmatch</a> · <a href="https://zod.dev">Zod</a> · <a href="https://github.com/modelcontextprotocol/typescript-sdk">MCP SDK</a>
  </sub>
</p>

<p align="center">
  <a href="https://www.linkedin.com/in/adam-boudjemaa/"><img src="https://img.shields.io/badge/LinkedIn-0A66C2?style=flat-square&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
  <a href="https://x.com/AdamBoudj"><img src="https://img.shields.io/badge/X-000000?style=flat-square&logo=x&logoColor=white" alt="X"></a>
  <a href="https://adam-boudjemaa.com/"><img src="https://img.shields.io/badge/Website-ef4444?style=flat-square&logo=googlechrome&logoColor=white" alt="网站"></a>
</p>

<p align="center">
  <sub>由 <a href="https://github.com/Aboudjem">Adam Boudjemaa</a> 构建 · <a href="../LICENSE">Apache 2.0</a></sub>
</p>

*本译文由机器辅助生成。欢迎母语为中文的贡献者提交 PR 进行修正和改进。英文版 README（[../README.md](../README.md)）为最终参考来源。*
