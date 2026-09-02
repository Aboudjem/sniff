<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/hero-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/hero-light.svg">
  <img alt="sniff" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/hero-light.svg" width="100%">
</picture>

<p align="center">
  <a href="https://www.npmjs.com/package/sniff-qa"><img src="https://img.shields.io/npm/v/sniff-qa?style=flat-square&color=FF006E&logo=npm&label=npm" alt="npm version"></a>
  <a href="https://github.com/Aboudjem/sniff/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Aboudjem/sniff/ci.yml?style=flat-square&color=00D4FF&label=CI" alt="CI"></a>
  <a href="../LICENSE"><img src="https://img.shields.io/badge/license-Apache_2.0-7C3AED?style=flat-square" alt="License Apache 2.0"></a>
  <a href="https://github.com/Aboudjem/sniff/stargazers"><img src="https://img.shields.io/github/stars/Aboudjem/sniff?style=flat-square&color=2BE8C8" alt="Stars"></a>
</p>

<p align="center"><a href="../README.md">English</a> · <a href="zh-CN.md">简体中文</a> · <b>日本語</b> · <a href="es.md">Español</a> · <a href="fr.md">Français</a></p>

<p align="center"><b>起動中のアプリに向けるだけ。実際のブラウザで本物のユーザーフローを歩き、どこが本当に壊れているかを証拠つきで教えます。</b></p>

<p align="center"><a href="#何をするツールか">何をするツールか</a> · <a href="#インストール">インストール</a> · <a href="#使い方">使い方</a> · <a href="#得られるもの">得られるもの</a> · <a href="#エディタで使う">エディタで使う</a> · <a href="#知っておくこと">知っておくこと</a></p>

<img alt="sniff walking a buggy app and streaming findings with severity, confidence, steps to reproduce, and a fix" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/demo.gif" width="100%">

```bash
claude plugin marketplace add Aboudjem/10x
claude plugin install sniff@10x
```

## 何をするツールか

リンターはソースを読むだけで、アプリを動かすことはありません。E2E フレームワークはテストを自分で書いて
維持することを求めます。sniff は起動中のアプリを実際のブラウザで開き、ユーザーと同じようにクリックや
入力を行い、その結果を判定します。

- **12 種類の不具合を見つけます。** HTTP 500 のルートや切れたリンクから、プレースホルダのデータ、
  反応しない送信ボタン、ブラウザの戻るで消えるフォーム、止まらないスピナー、モバイル幅での横方向の
  はみ出しまで。
- **すべてに証拠がつきます。** 検出結果には、対象のルート、再現手順、スクリーンショット、そしてそれを
  捉えたコンソールまたはネットワークの抜粋が付きます。証拠がなければ検出結果にしません。
- **実測しています。** 12 種類すべてにまたがる 21 個の不具合を仕込み、さらにクリーンな対照ページを
  用意したフィクスチャアプリで、sniff は 21 個中 21 個を検出し、対照ページでは何も報告しませんでした。

## インストール

