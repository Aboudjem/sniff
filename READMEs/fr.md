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

<p align="center"><a href="../README.md">English</a> · <a href="zh-CN.md">简体中文</a> · <a href="ja.md">日本語</a> · <a href="es.md">Español</a> · <b>Français</b></p>

<p align="center"><b>Repérez ce qui est cassé dans votre application web avant vos utilisateurs.</b></p>

<p align="center"><a href="#ce-que-vous-obtenez">Ce que vous obtenez</a> · <a href="#installation">Installation</a> · <a href="#comment-ça-marche">Comment ça marche</a> · <a href="#compatibilité">Compatibilité</a> · <a href="#preuve">Preuve</a> · <a href="#faq">FAQ</a> · <a href="#limites">Limites</a></p>

```bash
npx sniff-qa --url http://localhost:3000
```

## Ce que vous obtenez

Un rapport qui commence par le verdict, puis les trois points à corriger en premier, puis chaque constat.
Voici le rapport d'une vraie exécution sur l'application de test à bugs plantés de ce dépôt (2026-11-17, sniff 0.9.3).

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

Vous avez changé un formulaire, et une page que vous n'avez jamais ouverte renvoie une erreur 500.
sniff ouvre votre application dans un vrai navigateur et la parcourt comme un utilisateur.
Chaque bug de page qu'il signale vient avec les étapes qui le reproduisent.

### Pourquoi l'utiliser

- **Corrigez au lieu de chercher.** Chaque constat de page donne la route, les étapes et une correction, la plupart avec une capture d'écran.
- **La preuve qu'il trouve de vrais bugs.** Testé sur des bugs plantés exprès : 21 sur 21 trouvés, 0 faux constat sur la page propre (`npm run build && npm run proof`).
- **Bloquez les mauvais merges.** `--fail-on` sort en 1 sur un constat critique ou élevé, et `npx sniff-qa ci` écrit le fichier GitHub Actions. Pas de clé d'API.

Il lui faut votre application lancée, et il soumet de vrais formulaires : utilisez une application de développement ou de préproduction.
Le premier parcours télécharge une fois le moteur de navigation et Chromium.
Cela fait environ 440 Mo à télécharger et environ 730 Mo sur disque, mesuré sur un Mac.

Pour reproduire l'exemple depuis un clone, démarrez l'application de test, puis parcourez-la depuis un second terminal :

```bash
node sniff-tests/planted-bugs/server.mjs 4517
npx sniff-qa --url http://localhost:4517
```

<img alt="sniff walking a buggy app and streaming findings with severity, confidence, steps to reproduce, and a fix" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/demo.gif" width="100%">

## Installation

Node.js 22 ou plus récent. Choisissez une voie.

**En ligne de commande, sans éditeur.** Démarrez votre application, puis parcourez-la depuis un second terminal :

```bash
npx sniff-qa --url http://localhost:3000
```

Le paquet npm s'appelle `sniff-qa`. N'exécutez pas `npx sniff` : c'est un paquet sans rapport.

