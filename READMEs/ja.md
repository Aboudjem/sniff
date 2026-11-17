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

<p align="center"><a href="../README.md">English</a> · <a href="zh-CN.md">简体中文</a> · <b>日本語</b> · <a href="es.md">Español</a> · <a href="fr.md">Français</a></p>

<p align="center"><b>Web アプリの壊れたページを、ユーザーより先に見つけます。</b></p>

sniff は動いているアプリを本物のブラウザで開き、ユーザーのようにクリックします。

| ユーザーより先にバグを発見 | 再現手順つき | 壊れたマージを止める |
|:--|:--|:--|
| 仕込んだバグ 21 件中 21 件を発見、誤検出 0 件：`npm run build && npm run proof`。 | ページのバグごとに、ルート、再現手順、修正案がつきます。 | `--fail-on` は critical か high のバグで 1 を返すので、CI がマージを止めます。 |

**対応：** すべての MCP クライアント、skills を読むすべてのエージェント、またはコマンドラインだけ。MCP はエージェントがツールを呼ぶための仕組みです。

テスト済み：Claude Code、Codex CLI。巡回に使うのはブラウザで、モデルではありません。

- **これは何か：** 動いている Web アプリのバグを見つけるツールです。テストを書く必要はありません。
- **いつ使うか：** コードを変えたあと、マージやリリースの前です。
- **何が得られるか：** 最初に判定、続いてバグごとのルート、手順、修正案です。

```bash
npx sniff-qa --url http://localhost:3000
```

## 得られるもの

このリポジトリの、バグを仕込んだテスト用アプリでの実際のレポートです (2026-11-17、sniff 0.9.3)：

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

開発用かステージング用のアプリを使ってください。巡回はボタンを押し、本物のフォームを送信します。

<p align="center"><a href="#得られるもの">得られるもの</a> · <a href="#インストール">インストール</a> · <a href="#仕組み">仕組み</a> · <a href="#対応エージェント">対応エージェント</a> · <a href="#根拠">根拠</a> · <a href="#faq">FAQ</a> · <a href="#制限">制限</a></p>

## インストール

**おすすめ：Vercel の skills CLI。** `npx skills` は、エージェント向け skills を入れる Vercel のオープンなインストーラーです。

```bash
npx skills add Aboudjem/sniff -g
```

