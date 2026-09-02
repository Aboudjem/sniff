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

<p align="center"><a href="../README.md">English</a> · <a href="zh-CN.md">简体中文</a> · <a href="ja.md">日本語</a> · <a href="es.md">Español</a> · <b>Français</b></p>

<p align="center"><b>Pointez-le vers votre application qui tourne. Il parcourt vos vrais parcours utilisateur dans un vrai navigateur et vous dit ce qui est réellement cassé, preuves à l'appui.</b></p>

<p align="center"><a href="#ce-que-ça-fait">Ce que ça fait</a> · <a href="#installation">Installation</a> · <a href="#utilisation">Utilisation</a> · <a href="#ce-que-vous-obtenez">Ce que vous obtenez</a> · <a href="#fonctionne-dans-votre-éditeur">Fonctionne dans votre éditeur</a> · <a href="#bon-à-savoir">Bon à savoir</a></p>

<img alt="sniff walking a buggy app and streaming findings with severity, confidence, steps to reproduce, and a fix" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/demo.gif" width="100%">

```bash
claude plugin marketplace add Aboudjem/10x
claude plugin install sniff@10x
```

## Ce que ça fait

La plupart des linters lisent votre code source sans jamais exécuter votre application, et les
frameworks de bout en bout vous demandent d'écrire et de maintenir les tests vous-même. sniff ouvre
votre application qui tourne dans un vrai navigateur, clique et remplit les champs comme le ferait
une personne, puis juge ce qui s'est réellement passé.

- **Il trouve 12 catégories de bugs**, des routes en HTTP 500 et des liens morts jusqu'aux données
  bouche-trou, aux boutons d'envoi qui ne font rien, aux formulaires vidés par le bouton retour, aux
  indicateurs de chargement bloqués et aux débordements sur mobile.
- **Il prouve chacun d'eux.** Chaque constat porte la route et les étapes ordonnées qui l'ont
  produit, plus la capture d'écran et l'extrait de console ou de réseau relevés par le contrôle.
  Pas d'étapes, pas de constat.
- **Il a été mesuré.** Sur une application de test truffée de 21 bugs couvrant les 12 catégories,
  plus une page témoin propre, sniff en trouve 21 sur 21 et ne signale rien sur la page témoin.

## Installation