**Plugin Claude Code**, via la [place de marché 10x](https://github.com/Aboudjem/10x) :

```bash
claude plugin marketplace add Aboudjem/10x
claude plugin install sniff@10x
```

**Compétences pour tout agent**, via la CLI skills de Vercel :

```bash
npx skills add Aboudjem/sniff
```

**Serveur MCP**, pour tout client MCP :

```bash
claude mcp add sniff-qa -- npx -y sniff-qa --mcp
```

Le premier parcours télécharge deux choses, une seule fois : le moteur de navigation (Playwright, axe-core et
Lighthouse) et Chromium. Pour le faire à l'avance, lancez :

```bash
npx sniff-qa install
```

La commande se termine par le temps écoulé. Sur un Mac avec des caches vides, elle a affiché 43 s (2026-11-17, sniff 0.9.3).
Elle a téléchargé environ 440 Mo. Elle a laissé 193 Mo de moteur et 530 Mo de Chromium sur le disque.
Les tailles varient selon la plateforme. Pour remesurer sous macOS :

```bash
du -sm ~/.cache/sniff-qa/engine/* ~/Library/Caches/ms-playwright
```

`npx sniff-qa doctor` vérifie Node, le navigateur et votre serveur de développement.

Le serveur MCP démarre avant ces téléchargements. Avec un cache npm vide, `npx -y sniff-qa@0.9.1 --mcp`
a répondu à sa première poignée de main en 3,1 à 4,9 s (5 exécutions, 2026-11-17). La version 0.9.0 prenait 37 à 93 s,
au-delà de la limite de connexion de 30 s de Claude Code. Pour remesurer, dans un clone de ce dépôt :

```bash
npm run cold-start -- 0.9.1 5
```

Un parcours affiche des lignes de progression, puis le rapport. Vous pouvez récupérer le résultat de quatre façons :

| Sortie                   | Option      | Usage                                           |
| :----------------------- | :---------- | :---------------------------------------------- |
| Rapport dans le terminal | (défaut)    | Lire le résultat tout de suite                  |
| Page HTML                | `--report`  | L'envoyer à quelqu'un, un seul fichier autonome |
| JSON                     | `--json`    | Scripts et autres outils                        |
| Code de sortie           | `--fail-on` | Faire échouer la CI sur de vrais bugs           |

| Code de sortie | Signification                                                                                |
| :------------- | :------------------------------------------------------------------------------------------- |
| `0`            | Aucun constat n'a atteint les gravités de `--fail-on` (par défaut : critique et élevée)      |
| `1`            | Un constat les a atteintes, un budget `assert` a été dépassé, ou sniff n'a pas pu s'exécuter |

<details>
<summary>Installation dans le projet et CI</summary>

`npm install -D sniff-qa` l'ajoute à un projet. `npx sniff-qa ci` écrit un workflow GitHub Actions
avec cache du navigateur et artefacts de rapport. Sans application lancée, sa première exécution ne lit que votre code.
Décommentez son étape `Start the app` et ajoutez `--url` pour parcourir l'application.
</details>

## Comment ça marche

<img alt="How sniff works: crawl, act, assert, prove, report" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/how-it-works.svg" width="100%">

1. **Trouver l'application.** Il utilise `--url`, ou un serveur de développement sur un port courant.
2. **La parcourir.** Un Chromium sans interface suit vos liens, clique sur les boutons et remplit les formulaires, comme un utilisateur.
3. **Juger ce qui s'est passé.** Chaque page est vérifiée pour 12 classes de bugs.
4. **Le prouver.** Un constat exige une route et les étapes. Il ajoute une capture d'écran et les lignes de console ou de réseau quand il les a.
5. **Rapporter.** Le verdict d'abord, puis la liste à corriger en premier, puis le détail.

Les 12 classes :

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg">
  <img alt="The 12 classes of bugs sniff finds" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg" width="100%">
</picture>

Sans application lancée, `sniff` lit plutôt votre code source (`sniff scan`). Il signale les instructions de débogage,
le texte provisoire et les imports cassés, et vous explique comment démarrer le vrai parcours.

Le serveur MCP expose ces outils :

| Outil            | Ce qu'il fait                                                   |
| :--------------- | :-------------------------------------------------------------- |
| `sniff`          | Un seul point d'entrée : `mode: "walk"`, `"scan"` ou `"report"` |
| `sniff_scan`     | Analyse du code source seule, sans navigateur                   |
| `sniff_run`      | Analyse du code source plus vérifications dans le navigateur    |
| `sniff_discover` | Génère des scénarios à partir de votre code source et les joue  |
| `sniff_install`  | Télécharge le moteur et Chromium, avec progression              |
| `sniff_report`   | Lit les derniers résultats enregistrés                          |

`--caps scan,report` restreint le serveur à `sniff_scan`, `sniff_report` et l'outil unifié `sniff`, sans aucun navigateur.

## Compatibilité

Chaque ligne a été testée le 2026-11-17 avec la build sniff 0.9.0.

| Agent           | Ce qui a tourné                                                                               | Testé      |
| :-------------- | :-------------------------------------------------------------------------------------------- | :--------- |
| Claude Code     | `claude -p` avec sniff comme serveur MCP a appelé `sniff_scan` et lu 2 constats               | 2026-11-17 |
| Codex CLI       | `codex exec` avec sniff comme serveur MCP a appelé `sniff_scan` et lu 2 constats              | 2026-11-17 |
| Gemini CLI      | `gemini extensions validate .` a accepté `gemini-extension.json`                              | 2026-11-17 |
| Tout client MCP | `node sniff-tests/mcp-smoke.mjs` a listé 6 outils et un parcours a renvoyé 20 constats        | 2026-11-17 |
| CLI skills      | `npx skills@1.9.0 add Aboudjem/sniff` a installé les 3 compétences dans un dossier temporaire | 2026-11-17 |

Documentés, non testés aujourd'hui : Cursor, VS Code avec Copilot, Windsurf, OpenCode et Zed.
Leurs extraits sont dans [docs/editors.md](../docs/editors.md).

## Preuve

Trois commandes réaffichent les chiffres de cette page. La première affiche le score sur l'application de test.

```bash
npm run build && npm run proof
```

Elle démarre l'application de test à bugs plantés, la parcourt et note le rapport. Sortie du 2026-11-17 :

```text
  Recall:    21/21  (100%)
  Findings:  27 deduped (27 raw)
  Matched:   27   Candidate FP: 0   Precision proxy: 100%
  Hard FP on clean page (/clean): 0
```

L'exemple plus haut montre 26 constats et signale 1 constat de faible confiance masqué. L'exécution de preuve utilise `--all`, elle compte donc les 27.

L'application de test contient 21 bugs plantés couvrant les 12 classes, plus une page de contrôle propre.
Le correcteur est [sniff-tests/score-fixture.mjs](../sniff-tests/score-fixture.mjs).
Les bugs sont listés dans [sniff-tests/planted-bugs/MANIFEST.json](../sniff-tests/planted-bugs/MANIFEST.json).

```bash
npm test
```

Affiche `Test Files  54 passed (54)` et `Tests  603 passed (603)` le 2026-11-17.
La suite inclut la barrière sur l'application de test. Elle fait échouer la build si le rappel passe sous 85 %.
Elle échoue aussi sur tout constat sur la page propre.

```bash
node sniff-tests/mcp-smoke.mjs
```

Affiche les 6 outils MCP et les 20 constats cités dans le tableau plus haut.

## FAQ

**Faut-il une clé d'API ou un compte ?**
Non. Le parcours et l'analyse du code source tournent sur votre machine. Rien n'est envoyé nulle part, sauf si vous configurez vous-même l'exploration par IA facultative.

**Un parcours va-t-il modifier les données de mon application ?**
C'est possible. Un parcours clique sur des boutons et soumet de vrais formulaires, donc pointez-le vers une application de développement ou de préproduction.

**Pourquoi est-il sorti en 1 alors que rien n'a planté ?**
La sortie 1 signifie qu'il a trouvé des bugs d'une gravité bloquante, donc la CI fait échouer la build. Passez `--fail-on none` pour toujours sortir en 0.

**Va-t-il modifier mon code ?**
Non. Le parcours et l'analyse ne touchent jamais votre code source. Seul `sniff fix` modifie des fichiers, et seulement quand vous le lancez.

**Peut-il parcourir une application où je suis connecté ?**
Oui. Passez `--storage-state auth.json`. Les valeurs de cookies et de jetons de ce fichier sont masquées dans les rapports écrits.

D'autres réponses sont dans [docs/faq.md](../docs/faq.md).

## Limites

- Le parcours exige une application lancée. Sans elle, vous n'obtenez que l'analyse du code source.
- Le premier parcours a besoin d'internet pour télécharger une fois le moteur et Chromium : environ 440 Mo, puis environ 730 Mo sur disque sur un Mac.
- D'ici là, les outils MCP de navigateur répondent `needsSetup` et l'agent appelle d'abord `sniff_install`.
- La vérification des liens morts suit les liens externes, donc un parcours interroge les URL tierces vers lesquelles pointent vos pages.
- Le masquage couvre le texte des rapports, pas les pixels des captures d'écran. La capture d'une page connectée peut montrer des données privées.
- Il trouve ce qu'un utilisateur verrait. Il ne lit pas les journaux de votre serveur et ne mesure pas la charge.

## En savoir plus

- [docs/editors.md](../docs/editors.md) : installation et extraits MCP pour chaque agent
- [docs/authenticated-walks.md](../docs/authenticated-walks.md) : parcourir une application où vous êtes connecté
- [docs/assert-budgets.md](../docs/assert-budgets.md) : plafonner les constats par gravité dans `sniff.config`
- [docs/comparison.md](../docs/comparison.md) : ce qui distingue sniff des linters et des frameworks E2E
- [CHANGELOG.md](../CHANGELOG.md) · [CONTRIBUTING.md](../CONTRIBUTING.md) · [LICENSE](../LICENSE)

---

<p align="center"><sub>Built by <a href="https://github.com/Aboudjem">Adam Boudjemaa</a> · <a href="../LICENSE">Apache 2.0</a> · built on <a href="https://playwright.dev">Playwright</a> and <a href="https://github.com/dequelabs/axe-core">axe-core</a></sub></p>

<p align="center"><sub>Cette traduction a été réalisée avec l'aide d'un outil automatique. La version de référence est le <a href="../README.md">README.md</a> en anglais.</sub></p>
