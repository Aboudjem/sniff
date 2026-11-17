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

<p align="center"><a href="../README.md">English</a> · <a href="zh-CN.md">简体中文</a> · <b>日本語</b> · <a href="es.md">Español</a> · <a href="fr.md">Français</a></p>

<p align="center"><b>ユーザーより先に、Web アプリの壊れた箇所を見つけます。</b></p>

<p align="center"><a href="#得られるもの">得られるもの</a> · <a href="#インストール">インストール</a> · <a href="#仕組み">仕組み</a> · <a href="#対応エージェント">対応エージェント</a> · <a href="#根拠">根拠</a> · <a href="#faq">FAQ</a> · <a href="#制限">制限</a></p>

```bash
npx sniff-qa --url http://localhost:3000
```

## 得られるもの

判定から始まり、次に最初に直すべき 3 件、その後にすべての検出結果が続くレポートです。
以下は、このリポジトリのバグ埋め込みフィクスチャで実際に実行したときのレポートです (2026-11-17、sniff 0.9.3)。

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

フォームを 1 つ変えたら、一度も開いていないページが 500 を返すようになった。
sniff は動いているアプリを本物のブラウザで開き、ユーザーと同じようにたどります。
報告するページのバグには、それぞれ再現手順が付きます。

### 使う理由

- **探さずに直せる。** ページの検出結果ごとにルート、手順、修正案が付き、多くはスクリーンショット付きです。
- **本物のバグを見つける根拠。** わざと埋め込んだバグで検証済み。21 件中 21 件を検出し、クリーンなページでの誤検出は 0 件です (`npm run build && npm run proof`)。
- **悪いマージを止める。** `--fail-on` は critical か high の検出で終了コード 1 を返し、`npx sniff-qa ci` が GitHub Actions のファイルを書き出します。API キーは不要です。

アプリが動いている必要があり、本物のフォームを送信するので、開発用かステージングのアプリを使ってください。
初回の巡回では、ブラウザエンジンと Chromium を 1 回だけダウンロードします。
Mac で測ると、ダウンロードは約 440 MB、ディスク上では約 730 MB です。

クローンからサンプルを再現するには、フィクスチャを起動し、別のターミナルから巡回します。

```bash
node sniff-tests/planted-bugs/server.mjs 4517
npx sniff-qa --url http://localhost:4517
```

<img alt="sniff walking a buggy app and streaming findings with severity, confidence, steps to reproduce, and a fix" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/demo.gif" width="100%">

## インストール

Node.js 22 以降が必要です。どれか 1 つの方法を選んでください。

**コマンドラインのみ、エディタなし。** アプリを起動し、別のターミナルから巡回します。

```bash
npx sniff-qa --url http://localhost:3000
```

npm パッケージ名は `sniff-qa` です。`npx sniff` は実行しないでください。無関係のパッケージです。

