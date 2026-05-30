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
  <a href="zh-CN.md">简体中文</a> ·
  <b>日本語</b> ·
  <a href="es.md">Español</a> ·
  <a href="fr.md">Français</a>
</p>

<p align="center"><b>起動中のアプリを指定するだけ。実際のブラウザで本物のユーザーフローを辿り、本当に壊れている箇所を証拠付きで教えます。</b></p>

<p align="center">
  <a href="#はじめかた">はじめかた</a> ·
  <a href="#検出できるもの">検出できるもの</a> ·
  <a href="#信頼できる理由">信頼できる理由</a> ·
  <a href="#仕組み">仕組み</a> ·
  <a href="#デモ">デモ</a> ·
  <a href="#faq">FAQ</a>
</p>

![sniff demo](.github/assets/demo.gif)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/sniff-diagram.svg">
  <img alt="Sniff のフロー: 起動中のアプリ -> ヘッドレスブラウザによる走査 -> 証拠付きの検出結果" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/sniff-diagram.svg" width="100%">
</picture>

---

## これは何ですか?

Sniff は自律型 QA スキャナーです。起動中のウェブアプリを指定すると、**実際の (ヘッドレス) ブラウザでアプリの本物のユーザーフローを辿り** (ボタンのクリック、フォームへの入力、リンクの追跡)、本当に壊れている箇所を報告します。

リンターでも静的スキャナーでも**ありません**。ページを開き、ユーザーのように操作し、何が起きるかを観察します。

報告されるバグにはすべて**証拠**が付きます。対象ページ、再現手順 (順序付き)、スクリーンショット、そして問題を捉えたコンソールまたはネットワークの抜粋です。再現の証拠がない検出結果は、検出結果とみなしません。

```bash
npx sniff-qa --url http://localhost:3000
```

コマンド一つ、設定不要、API キー不要、Playwright のセットアップも不要です。起動中のアプリを指定するか、プロジェクトで `npx sniff-qa` を実行するだけで、一般的なポートで動作している開発サーバーを自動検出します。