Le bloc ci-dessus est la voie Claude Code, via la [place de marché 10x](https://github.com/Aboudjem/10x).
Pour tout autre agent, la CLI skills de Vercel installe les trois mêmes compétences :

```bash
npx skills add Aboudjem/sniff
```

Pour l'utiliser comme un simple outil en ligne de commande, sans aucun éditeur :

```bash
npx sniff-qa --url http://localhost:3000
```

Le paquet npm s'appelle `sniff-qa` et le binaire qu'il installe s'appelle `sniff`. N'exécutez pas
`npx sniff`, qui est un paquet différent et sans rapport.

<details>
<summary>Version de Node, installation dans le projet et CI</summary>

Node.js 22 ou plus récent. `npm install -D sniff-qa` l'ajoute aux devDependencies d'un projet, et
`npx sniff-qa ci` écrit un workflow GitHub Actions avec cache du navigateur et artefacts de rapport.
</details>

## Utilisation

**1. Démarrez votre application,** avec le serveur de développement que votre projet utilise déjà.

```bash
npm run dev
```

**2. Faites-la parcourir,** depuis un second terminal. sniff détecte tout seul un serveur de
développement sur les ports courants, donc `--url` est facultatif, mais le passer lève le doute.

```bash
npx sniff-qa --url http://localhost:3000
```

**3. Lisez les constats.** Ils s'affichent groupés par gravité. Voici un extrait d'une exécution
réelle contre l'application de test à bugs de ce dépôt, avec la commande
`npx sniff-qa --url http://localhost:4321 --ci --max-pages 12` :

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

Ajoutez `--report` pour obtenir une page HTML autonome que vous pouvez envoyer à quelqu'un. Lancez
`npx sniff-qa doctor` si l'environnement semble en défaut.

<img alt="How sniff works: crawl, act, assert, prove, report" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/how-it-works.svg" width="100%">

## Ce que vous obtenez

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg">
  <img alt="The 12 classes of bugs sniff finds" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg" width="100%">
</picture>

- **Un rapport dans le terminal** groupé par gravité, chaque constat avec ses étapes, une correction
  et un chemin de capture d'écran.
- **Un fichier partageable**, un rapport HTML autonome avec `--report` ou du JSON avec `--json`.
- **Un code de sortie** non nul dès que les constats atteignent la gravité de `--fail-on`, pour que
  l'intégration continue échoue sur de vrais bugs.
- **Une étiquette de confiance** sur chacun. `uncertain` est masqué dans le terminal tant que vous ne
  passez pas `--all`.

Nouveautés de la version 0.8.0 :

- `--caps scan,report` restreint le serveur MCP à l'analyse du code source et à la lecture des
  résultats enregistrés, sans lancer ni télécharger de navigateur.
- `--storage-state auth.json` parcourt une application où vous êtes connecté. Les valeurs de cookies
  et de jetons de ce fichier sont masquées dans le texte de tous les rapports écrits, mais pas dans
  les pixels des captures d'écran.
- Un bloc `assert` dans `sniff.config` plafonne les constats par gravité (`maxCritical`, `maxHigh`,
  `maxTotal`), appliqué en ligne de commande par le parcours, l'analyse du code source et la
  découverte.

## Fonctionne dans votre éditeur

Fonctionne dans Claude Code, Cursor, Codex, Copilot, Gemini CLI et plus de 70 autres agents via
`npx skills add`. Les compétences sont du Markdown, donc elles tournent sur le modèle que votre
éditeur utilise, quel qu'il soit.

| Agent | Installation en une ligne |
|:--|:--|
| Claude Code | `claude plugin install sniff@10x` |
| L'un des 70 agents et plus | `npx skills add Aboudjem/sniff` |
| Codex, Gemini CLI, OpenCode, Pi | `./install.sh codex` |
| VS Code (Copilot) | `./install.sh copilot` |
| Tout le reste | voir [docs/editors.md](../docs/editors.md) |

<details>
<summary>L'ajouter plutôt comme serveur MCP</summary>

```bash
claude mcp add sniff-qa npx -- -y sniff-qa --mcp
codex mcp add sniff-qa -- npx -y sniff-qa --mcp
```

Cursor, VS Code, Gemini CLI, Windsurf, Continue, OpenCode et Zed acceptent la même commande sous
forme d'entrée JSON ou TOML. Tous les extraits par éditeur sont dans
[docs/editors.md](../docs/editors.md).
</details>

## Bon à savoir

> [!IMPORTANT]
> Pas de clé d'API, pas de compte, pas d'inscription, et aucun fournisseur d'IA tant que vous n'en
> configurez pas un vous-même. Le parcours et l'analyse ne modifient jamais votre code source.
> `sniff fix` est la seule commande qui réécrit du code, et seulement quand vous la lancez.

> [!NOTE]
> Un parcours clique sur des boutons et soumet de vrais formulaires, donc il peut créer de vraies
> données. Pointez-le vers une application de développement ou de préproduction, pas vers la
> production. Le premier parcours télécharge aussi une version de Chromium et la met en cache, donc
> cette exécution-là a besoin d'un accès internet.

- **Il lui faut une application qui tourne.** Sans serveur de développement lancé, il se rabat sur
  une analyse du code source seule et vous explique comment démarrer le vrai parcours.
  `npx sniff-qa scan` lance cette analyse volontairement.
- **La vérification des liens morts suit les liens externes,** donc un parcours envoie des requêtes
  vers les URL tierces que vos propres pages référencent déjà.
- **Un parcours qui trouve des bugs sort en 1** volontairement, pour que l'intégration continue fasse
  échouer la build. Ce n'est pas un plantage. `--fail-on none` désactive le seuil de gravité, mais un
  budget `assert` peut encore faire échouer l'exécution.

## En savoir plus

- [docs/editors.md](../docs/editors.md), installation et extraits MCP pour chaque agent pris en charge
- [docs/authenticated-walks.md](../docs/authenticated-walks.md), parcourir une application connectée avec `--storage-state`
- [docs/assert-budgets.md](../docs/assert-budgets.md), plafonner les constats par gravité dans `sniff.config`
- [docs/comparison.md](../docs/comparison.md), ce qui distingue sniff des linters, des vérificateurs de liens et des frameworks E2E
- [docs/faq.md](../docs/faq.md), les questions auxquelles cette page ne répond pas
- [CHANGELOG.md](../CHANGELOG.md) · [CONTRIBUTING.md](../CONTRIBUTING.md) · [LICENSE](../LICENSE)

---

<p align="center"><sub>Built by <a href="https://github.com/Aboudjem">Adam Boudjemaa</a> · <a href="../LICENSE">Apache 2.0</a> · standing on <a href="https://playwright.dev">Playwright</a> and <a href="https://github.com/dequelabs/axe-core">axe-core</a></sub></p>

<p align="center"><sub>Cette traduction a été réalisée avec l'aide d'un outil automatique. La version de référence est le <a href="../README.md">README.md</a> en anglais.</sub></p>