**Claude Code プラグイン**。[10x マーケットプレイス](https://github.com/Aboudjem/10x) から入れます。

```bash
claude plugin marketplace add Aboudjem/10x
claude plugin install sniff@10x
```

**任意のエージェント向けのスキル**。Vercel の skills CLI で入れます。

```bash
npx skills add Aboudjem/sniff
```

**MCP サーバー**。任意の MCP クライアントで使えます。

```bash
claude mcp add sniff-qa -- npx -y sniff-qa --mcp
```

初回の巡回では 2 つのものを 1 回だけダウンロードします。ブラウザエンジン (Playwright、axe-core、
Lighthouse) と Chromium です。前もって済ませるには、次を実行します。

```bash
npx sniff-qa install
```

最後にかかった時間を表示します。キャッシュが空の Mac では 43 秒でした (2026-11-17、sniff 0.9.3)。
ダウンロードは約 440 MB で、ディスクにはエンジン 193 MB と Chromium 530 MB が残りました。
サイズはプラットフォームによって変わります。macOS で測り直すには次を実行します。

```bash
du -sm ~/.cache/sniff-qa/engine/* ~/Library/Caches/ms-playwright
```

`npx sniff-qa doctor` は Node、ブラウザ、開発サーバーを確認します。

MCP サーバーはこれらのダウンロードより前に起動します。npm キャッシュが空の状態で、`npx -y sniff-qa@0.9.1 --mcp`
は最初のハンドシェイクに 3.1 から 4.9 秒で応答しました (5 回、2026-11-17)。バージョン 0.9.0 は 37 から 93 秒かかり、
Claude Code の 30 秒の接続制限を超えていました。測り直すには、このリポジトリのクローンで次を実行します。

```bash
npm run cold-start -- 0.9.1 5
```

巡回中は進捗行を表示し、最後にレポートを出します。結果は 4 通りの形で受け取れます。

| 出力                 | フラグ      | 用途                                  |
| :------------------- | :---------- | :------------------------------------ |
| ターミナルのレポート | (既定)      | 今すぐ結果を読む                      |
| HTML ページ          | `--report`  | 誰かに送る。単体で完結した 1 ファイル |
| JSON                 | `--json`    | スクリプトや他のツール                |
| 終了コード           | `--fail-on` | 本物のバグで CI を失敗させる          |

| 終了コード | 意味                                                                             |
| :--------- | :------------------------------------------------------------------------------- |
| `0`        | `--fail-on` の重大度 (既定: critical と high) に達した検出結果がない             |
| `1`        | 検出結果がそれに達した、`assert` の予算を超えた、または sniff が実行できなかった |

<details>
<summary>プロジェクトへのインストールと CI</summary>

`npm install -D sniff-qa` でプロジェクトに追加できます。`npx sniff-qa ci` は、ブラウザのキャッシュと
レポートの成果物を備えた GitHub Actions のワークフローを書き出します。アプリが動いていないと、最初の実行はソースを読むだけです。
アプリを巡回するには、`Start the app` ステップのコメントを外し、`--url` を追加してください。
</details>

## 仕組み

<img alt="How sniff works: crawl, act, assert, prove, report" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/how-it-works.svg" width="100%">

1. **アプリを見つける。** `--url` を使うか、よく使われるポートの開発サーバーを使います。
2. **たどる。** ヘッドレスの Chromium がユーザーのようにリンクをたどり、ボタンを押し、フォームに入力します。
3. **起きたことを判定する。** 各ページを 12 種類のバグについて確認します。
4. **証明する。** 検出結果にはルートと手順が必須です。あればスクリーンショットとコンソールやネットワークの行も付けます。
5. **報告する。** まず判定、次に最初に直すべき一覧、そして詳細です。

12 種類:

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg">
  <img alt="The 12 classes of bugs sniff finds" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg" width="100%">
</picture>

アプリが動いていないときは、`sniff` は代わりにソースコードを読みます (`sniff scan`)。デバッグ用の文、
仮のテキスト、壊れた import を指摘し、本来の巡回を始める方法を案内します。

MCP サーバーは次のツールを公開します。

| ツール           | 内容                                             |
| :--------------- | :----------------------------------------------- |
| `sniff`          | 単一の入口: `mode: "walk"`、`"scan"`、`"report"` |
| `sniff_scan`     | ソースのみのスキャン。ブラウザなし               |
| `sniff_run`      | ソーススキャンとブラウザでの確認                 |
| `sniff_discover` | ソースからシナリオを生成して実行                 |
| `sniff_install`  | エンジンと Chromium をダウンロード (進捗付き)    |
| `sniff_report`   | 最後に保存した結果を読む                         |

`--caps scan,report` はサーバーを `sniff_scan`、`sniff_report`、統合ツール `sniff` に絞り、ブラウザを一切使いません。

## 対応エージェント

各行は 2026-11-17 に sniff 0.9.0 のビルドで試験しました。

| エージェント            | 実行した内容                                                                             | 試験日     |
| :---------------------- | :--------------------------------------------------------------------------------------- | :--------- |
| Claude Code             | sniff を MCP サーバーにした `claude -p` が `sniff_scan` を呼び、2 件の検出結果を読んだ   | 2026-11-17 |
| Codex CLI               | sniff を MCP サーバーにした `codex exec` が `sniff_scan` を呼び、2 件の検出結果を読んだ  | 2026-11-17 |
| Gemini CLI              | `gemini extensions validate .` が `gemini-extension.json` を受け入れた                   | 2026-11-17 |
| 任意の MCP クライアント | `node sniff-tests/mcp-smoke.mjs` が 6 個のツールを列挙し、巡回が 20 件の検出結果を返した | 2026-11-17 |
| skills CLI              | `npx skills@1.9.0 add Aboudjem/sniff` が 3 つのスキルを一時フォルダに入れた              | 2026-11-17 |

ドキュメントのみで今日は未試験: Cursor、Copilot 付きの VS Code、Windsurf、OpenCode、Zed。
設定例は [docs/editors.md](../docs/editors.md) にあります。

## 根拠

3 つのコマンドで、このページの数値を再表示できます。1 つ目はフィクスチャのスコアを表示します。

```bash
npm run build && npm run proof
```

バグ埋め込みフィクスチャを起動して巡回し、レポートを採点します。2026-11-17 の出力:

```text
  Recall:    21/21  (100%)
  Findings:  27 deduped (27 raw)
  Matched:   27   Candidate FP: 0   Precision proxy: 100%
  Hard FP on clean page (/clean): 0
```

上のサンプルは 26 件を示し、低確信度の 1 件が非表示だと伝えます。根拠の実行は `--all` を使うので、27 件すべてを数えます。

フィクスチャには 12 種類すべてにわたる 21 個の埋め込みバグと、クリーンな対照ページがあります。
採点スクリプトは [sniff-tests/score-fixture.mjs](../sniff-tests/score-fixture.mjs) です。
バグの一覧は [sniff-tests/planted-bugs/MANIFEST.json](../sniff-tests/planted-bugs/MANIFEST.json) にあります。

```bash
npm test
```

2026-11-17 には `Test Files  54 passed (54)` と `Tests  603 passed (603)` を表示しました。
このスイートにはフィクスチャのゲートが含まれます。再現率が 85% を下回るとビルドを失敗させます。
クリーンなページで検出結果が 1 件でも出ても失敗します。

```bash
node sniff-tests/mcp-smoke.mjs
```

6 個の MCP ツールと、上の表で触れた 20 件の検出結果を表示します。

## FAQ

**API キーやアカウントは必要ですか？**
いいえ。巡回とソーススキャンは手元のマシンで動きます。任意の AI 探索を自分で設定しない限り、どこにも何も送りません。

**巡回でアプリのデータが変わりますか？**
変わる可能性があります。巡回はボタンを押して本物のフォームを送信するので、開発用かステージングのアプリに向けてください。

**何もクラッシュしていないのに、なぜ終了コード 1 なのですか？**
終了コード 1 は、失敗扱いの重大度のバグが見つかったという意味です。そのため CI はビルドを失敗させます。常に 0 で終えるには `--fail-on none` を渡します。

**コードを書き換えますか？**
いいえ。巡回とスキャンはソースに一切触れません。ファイルを書き換えるのは `sniff fix` だけで、それも実行したときだけです。

**ログインが必要なアプリも巡回できますか？**
はい。`--storage-state auth.json` を渡してください。そのファイルの Cookie とトークンの値は、書き出すレポートでは伏せられます。

ほかの回答は [docs/faq.md](../docs/faq.md) にあります。

## 制限

- 巡回には動いているアプリが必要です。ない場合はソーススキャンのみになります。
- 初回の巡回では、エンジンと Chromium を 1 回ダウンロードするためにインターネットが必要です。Mac で約 440 MB、ディスク上では約 730 MB です。
- それまでは MCP のブラウザツールが `needsSetup` を返し、エージェントが先に `sniff_install` を呼びます。
- リンク切れの確認は外部リンクもたどるため、巡回はページがリンクしている第三者の URL にリクエストを送ります。
- 伏せ字はレポートの文字にかかり、スクリーンショットの画素にはかかりません。ログイン中のページのスクリーンショットには個人データが写ることがあります。
- 見つけるのはユーザーに見えるものです。サーバーのログは読まず、負荷も測りません。

## さらに詳しく

- [docs/editors.md](../docs/editors.md): 各エージェント向けのインストールと MCP の設定例
- [docs/authenticated-walks.md](../docs/authenticated-walks.md): ログインが必要なアプリの巡回
- [docs/assert-budgets.md](../docs/assert-budgets.md): `sniff.config` で重大度ごとに検出数の上限を決める
- [docs/comparison.md](../docs/comparison.md): sniff とリンターや E2E フレームワークとの違い
- [CHANGELOG.md](../CHANGELOG.md) · [CONTRIBUTING.md](../CONTRIBUTING.md) · [LICENSE](../LICENSE)

---

<p align="center"><sub>Built by <a href="https://github.com/Aboudjem">Adam Boudjemaa</a> · <a href="../LICENSE">Apache 2.0</a> · built on <a href="https://playwright.dev">Playwright</a> and <a href="https://github.com/dequelabs/axe-core">axe-core</a></sub></p>

<p align="center"><sub>この文書は機械翻訳を利用して作成されています。正典は英語版の <a href="../README.md">README.md</a> です。</sub></p>