70 以上のエージェントで使えます。メニューで自分のものを選んでください ([対応エージェント](https://github.com/vercel-labs/skills#supported-agents))。
ターミナルではエージェントのメニューを表示します。スクリプトではすべてのエージェントのフォルダーに入れるので、`-a <agent>` を足してください。
`-g` はすべてのプロジェクト向けに入れます。このプロジェクトだけにするには：`-g` を外します。
入るのは 3 つの skills だけです。MCP サーバーは別の 1 行の手順で、下にあります。

<p><a href="https://skills.sh/aboudjem/sniff"><img alt="skills.sh: sniff on the Vercel skills directory" src="https://img.shields.io/badge/skills.sh-000000?style=flat-square&logo=vercel&logoColor=white" height="24"></a> <a href="https://skills.sh/aboudjem/sniff">skills.sh/aboudjem/sniff</a></p>

**または、1 つのエージェントに直接入れる。** Node.js 22 以上が必要です。

<p><a href="#claude-code"><img alt="Claude Code" src="https://img.shields.io/badge/Claude_Code-D97757?style=flat-square&logo=claude&logoColor=white" height="24"></a> <a href="#codex"><img alt="Codex" src="https://img.shields.io/badge/Codex-000000?style=flat-square&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyBmaWxsPSJ3aGl0ZSIgcm9sZT0iaW1nIiB2aWV3Qm94PSIwIDAgMjQgMjQiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI%2BPHRpdGxlPk9wZW5BSTwvdGl0bGU%2BPHBhdGggZD0iTTIyLjI4MTkgOS44MjExYTUuOTg0NyA1Ljk4NDcgMCAwIDAtLjUxNTctNC45MTA4IDYuMDQ2MiA2LjA0NjIgMCAwIDAtNi41MDk4LTIuOUE2LjA2NTEgNi4wNjUxIDAgMCAwIDQuOTgwNyA0LjE4MThhNS45ODQ3IDUuOTg0NyAwIDAgMC0zLjk5NzcgMi45IDYuMDQ2MiA2LjA0NjIgMCAwIDAgLjc0MjcgNy4wOTY2IDUuOTggNS45OCAwIDAgMCAuNTExIDQuOTEwNyA2LjA1MSA2LjA1MSAwIDAgMCA2LjUxNDYgMi45MDAxQTUuOTg0NyA1Ljk4NDcgMCAwIDAgMTMuMjU5OSAyNGE2LjA1NTcgNi4wNTU3IDAgMCAwIDUuNzcxOC00LjIwNTggNS45ODk0IDUuOTg5NCAwIDAgMCAzLjk5NzctMi45MDAxIDYuMDU1NyA2LjA1NTcgMCAwIDAtLjc0NzUtNy4wNzI5em0tOS4wMjIgMTIuNjA4MWE0LjQ3NTUgNC40NzU1IDAgMCAxLTIuODc2NC0xLjA0MDhsLjE0MTktLjA4MDQgNC43NzgzLTIuNzU4MmEuNzk0OC43OTQ4IDAgMCAwIC4zOTI3LS42ODEzdi02LjczNjlsMi4wMiAxLjE2ODZhLjA3MS4wNzEgMCAwIDEgLjAzOC4wNTJ2NS41ODI2YTQuNTA0IDQuNTA0IDAgMCAxLTQuNDk0NSA0LjQ5NDR6bS05LjY2MDctNC4xMjU0YTQuNDcwOCA0LjQ3MDggMCAwIDEtLjUzNDYtMy4wMTM3bC4xNDIuMDg1MiA0Ljc4MyAyLjc1ODJhLjc3MTIuNzcxMiAwIDAgMCAuNzgwNiAwbDUuODQyOC0zLjM2ODV2Mi4zMzI0YS4wODA0LjA4MDQgMCAwIDEtLjAzMzIuMDYxNUw5Ljc0IDE5Ljk1MDJhNC40OTkyIDQuNDk5MiAwIDAgMS02LjE0MDgtMS42NDY0ek0yLjM0MDggNy44OTU2YTQuNDg1IDQuNDg1IDAgMCAxIDIuMzY1NS0xLjk3MjhWMTEuNmEuNzY2NC43NjY0IDAgMCAwIC4zODc5LjY3NjVsNS44MTQ0IDMuMzU0My0yLjAyMDEgMS4xNjg1YS4wNzU3LjA3NTcgMCAwIDEtLjA3MSAwbC00LjgzMDMtMi43ODY1QTQuNTA0IDQuNTA0IDAgMCAxIDIuMzQwOCA3Ljg3MnptMTYuNTk2MyAzLjg1NThMMTMuMTAzOCA4LjM2NCAxNS4xMTkyIDcuMmEuMDc1Ny4wNzU3IDAgMCAxIC4wNzEgMGw0LjgzMDMgMi43OTEzYTQuNDk0NCA0LjQ5NDQgMCAwIDEtLjY3NjUgOC4xMDQydi01LjY3NzJhLjc5Ljc5IDAgMCAwLS40MDctLjY2N3ptMi4wMTA3LTMuMDIzMWwtLjE0Mi0uMDg1Mi00Ljc3MzUtMi43ODE4YS43NzU5Ljc3NTkgMCAwIDAtLjc4NTQgMEw5LjQwOSA5LjIyOTdWNi44OTc0YS4wNjYyLjA2NjIgMCAwIDEgLjAyODQtLjA2MTVsNC44MzAzLTIuNzg2NmE0LjQ5OTIgNC40OTkyIDAgMCAxIDYuNjgwMiA0LjY2ek04LjMwNjUgMTIuODYzbC0yLjAyLTEuMTYzOGEuMDgwNC4wODA0IDAgMCAxLS4wMzgtLjA1NjdWNi4wNzQyYTQuNDk5MiA0LjQ5OTIgMCAwIDEgNy4zNzU3LTMuNDUzN2wtLjE0Mi4wODA1TDguNzA0IDUuNDU5YS43OTQ4Ljc5NDggMCAwIDAtLjM5MjcuNjgxM3ptMS4wOTc2LTIuMzY1NGwyLjYwMi0xLjQ5OTggMi42MDY5IDEuNDk5OHYyLjk5OTRsLTIuNTk3NCAxLjQ5OTctMi42MDY3LTEuNDk5N1oiLz48L3N2Zz4%3D" height="24"></a> <a href="#cursor"><img alt="Cursor" src="https://img.shields.io/badge/Cursor-000000?style=flat-square&logo=cursor&logoColor=white" height="24"></a> <a href="#gemini-cli"><img alt="Gemini CLI" src="https://img.shields.io/badge/Gemini-8E75B2?style=flat-square&logo=googlegemini&logoColor=white" height="24"></a> <a href="#github-copilot"><img alt="GitHub Copilot" src="https://img.shields.io/badge/Copilot-000000?style=flat-square&logo=githubcopilot&logoColor=white" height="24"></a> <a href="#opencode"><img alt="OpenCode" src="https://img.shields.io/badge/OpenCode-211E1E?style=flat-square&logo=opencode&logoColor=white" height="24"></a></p>

#### Claude Code

インストールをテスト済み。

```bash
npx skills add Aboudjem/sniff -g -a claude-code
```

MCP サーバー (テスト済み、すべてのプロジェクト向け)：

```bash
claude mcp add -s user sniff-qa -- npx -y sniff-qa --mcp
```

このプロジェクトだけにするには：`-s user` を外します。

#### Codex

インストールをテスト済み。

```bash
npx skills add Aboudjem/sniff -g -a codex
```

MCP サーバー (テスト済み、すべてのプロジェクト向け)：

```bash
codex mcp add sniff-qa -- npx -y sniff-qa --mcp
```

#### Cursor

インストールをテスト済み。

```bash
npx skills add Aboudjem/sniff -g -a cursor
```

#### Gemini CLI

インストールをテスト済み。

```bash
npx skills add Aboudjem/sniff -g -a gemini-cli
```

または拡張機能を追加します。MCP サーバーも一緒に入ります (インストールをテスト済み)：

```bash
gemini extensions install https://github.com/Aboudjem/sniff
```

#### GitHub Copilot

インストールをテスト済み。

```bash
npx skills add Aboudjem/sniff -g -a github-copilot
```

#### OpenCode

インストールをテスト済み。

```bash
npx skills add Aboudjem/sniff -g -a opencode
```

#### Claude Code プラグイン

skills と MCP サーバーを 1 回で追加します。[10x マーケットプレイス](https://github.com/Aboudjem/10x) から入れます：

```bash
claude plugin marketplace add Aboudjem/10x
claude plugin install sniff@10x
```

ほかの MCP クライアントは `npx -y sniff-qa --mcp` を実行します。エディターごとの設定例は [docs/editors.md](../docs/editors.md) にあります。

#### エージェントなし

インストールは不要です。アプリを起動し、別のターミナルから巡回します：

```bash
npx sniff-qa --url http://localhost:3000
```

npm パッケージ名は `sniff-qa` です。`npx sniff` は実行しないでください。無関係の別パッケージです。

#### 初回の実行

初回の巡回では約 440 MB を 1 回だけダウンロードします。Mac ではディスクを約 730 MB 使います。
ブラウザエンジン (Playwright、axe-core、Lighthouse) と、ブラウザ本体の Chromium を取得します。
前もって済ませるには次を実行します：

```bash
npx sniff-qa install
```

最後にかかった時間を表示します。キャッシュが空の Mac では 43 秒でした (2026-11-17、sniff 0.9.3)。
ディスクにはエンジン 193 MB と Chromium 530 MB が残りました。
サイズはプラットフォームによって変わります。macOS で測り直すには：

```bash
du -sm ~/.cache/sniff-qa/engine/* ~/Library/Caches/ms-playwright
```

`npx sniff-qa doctor` は Node、ブラウザ、開発サーバーを確認します。

MCP サーバーはこれらのダウンロードより前に起動します。npm キャッシュが空の状態で、`npx -y sniff-qa@0.9.1 --mcp`
は最初のリクエストに 3.1〜4.9 秒で応答しました (5 回、2026-11-17)。バージョン 0.9.0 は 37〜93 秒かかり、
Claude Code の 30 秒の接続制限を超えていました。測り直すには、このリポジトリのクローンで：

```bash
npm run cold-start -- 0.9.1 5
```

巡回は進行状況の行を表示し、続いてレポートを出します。結果は 4 つの形で受け取れます：

| 出力               | フラグ      | 用途                                       |
| :----------------- | :---------- | :----------------------------------------- |
| ターミナルのレポート | (既定)      | 結果をすぐ読む                             |
| HTML ページ        | `--report`  | 共有する：すべてが入った 1 つのファイル    |
| JSON               | `--json`    | スクリプトや他のツール                     |
| 終了コード         | `--fail-on` | 本物のバグで CI を失敗させる               |

| 終了コード | 意味                                                                                       |
| :--------- | :----------------------------------------------------------------------------------------- |
| `0`        | `--fail-on` の重大度 (既定：critical と high) に達した指摘はない                          |
| `1`        | 指摘がそれに達した、`assert` の上限を超えた、または sniff を実行できなかった               |

<details>
<summary>プロジェクトへのインストールと CI</summary>

悪いマージを止めるには、CI で `--fail-on` を使います。既定は critical と high です。
`npm install -D sniff-qa` でプロジェクトに追加できます。`npx sniff-qa ci` は GitHub Actions のワークフローを書き出します。
そのワークフローはブラウザをキャッシュし、レポートを保存します。アプリが動いていない場合、最初の実行はソースコードを読むだけです。
`Start the app` のステップを有効にし (`#` を外す)、`--url` を足すとアプリを巡回します。
</details>

## 仕組み

例：フォームを 1 つ変えたら、開いたこともないページがサーバーエラー (HTTP 500) を出すようになった。
sniff はリンクからたどれるページを巡回するので、ユーザーより先にそのエラーを見つけられます。

<img alt="sniff walking a buggy app and streaming findings with severity, confidence, steps to reproduce, and a fix" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/demo.gif" width="100%">

<img alt="How sniff works: crawl, act, assert, prove, report" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/how-it-works.svg" width="100%">

1. **アプリを見つける。** `--url`、またはよく使われるポートの開発サーバーを使います。
2. **巡回する。** ウィンドウのない Chromium がリンクをたどり、ボタンを押し、フォームを埋めます。ユーザーと同じです。
3. **起きたことを判定する。** 各ページを 12 種類のバグについて確認します。
4. **証明する。** 指摘にはルートと手順が必要です。あればスクリーンショットとコンソールやネットワークの行も添えます。
5. **報告する。** 最初に判定、次に先に直すもののリスト、そして詳細です。

12 種類のバグ：

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg">
  <img alt="The 12 classes of bugs sniff finds" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg" width="100%">
</picture>

アプリが動いていなければ、`sniff` は代わりにソースコードを読みます (`sniff scan`)。デバッグ用の文、
仮のテキスト、壊れた import を指摘し、本当の巡回を始める方法を教えます。

MCP サーバーはエージェントに次のツールを渡します：

| ツール           | 内容                                                         |
| :--------------- | :----------------------------------------------------------- |
| `sniff`          | 入口は 1 つ：`mode: "walk"`、`"scan"`、`"report"`            |
| `sniff_scan`     | ソースコードだけを調べる。ブラウザなし                       |
| `sniff_run`      | ソースコードの検査とブラウザでの確認                         |
| `sniff_discover` | ソースからテスト経路を書き、それを実行する                   |
| `sniff_install`  | エンジンと Chromium を進捗つきでダウンロードする             |
| `sniff_report`   | 最後に保存した結果を読む                                     |

`--caps scan,report` はサーバーを `sniff_scan`、`sniff_report`、メインの `sniff` ツールに絞ります。その場合ブラウザは一切使いません。

## 対応エージェント

各行は 2026-11-17 にテストしました。最初の 5 行は sniff 0.9.0、インストールの行は 0.9.4 を使いました。

| エージェント     | 実行した内容                                                                              | テスト日   |
| :--------------- | :---------------------------------------------------------------------------------------- | :--------- |
| Claude Code      | MCP サーバーとして sniff を入れた `claude -p` が `sniff_scan` を呼び、2 件の指摘を読んだ | 2026-11-17 |
| Codex CLI        | MCP サーバーとして sniff を入れた `codex exec` が `sniff_scan` を呼び、2 件の指摘を読んだ | 2026-11-17 |
| Gemini CLI       | `gemini extensions validate .` が `gemini-extension.json` を受け入れた                    | 2026-11-17 |
| すべての MCP クライアント | `node sniff-tests/mcp-smoke.mjs` が 6 つのツールを列挙し、巡回が 20 件の指摘を返した | 2026-11-17 |
| Skills CLI       | `npx skills@1.9.0 add Aboudjem/sniff` が 3 つの skills を一時フォルダーに入れた           | 2026-11-17 |
| Claude Code      | `claude mcp add -s user` が使い捨てホームの `.claude.json` に sniff-qa を書き込んだ | 2026-11-17 |
| Codex CLI        | `codex mcp add` が使い捨てホームの `config.toml` に sniff-qa を書き込んだ | 2026-11-17 |
| Gemini CLI       | `gemini extensions install` が使い捨てホームに sniff を入れて有効にした | 2026-11-17 |
| Cursor           | `skills add -g -a cursor` が使い捨ての `~/.agents/skills` に 3 つの skills を入れた | 2026-11-17 |
| GitHub Copilot   | `skills add -g -a github-copilot` が `~/.agents/skills` に 3 つの skills を入れた | 2026-11-17 |
| OpenCode         | `skills add -g -a opencode` が `~/.agents/skills` に 3 つの skills を入れた | 2026-11-17 |
| Claude Code      | `skills add -g -a claude-code` が `~/.claude/skills` に 3 つの skills を入れた | 2026-11-17 |
| Codex CLI        | `skills add -g -a codex` が `~/.agents/skills` に 3 つの skills を入れた | 2026-11-17 |
| Gemini CLI       | `skills add -g -a gemini-cli` が `~/.agents/skills` に 3 つの skills を入れた | 2026-11-17 |
| Skills CLI       | ターミナルなしの `skills add -g` がすべてのエージェントのフォルダーに入れた | 2026-11-17 |

文書化済みだが今日はテストしていないもの：Windsurf、Zed。Cursor、Copilot、OpenCode はインストールだけをテストしました。
設定例は [docs/editors.md](../docs/editors.md) にあります。

## 根拠

次のコマンドで、このページの数字をもう一度表示できます。最初のものはテスト用アプリでのスコアを出します。

```bash
npm run build && npm run proof
```

バグを仕込んだテスト用アプリを起動し、巡回し、レポートを採点します。2026-11-17 の出力：

```text
  Recall:    21/21  (100%)
  Findings:  27 deduped (27 raw)
  Matched:   27   Candidate FP: 0   Precision proxy: 100%
  Hard FP on clean page (/clean): 0
```

上の例は 26 件の指摘を示し、信頼度の低い指摘 1 件を隠したと書いています。根拠の実行は `--all` を使うので、27 件すべてを数えます。

テスト用アプリには、わざと入れたバグ (仕込んだバグ) が 12 種類すべてにわたって 21 件あります。バグのないきれいなページも 1 つあります。
採点スクリプトは [sniff-tests/score-fixture.mjs](../sniff-tests/score-fixture.mjs) です。
バグの一覧は [sniff-tests/planted-bugs/MANIFEST.json](../sniff-tests/planted-bugs/MANIFEST.json) にあります。

例と同じレポートを得るには、テスト用アプリを起動します。そして別のターミナルで sniff を実行します：

```bash
node sniff-tests/planted-bugs/server.mjs 4517
npx sniff-qa --url http://localhost:4517
```
```bash
npm test
```

2026-11-17 に `Test Files  54 passed (54)` と `Tests  603 passed (603)` を表示しました。
テストスイートにはテスト用アプリでのチェックが入っています。仕込んだバグの発見が 85% 未満ならビルドを失敗させます。
きれいなページで sniff が何かを報告した場合も失敗します。

```bash
node sniff-tests/mcp-smoke.mjs
```

6 つの MCP ツールと、上の表にある 20 件の指摘を表示します。

## FAQ

**API キーやアカウントは必要ですか？**
いいえ。巡回とソースの検査はあなたのマシンで動きます。オプションの AI 探索を自分で設定しない限り、何も送信されません。

**巡回でアプリのデータが変わることはありますか？**
あります。巡回はボタンを押し、本物のフォームを送信するので、開発用かステージング用のアプリに向けてください。

**何も落ちていないのに、なぜ 1 で終了したのですか？**
1 での終了は、失敗扱いの重大度のバグを見つけたという意味で、CI はビルドを失敗させます。常に 0 で終了させるには `--fail-on none` を渡します。

**コードを書き換えますか？**
いいえ。巡回と検査はソースに一切触れません。ファイルを編集するのは `sniff fix` だけで、あなたが実行したときだけです。

**ログインが必要なアプリも巡回できますか？**
はい。`--storage-state auth.json` を渡します。そのファイルの Cookie とトークンの値は、書き出したレポートでは隠されます。

ほかの回答は [docs/faq.md](../docs/faq.md) にあります。

## 制限

- 巡回には動いているアプリが必要です。アプリがなければソースの検査だけになります。
- 初回の巡回では、エンジンと Chromium を 1 回ダウンロードするためにインターネットが必要です。約 440 MB で、Mac ではその後ディスクを約 730 MB 使います。
- それまでは、ブラウザを使う MCP ツールは `needsSetup` を返し、エージェントが先に `sniff_install` を呼びます。
- リンク切れの確認は外部リンクもたどるので、巡回はページがリンクする外部の URL にリクエストを送ります。
- 秘密の値を隠す処理はレポートの文字に効き、スクリーンショットには効きません。ログイン後のページのスクリーンショットには個人データが写ることがあります。
- ユーザーに見えるものを見つけます。サーバーのログは読まず、負荷も測りません。

## さらに詳しく

- [docs/editors.md](../docs/editors.md)：各エージェント向けのインストールと MCP の設定例
- [docs/authenticated-walks.md](../docs/authenticated-walks.md)：ログインが必要なアプリの巡回
- [docs/assert-budgets.md](../docs/assert-budgets.md)：`sniff.config` で重大度ごとに指摘数の上限を決める
- [docs/comparison.md](../docs/comparison.md)：sniff とリンターや E2E (エンドツーエンド) テストツールの違い
- [CHANGELOG.md](../CHANGELOG.md) · [CONTRIBUTING.md](../CONTRIBUTING.md) · [LICENSE](../LICENSE)

---

<p align="center"><sub>Built by <a href="https://github.com/Aboudjem">Adam Boudjemaa</a> · <a href="../LICENSE">Apache 2.0</a> · built on <a href="https://playwright.dev">Playwright</a> and <a href="https://github.com/dequelabs/axe-core">axe-core</a></sub></p>

<p align="center"><sub>この文書は機械翻訳を利用して作成されています。正典は英語版の <a href="../README.md">README.md</a> です。</sub></p>