上のコマンドは [10x マーケットプレイス](https://github.com/Aboudjem/10x) を通じた Claude Code 向けの
経路です。それ以外のエージェントには、Vercel の skills CLI が同じ 3 つのスキルをインストールします。

```bash
npx skills add Aboudjem/sniff
```

エディタを介さず、素のコマンドラインツールとして使う場合は次のとおりです。

```bash
npx sniff-qa --url http://localhost:3000
```

npm パッケージ名は `sniff-qa` で、インストールされる実行ファイル名は `sniff` です。`npx sniff` は
無関係な別のパッケージなので実行しないでください。

<details>
<summary>Node のバージョン、プロジェクトへの導入、CI</summary>

Node.js 22 以上が必要です。`npm install -D sniff-qa` でプロジェクトに固定でき、`npx sniff-qa ci` は
ブラウザキャッシュとレポート成果物を含む GitHub Actions ワークフローを生成します。
</details>

## 使い方

**1. アプリを起動します。** どの開発サーバーでも、どのフレームワークでも構いません。

```bash
npm run dev
```

**2. 歩かせます。** 2 つ目のターミナルから実行します。sniff は一般的なポートの開発サーバーを自動検出
するため `--url` は任意ですが、明示的に渡せば常に確実です。

```bash
npx sniff-qa --url http://localhost:3000
```

**3. 検出結果を読みます。** 深刻度ごとにまとめて出力されます。以下は、このリポジトリに同梱された
不具合入りフィクスチャに対する実際の実行の抜粋で、コマンドは
`npx sniff-qa --url http://localhost:4321 --ci --max-pages 12` です。

```text
sniff v0.8.0  walking http://localhost:4321

  26 findings (+1 low-confidence hidden; use --all)

  CRITICAL (1)
    • [confirmed] Page returns HTTP 500
      /crash  (route/broken-page)
        - Navigate to /crash
        - Server responded with HTTP 500
      fix: The route throws server-side. Check the server logs/handler for this path and return a valid page or a proper error page.
      shot: sniff-reports/crawl/_crash-desktop.png

✓ Scan complete: 26 issue(s) found. Exit code 1 so CI fails on bugs; pass --fail-on none to always exit 0.
```

`--report` を付けると、そのまま人に渡せる自己完結型の HTML ページが得られます。環境がおかしいと感じたら
`npx sniff-qa doctor` を実行してください。

<img alt="How sniff works: crawl, act, assert, prove, report" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/how-it-works.svg" width="100%">

## 得られるもの

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg">
  <img alt="The 12 classes of bugs sniff finds" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg" width="100%">
</picture>

- **ターミナルのレポート。** 深刻度ごとにまとまり、各検出結果に手順、スクリーンショットのパス、修正案が
  付きます。
- **共有できるファイル。** `--report` で自己完結型の HTML レポート、`--json` で JSON が得られます。
- **終了コード。** 検出結果が `--fail-on` の深刻度に達すると 0 以外を返すので、CI は本物の不具合で
  失敗します。
- **各検出結果の確度ラベル。** `uncertain` のものは `--all` を渡さない限り隠れたままです。

0.8.0 での追加:

- `--caps scan,report` は MCP サーバーをソーススキャンと保存済み結果の読み取りだけに絞り込みます。
  ブラウザの起動もダウンロードも行いません。
- `--storage-state auth.json` はログイン済みのアプリを歩き、そのファイル内の cookie とトークンの値は
  書き出されるすべてのレポートから伏せられます。
- `sniff.config` の `assert` ブロックは検出結果の数を深刻度ごとに制限します（`maxCritical`、
  `maxHigh`、`maxTotal`）。ウォーク、ソーススキャン、ディスカバリのいずれでも適用されます。

## エディタで使う

Claude Code、Cursor、Codex、Copilot、Gemini CLI、そして `npx skills add` を通じて 70 以上の
エージェントで動作します。スキルは Markdown なので、エディタが指すどのモデルの上でも動きます。

| エージェント | 1 行のインストールコマンド |
|:--|:--|
| Claude Code | `claude plugin install sniff@10x` |
| 70 以上のエージェントのいずれか | `npx skills add Aboudjem/sniff` |
| Codex、Gemini CLI、OpenCode、Pi | `install.sh codex` |
| VS Code (Copilot) | `install.sh copilot` |
| それ以外すべて | [docs/editors.md](../docs/editors.md) を参照 |

<details>
<summary>代わりに MCP サーバーとして追加する</summary>

```bash
claude mcp add sniff-qa npx -- -y sniff-qa --mcp
codex mcp add sniff-qa -- npx -y sniff-qa --mcp
```

Cursor、VS Code、Gemini CLI、Windsurf、Continue、OpenCode、Zed は同じコマンドを JSON または TOML の
エントリとして受け取ります。エディタごとの記述はすべて [docs/editors.md](../docs/editors.md) にあります。
</details>

## 知っておくこと

> [!IMPORTANT]
> API キーもアカウントもサインアップも不要です。sniff はあなたのマシン上で動き、ソースが外に出ることは
> ありません。ウォークとスキャンはコードを変更しません。ソースファイルを編集するコマンドは `sniff fix`
> だけで、それもあなたが実行したときだけです。

> [!NOTE]
> 最初のブラウザウォークでは Chromium のビルドを 1 度だけダウンロードし、以後はキャッシュします。MCP
> 経由では、sniff はダウンロードでエディタを止める代わりに `needsSetup` ペイロードを返します。

- **起動中のアプリが必要です。** 開発サーバーが動いていない場合はソースのみのスキャンにフォールバック
  し、本来のウォークの始め方を案内します。`npx sniff-qa scan` はそのスキャンを意図的に実行します。
- **切れたリンクの検査は外部リンクもたどります。** そのためウォークは、あなたのページが既にリンクして
  いる第三者の URL にリクエストを送ります。
- **不具合を見つけたウォークは 1 で終了します。** これは CI にビルドを失敗させるための意図的な挙動で、
  クラッシュではありません。常に 0 で終了させるには `--fail-on none` を渡してください。

## さらに詳しく

- [docs/editors.md](../docs/editors.md)、対応する各エージェントのインストール方法と MCP 記述
- [docs/authenticated-walks.md](../docs/authenticated-walks.md)、`--storage-state` でログイン済みアプリを歩く
- [docs/assert-budgets.md](../docs/assert-budgets.md)、`sniff.config` で検出結果を深刻度ごとに制限する
- [docs/comparison.md](../docs/comparison.md)、リンター、リンクチェッカー、E2E フレームワークとの違い
- [docs/faq.md](../docs/faq.md)、このページが答えていない質問
- [CHANGELOG.md](../CHANGELOG.md) · [CONTRIBUTING.md](../CONTRIBUTING.md) · [LICENSE](../LICENSE)

---

<p align="center"><sub>Built by <a href="https://github.com/Aboudjem">Adam Boudjemaa</a> · <a href="../LICENSE">Apache 2.0</a> · standing on <a href="https://playwright.dev">Playwright</a> and <a href="https://github.com/dequelabs/axe-core">axe-core</a></sub></p>

<p align="center"><sub>この文書は機械翻訳を利用して作成されています。正典は英語版の <a href="../README.md">README.md</a> です。</sub></p>