> Sniff は**起動中のアプリ**を走査します。開発サーバーが起動していない場合はソースコードのスキャンにフォールバックし、本物のフロー走査を開始するための具体的な手順を表示します。詳しくは[はじめかた](#はじめかた)をご覧ください。

---

## はじめかた

**Node.js 22 以上**と、ローカルで起動できるウェブアプリ (または URL) が必要です。

> **パッケージ名について:** npm パッケージ名は **`sniff-qa`** です。`npx sniff-qa` または `npm install -D sniff-qa` を使用してください。インストール後のバイナリ名は **`sniff`** です (`sniff-qa` バイナリも動作します)。`npx sniff` は別のパッケージを指すため、実行しないでください。

### 1. アプリを起動する

```bash
npm run dev        # または通常の起動コマンド
```

### 2. 走査する

別のターミナルで:

```bash
npx sniff-qa --url http://localhost:3000     # 起動中のアプリを指定
```

これが確実に動作するワンライナーです。Sniff は一般的なポートで動作している開発サーバーを**自動検出**するため、プロジェクトフォルダで `npx sniff-qa` をフラグなしで実行するだけで済むことも多いです。非標準ポートを使っている場合や自動検出が失敗する場合は `--url` を指定してください (常に機能します)。デプロイ済みの URL も走査できます:

```bash
npx sniff-qa --url https://staging.myapp.com
```

> **バグが見つかった場合は意図的にゼロ以外の終了コードで終わります。** 問題が見つかったウォークは終了コード `1` で終了し、CI でビルドを失敗させます。クラッシュではありません (`✓ Scan complete` という行が表示されます)。常に `0` で終了させたい場合は `--fail-on none` を指定してください。

> **初回実行時にブラウザをダウンロードします。** Sniff が初めてブラウザを開く際に Chromium ビルドをダウンロードします (約 165 MB、一度だけ)。進捗が表示され、初回実行時はインターネット接続が必要です。以降はキャッシュされます。

### 3. レポートを読む

検出結果は重大度別にグループ化されてターミナルに出力され、それぞれに再現手順が付きます。共有可能なページが必要な場合:

```bash
npx sniff-qa --url http://localhost:3000 --report   # 走査後に sniff-reports/sniff-report.html (自己完結型) を生成
```

**アプリが起動していない場合:** Sniff はサイレントに失敗しません。ソースのみのスキャンを実行し、次のステップ (開発サーバーの起動または `--url` の指定) を明確に表示します。ソーススキャンを明示的に実行することもできます:

```bash
npx sniff-qa scan         # ソースのみのスキャン、ブラウザなし
```

困ったときは `npx sniff-qa doctor` で環境 (Node、ブラウザ、開発サーバー) を確認できます。

---

## 検出できるもの

Sniff はアプリを走査し、**12 クラスの実際のバグ**を探します:

| # | クラス | 例 |
|:--|:------|:---------|
| 1 | **ページ/ルートの破損** | 4xx/5xx レスポンス、空白レンダリング、クラッシュ画面 |
| 2 | **リンク切れ** | 内部・外部の無効なリンク |
| 3 | **コンソール・ネットワークエラー** | *操作中*に発生する未捕捉の例外と失敗したリクエスト |
| 4 | **空データ・ダミーデータ** | データ欠落、および `lorem ipsum`・`TODO`・`test@test.com` などのプレースホルダー |
| 5 | **フォームの破損** | 機能しない送信ボタン、発火しないバリデーション |
| 6 | **状態の消失** | フォームに入力して戻るボタンを押すと内容が消える |
| 7 | **フロー回帰・行き詰まり** | 完了できないユーザージャーニー |
| 8 | **読み込み・エラー状態の不備** | 無限スピナー、エラー状態の欠落 |
| 9 | **非同期処理の結果の破損** | 送信しても成功フィードバックがない (「帯域外検証が必要」としてフラグ) |
| 10 | **レスポンシブの問題** | オーバーフローと小さすぎるタップターゲット (375px モバイルパス) |
| 11 | **アクセシビリティ** | alt テキストとラベルの欠落、コントラスト ([axe-core](https://github.com/dequelabs/axe-core) による) |
| 12 | **主要アクションの不明確さ** | メインの行動喚起が埋もれているか曖昧 |

各検出結果には以下が付きます:

- **再現の証拠**: 正確なルート、順序付きの手順、スクリーンショット、コンソール/ネットワークの抜粋。
- **重大度**: 優先して修正すべき箇所がわかります。
- **信頼度**: `confirmed` (確認済み)、`likely` (可能性あり)、`uncertain` (不確か)。不確かな検出結果はデフォルトで非表示です。`--all` を指定すると表示されます。
- **修正の提案。**

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg">
  <img alt="Sniff が検出するバグのクラス" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg" width="100%">
</picture>

---

## 信頼できる理由

ほとんどのスキャナーは誤検知の嵐で、読むのをやめてしまいます。Sniff はまったく逆の発想で設計されています。

12 クラスすべてにわたって**21 個のバグ**を仕込んだフィクスチャアプリと、検出結果がゼロであるべきクリーンなコントロールページで測定しました:

| | 旧エンジン | 新エンジン |
|:--|:--|:--|
| 検出バグ数 | 9 / 21 (43%) | **21 / 21 (100%)** |
| 適合率 | 約 13% | **100%** |
| 誤検知 | 125 | **0** |
| クリーンページでの検出結果 | 未計測 | **0** |
| 主要コマンド | クラッシュ | 動作する |

これらの数値は回帰テストとして固定されています。全テストスイートは **441 テスト**です。

**誤検知をほぼゼロに保つ仕組み:**

- 独自の**ノイズフィルター**が、あなたのバグではないゴミを除去します。ファビコン、アナリティクス、ホットモジュールリロードのログ、想定される認証リダイレクト、エンジンの中断などが対象です。
- アクセシビリティの検出結果は**axe-core** によって裏付けられており、設計上誤検知ゼロです。
- **不確かな検出結果はデフォルトで非表示**です (`--all` で表示できます)。
- ページの破損は、そのページを指すすべてのリンクで再フラグされるのではなく、**一度だけ**報告されます。

Sniff はバグを証明できない場合、検出を主張しません。

---

## 他のツールとの違い

リンターはソースを読むだけでアプリを実行しません。E2E フレームワークはテストを*あなた*が書く必要があります。リンクチェッカーはリンクしか確認しません。Sniff は実際のアプリを操作し、その結果を判定します。

| | **Sniff** | linkinator | pa11y | Playwright codegen | QA-Wolf スタイルのサービス |
|:--|:--|:--|:--|:--|:--|
| ブラウザで実際のユーザーフローを走査 | **はい** | いいえ | いいえ | スクリプトを書く | はい |
| セットアップ不要、テスト記述不要 | **はい** | はい | はい | いいえ (テストを書く) | いいえ (オンボーディング) |
| リンク切れ | **はい** | はい | いいえ | 手動 | 手動 |
| アクセシビリティ (axe-core) | **はい** | いいえ | **はい** | 手動 | 一部 |
| 空データ / プレースホルダー / ダミーデータ | **はい** | いいえ | いいえ | いいえ | いいえ |
| 状態消失 (戻るボタンでフォームが消える) | **はい** | いいえ | いいえ | 手動 | 手動 |
| 検出結果ごとの一発再現証拠 | **はい** | いいえ | 一部 | いいえ | 様々 |
| 自己完結型 HTML レポート | **はい** | いいえ | 一部 | いいえ | ダッシュボード |
| ローカル実行、アカウント不要、API キー不要 | **はい** | はい | はい | はい | いいえ (サービス) |

Sniff がコマンド一つで独自に実現すること: **空データ/プレースホルダーデータ**、**状態消失**、**非同期処理の結果の破損**を検出し、一つの証拠レポートを提供します。スクリプトを書く必要も、サービスに登録する必要もありません。

---

## コマンド

```
sniff                  アプリを走査する (開発サーバーを自動検出)。デフォルト。
sniff --url <url>      指定した URL を走査する
sniff scan             ソースのみのスキャン、ブラウザなし (プレースホルダー、TODO、リンク切れなど)
sniff report           前回の実行結果を表示する
sniff doctor           環境を確認する (Node、ブラウザ、設定、開発サーバー)
sniff ci               GitHub Actions ワークフローを生成する
sniff fix              安全な問題を自動修正する (console.log、debugger など)
sniff --help           すべてのコマンドとフラグを表示する
sniff --version        バージョンを表示する
```

### 便利なフラグ

| フラグ | 動作 |
|:-----|:-------------|
| `--url <url>` | 自動検出の代わりにこの URL を走査する |
| `--report` | 自己完結型の HTML レポートを `sniff-reports/sniff-report.html` に書き出す |
| `--all` | 低信頼度 (`uncertain`) の検出結果も表示する |
| `--max-pages <n>` | 走査するページ数の上限を設定する (デフォルト: 25) |
| `--no-mobile` | 375px レスポンシブパスをスキップする |
| `--headed` | 走査中にブラウザウィンドウを表示する |
| `--json` | 機械可読な JSON 形式で出力する |
| `--ci` | CI モード (安定した出力、非インタラクティブ) |
| `--fail-on <sev>` | 指定した重大度以上の検出結果があればゼロ以外で終了する |

---

## デモ

バグだらけのアプリに対する実際の実行: 21 件の本物の問題、誤検知ゼロ、各検出結果に重大度、信頼度、再現手順、修正案が付きます。Sniff がアプリを走査して検出結果をストリーミングする様子をご覧ください (アニメーションデモはこの README の先頭で再生されます、[`.github/assets/demo.gif`](.github/assets/demo.gif))。

以下は同じ実行結果をスタイライズしたターミナルの静止画です:

<img alt="Sniff がバグだらけのアプリを走査し、誤検知ゼロで 21 件の本物の問題を報告する様子" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/demo.svg" width="100%">

---

## AI エディターから使う

Sniff は MCP サーバーとしても機能します。一度追加すれば、アシスタントに「このプロジェクトのバグをスキャンして」や「アプリを走査して」と頼むだけです。アプリが起動していれば Sniff が自動検出するので、URL を指定する必要はありません。

**統一された `sniff` ツール一つ、3 つのモード:**

- `walk`: **推奨。** 起動中のアプリの実際のフローを走査します (上記のフロー走査)。
- `scan`: ソースのみのスキャン、ブラウザなし。
- `report`: 前回の実行結果を表示。

(`run` と `discover` は後方互換性のために残されているレガシーモードです。)

### スラッシュコマンドと MCP ツール

Claude Code プラグインとして、Sniff は 3 つのスラッシュコマンドを追加します:

| スラッシュコマンド | 動作 |
|:--------------|:-------------|
| `/sniff` | 起動中のアプリを走査し、実際のバグを検出します (フロー走査)。 |
| `/sniff-fix` | スキャンして安全な問題を自動修正します (不要な `console.log`、`debugger` など)。 |
| `/sniff-report` | 前回の実行結果を表示します。 |

MCP サーバーとしては、`{ mode, rootDir, baseUrl? }` を受け取る**統一された `sniff` ツール**が公開されています。上記の 3 つのモード (`walk` / `scan` / `report`) が操作方法であり、新しい実装ではこの統一ツールを使用してください。個別の専用ツール (`sniff_scan`、`sniff_run`、`sniff_report`、`sniff_discover`、`sniff_install`) は後方互換性とスコープ限定の用途のために登録されたままですが、新しい作業では統一 `sniff` ツールを使用してください。

### スキルを任意の AI CLI にインストールする

上記の MCP サーバーはすべての MCP 対応クライアントで動作します。`/sniff` スキルを別の CLI に直接読み込むには、ワンラインのインストーラーを実行してください。3 つのスキルをその CLI のスキルディレクトリにシンボリックリンクします。`--update` で最新版を取得して再リンク、`--uninstall` で削除できます。

```bash
curl -fsSL https://raw.githubusercontent.com/Aboudjem/sniff/main/install.sh | bash -s codex
```

Windows の場合は、チェックアウトから `install.ps1 <platform>` を実行してください (シンボリックリンクには開発者モードまたは管理者シェルが必要です)。

| プラットフォーム | スキルディレクトリ | ワンライナー |
|:--|:--|:--|
| Claude Code | (プラグイン) | `claude plugin install sniff@10x` |
| Codex / Gemini / OpenCode / Pi | `~/.agents/skills` | `install.sh codex` |
| VS Code (Copilot) | `~/.copilot/skills` | `install.sh copilot` |
| Trae | `~/.trae/skills` | `install.sh trae` |
| Vibe | `~/.vibe/skills` | `install.sh vibe` |
| OpenClaw | `~/.openclaw/skills` | `install.sh openclaw` |
| Antigravity | `~/.gemini/antigravity/skills` | `install.sh antigravity` |
| Hermes / Cline / Kimi | `~/.<cli>/skills` | `install.sh hermes` |

スキルディレクトリの規約は CLI のリリースによって変わることがあります。リンクが解決しない場合は MCP サーバーにフォールバックしてください (どこでも動作します)。`install.sh all` を実行するとすべてのプラットフォームに一度にリンクできます。

<details>
<summary><b>Claude Code</b></summary>

[10x マーケットプレイス](https://github.com/Aboudjem/10x)からワンコマンドでプラグインをインストール:

```bash
claude plugin marketplace add Aboudjem/10x
claude plugin install sniff@10x
```

または MCP サーバーだけを追加する場合:

```bash
claude mcp add sniff-qa npx -- -y sniff-qa --mcp
```
</details>

<details>
<summary><b>Cursor</b></summary>

`~/.cursor/mcp.json` に追加:

```json
{ "mcpServers": { "sniff-qa": { "command": "npx", "args": ["-y", "sniff-qa", "--mcp"] } } }
```
</details>

<details>
<summary><b>VS Code (Copilot)</b></summary>

`.vscode/mcp.json` に追加:

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

`~/.gemini/mcp_config.json` に追加:

```json
{ "mcpServers": { "sniff-qa": { "command": "npx", "args": ["-y", "sniff-qa", "--mcp"] } } }
```
</details>

<details>
<summary><b>Windsurf</b></summary>

`~/.codeium/windsurf/mcp_config.json` に追加:

```json
{ "mcpServers": { "sniff-qa": { "command": "npx", "args": ["-y", "sniff-qa", "--mcp"] } } }
```
</details>

<details>
<summary><b>Continue.dev</b></summary>

`.continue/mcpServers/sniff-qa.yaml` に追加:

```yaml
mcpServers:
  sniff-qa: { command: npx, args: ["-y", "sniff-qa", "--mcp"], type: stdio }
```
</details>

> ブラウザを使った最初の走査では Chromium をダウンロードします (約 165 MB)。MCP 経由の場合、Sniff はエディターを長いダウンロードでブロックする代わりに、構造化された `needsSetup` ペイロードを返します。表示されたインストールコマンドを実行してから再度お試しください。

---

## 仕組み

1. **アプリを見つける。** Sniff は起動中の開発サーバーを自動検出します (または `--url` で指定します)。
2. **フローを走査する。** ヘッドレスブラウザでページを開き、ユーザーのように操作します (クリック、フォーム入力、リンクの追跡)。デスクトップと 375px モバイルパスの両方で実行します。
3. **すべてを監視する。** コンソールエラー、失敗したネットワークリクエスト、レンダリングの破損、フィードバックの欠落、アクセシビリティの問題をリアルタイムで記録します。
4. **ノイズをフィルタリングする。** 独自のノイズフィルターと axe-core が誤検知を除去し、不確かな検出結果は保留します。
5. **証拠付きで報告する。** 残った各検出結果に重大度、信頼度、再現手順、スクリーンショット、修正の提案を付けて、ターミナルとオプションの HTML レポートに出力します。

<img alt="sniff の仕組み: クロール、操作、アサート、証明、レポート" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/how-it-works.svg" width="100%">

---

## CI 統合

パイプラインで Sniff を実行し、実際のバグでビルドを失敗させます:

```bash
npx sniff-qa --ci --fail-on high
```

すぐにコミットできる GitHub Actions ワークフローを生成します:

```bash
npx sniff-qa ci
```

これにより、ブラウザキャッシュとレポートアーティファクトを含む `.github/workflows/sniff.yml` が書き出されます。

---

## FAQ

**開発サーバーなしで動きますか?**
Sniff は*起動中の*アプリを走査するよう設計されており、そこで真価を発揮します。サーバーが起動していない場合はサイレントに失敗しません。ソースのみのスキャンを実行し、本物の走査を開始するための手順 (開発サーバーの起動または `--url` の指定) を明確に表示します。`npx sniff-qa scan` でソーススキャンを明示的に実行することもできます。

**初回実行時に何がダウンロードされますか?**
Sniff が初めてブラウザを開く際に Chromium ビルドをダウンロードします (約 165 MB、一度だけ、その後はキャッシュ)。進捗が表示され、初回実行時はインターネット接続が必要です。他には何もインストールされず、アカウントも作成されません。

**API キーは必要ですか?**
いいえ。Sniff は API キーもサインアップも不要で、完全にあなたのマシン上で動作します。コードもアプリもあなたのコンピューターの外に出ることはありません。

**リンターとの違いは何ですか?**
リンターはソースファイルを読むだけでアプリを実行しないため、機能しない送信ボタン、無限スピナー、消えたフォーム、500 ページを検出できません。Sniff は実際のアプリを開いて操作し、実際に壊れているものをスクリーンショットと再現手順付きで報告します。

**Playwright codegen (または E2E テストの記述) との違いは何ですか?**
Playwright codegen は*あなた*が作成・保守するスクリプトを記録します。クリックしたパスしかテストできません。Sniff はあなたが保守するものを何も書きません。独自にフローを探索して結果を判定し、記録されたハッピーパスでは決して確認できないこと (空データ/プレースホルダー、状態消失、成功フィードバックの欠落) を検出します。

**コードは変更されますか?**
走査中はいいえ。走査とスキャンは読み取り専用です。別途用意された `sniff fix` コマンドが安全な自動修正 (不要な `console.log`/`debugger` など) を適用しますが、それはあなたが実行した場合のみです。

**どのスタックで動作しますか?**
ブラウザで開けるあらゆるウェブアプリで動作します: React、Next.js、Vue、Svelte、Angular、Remix、SvelteKit、Astro、プレーン HTML など。レンダリングされたアプリを走査するため、ブラウザチェックではフレームワークは問いません。

---

## 対応エディター・ツール

Claude Code · Cursor · VS Code (Copilot) · Codex · Gemini CLI · Windsurf · Continue.dev。MCP サーバー (コマンド `npx`、引数 `["-y", "sniff-qa", "--mcp"]`) または CLI を直接使用して接続できます。

---

## Star の推移

<a href="https://star-history.com/#Aboudjem/sniff&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Aboudjem/sniff&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Aboudjem/sniff&type=Date" />
    <img alt="Aboudjem/sniff の Star 推移チャート" src="https://api.star-history.com/svg?repos=Aboudjem/sniff&type=Date" width="70%" />
  </picture>
</a>

---

## コントリビュート

Issue と PR を歓迎します。[CONTRIBUTING.md](CONTRIBUTING.md) をご覧ください。

---

<p align="center">
  <sub>
    Built on <a href="https://playwright.dev">Playwright</a> · <a href="https://github.com/dequelabs/axe-core">axe-core</a> · <a href="https://developer.chrome.com/docs/lighthouse">Lighthouse</a> · <a href="https://github.com/mapbox/pixelmatch">pixelmatch</a> · <a href="https://zod.dev">Zod</a> · <a href="https://github.com/modelcontextprotocol/typescript-sdk">MCP SDK</a>
  </sub>
</p>

<p align="center">
  <a href="https://www.linkedin.com/in/adam-boudjemaa/"><img src="https://img.shields.io/badge/LinkedIn-0A66C2?style=flat-square&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
  <a href="https://x.com/AdamBoudj"><img src="https://img.shields.io/badge/X-000000?style=flat-square&logo=x&logoColor=white" alt="X"></a>
  <a href="https://adam-boudjemaa.com/"><img src="https://img.shields.io/badge/Website-ef4444?style=flat-square&logo=googlechrome&logoColor=white" alt="Website"></a>
</p>

<p align="center">
  <sub>Built by <a href="https://github.com/Aboudjem">Adam Boudjemaa</a> · <a href="LICENSE">Apache 2.0</a></sub>
</p>

*この翻訳は機械支援により作成されました。誤りや不自然な表現を見つけた場合は、PR でご指摘いただけると幸いです。英語の README ([../README.md](../README.md)) が正式な情報源です。*
