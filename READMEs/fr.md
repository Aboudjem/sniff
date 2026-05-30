<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/logo-light.svg">
  <img alt="Sniff" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/logo-light.svg" width="100%">
</picture>

<p align="center">
  <a href="https://www.npmjs.com/package/sniff-qa"><img src="https://img.shields.io/npm/v/sniff-qa?color=ef4444&logo=npm&label=npm&style=flat-square" alt="npm"></a>
  <a href="https://www.npmjs.com/package/sniff-qa"><img src="https://img.shields.io/npm/dm/sniff-qa?color=ef4444&logo=npm&label=downloads&style=flat-square" alt="téléchargements npm"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache_2.0-ef4444?style=flat-square" alt="Licence"></a>
  <a href="https://github.com/Aboudjem/sniff/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Aboudjem/sniff/ci.yml?style=flat-square&label=CI" alt="CI"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%E2%89%A522-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node"></a>
  <a href="https://github.com/Aboudjem/10x"><img src="https://img.shields.io/badge/10x-marketplace-ef4444?style=flat-square" alt="Marketplace 10x"></a>
  <a href="https://github.com/Aboudjem/sniff/stargazers"><img src="https://img.shields.io/github/stars/Aboudjem/sniff?style=flat-square&color=ef4444" alt="Étoiles"></a>
</p>

<p align="center">
  <a href="../README.md">English</a> ·
  <a href="zh-CN.md">简体中文</a> ·
  <a href="ja.md">日本語</a> ·
  <a href="es.md">Español</a> ·
  <b>Français</b>
</p>

<p align="center"><b>Pointez-le sur votre application en cours d'exécution. Il parcourt vos vrais parcours utilisateurs dans un vrai navigateur et vous dit ce qui est réellement cassé, avec des preuves à l'appui.</b></p>

<p align="center">
  <a href="#démarrage-rapide">Démarrage rapide</a> ·
  <a href="#ce-quil-détecte">Ce qu'il détecte</a> ·
  <a href="#pourquoi-lui-faire-confiance">Pourquoi lui faire confiance</a> ·
  <a href="#fonctionnement">Fonctionnement</a> ·
  <a href="#démo">Démo</a> ·
  <a href="#faq">FAQ</a>
</p>

![démo sniff](.github/assets/demo.gif)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/sniff-diagram.svg">
  <img alt="Flux Sniff : votre application en cours d'exécution, navigation en navigateur headless, résultats avec preuves" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/sniff-diagram.svg" width="100%">
</picture>

---

## Qu'est-ce que c'est ?

Sniff est un scanner QA autonome. Pointez-le sur une application web en cours d'exécution et il **parcourt les vrais parcours utilisateurs de votre application dans un vrai navigateur (headless)** (en cliquant sur des boutons, en remplissant des formulaires, en suivant des liens) et signale ce qui est réellement cassé.

Ce n'est **pas** un linter et **pas** un scanner statique. Il ouvre vos pages, interagit avec elles comme le ferait un utilisateur, et observe ce qui se passe.

Chaque bug signalé est accompagné d'une **preuve** : la page exacte, les étapes ordonnées pour le reproduire, une capture d'écran et l'extrait de console ou réseau qui l'a détecté. Un résultat sans preuve de reproduction n'est pas un résultat.

```bash
npx sniff-qa --url http://localhost:3000
```

Une seule commande, sans configuration, sans clé API, sans installation de Playwright. Pointez-le sur votre application en cours d'exécution, ou lancez simplement `npx sniff-qa` depuis votre projet et il détecte automatiquement un serveur de développement sur les ports courants.

> Sniff parcourt une **application en cours d'exécution**. Si aucun serveur de développement n'est actif, il bascule sur une analyse du code source et vous indique précisément comment démarrer le vrai parcours. Voir [Démarrage rapide](#démarrage-rapide).

---

## Démarrage rapide

Vous avez besoin de **Node.js 22+** et d'une application web que vous pouvez exécuter localement (ou d'une URL).

> **Nommage :** le paquet npm s'appelle **`sniff-qa`**, donc utilisez `npx sniff-qa` ou `npm install -D sniff-qa`. Une fois installé, le binaire est **`sniff`** (le binaire `sniff-qa` fonctionne aussi). N'utilisez pas `npx sniff`, c'est un autre paquet.

### 1. Démarrez votre application

```bash
npm run dev        # ou la commande habituelle pour démarrer votre app
```

### 2. Lancez le parcours

Dans un autre terminal :

```bash
npx sniff-qa --url http://localhost:3000     # pointez-le sur votre application en cours d'exécution
```

C'est la commande universelle. Sniff **détecte automatiquement** un serveur de développement sur les ports courants, donc depuis le dossier de votre projet vous pouvez souvent simplement lancer `npx sniff-qa` sans aucun argument. Si votre application tourne sur un port non standard (ou si la détection automatique échoue), passez `--url` (ça fonctionne toujours). Il parcourt aussi une URL déployée :

```bash
npx sniff-qa --url https://staging.myapp.com
```

> **Des bugs trouvés ? Il termine avec un code non nul, intentionnellement.** Un parcours qui détecte des problèmes se termine avec le code `1` pour que la CI échoue le build ; ce n'est **pas** un plantage (vous verrez une ligne `✓ Scan complete`). Passez `--fail-on none` pour toujours terminer avec `0`.

> **Le premier lancement télécharge un navigateur.** La première fois que Sniff ouvre un navigateur, il télécharge une version de Chromium (~165 Mo, une seule fois). Vous verrez la progression. Vous avez besoin d'un accès internet pour ce premier lancement ; ensuite il est mis en cache.

### 3. Lisez le rapport

Les résultats s'affichent dans votre terminal, regroupés par sévérité, chacun avec les étapes de reproduction. Vous voulez une page partageable ?

```bash
npx sniff-qa --url http://localhost:3000 --report   # effectue un parcours, puis écrit sniff-reports/sniff-report.html (autonome)
```

**Aucune application en cours d'exécution ?** Sniff n'échoue pas silencieusement. Il effectue une analyse du code source uniquement et affiche une prochaine étape claire (démarrez votre serveur de développement ou passez `--url`) pour vous permettre d'accéder au vrai parcours. Vous pouvez aussi lancer l'analyse du code source intentionnellement :

```bash
npx sniff-qa scan         # analyse du code source uniquement, sans navigateur
```

Bloqué ? Lancez `npx sniff-qa doctor` pour vérifier votre environnement (Node, navigateur, serveur de développement).

---

## Ce qu'il détecte

Sniff parcourt votre application et recherche **12 classes de vrais bugs** :

| # | Classe | Exemples |
|:--|:------|:---------|
| 1 | **Pages / routes cassées** | Réponses 4xx/5xx, rendus blancs, écrans d'erreur |
| 2 | **Liens cassés** | Liens internes et externes morts |
| 3 | **Erreurs console et réseau** | Exceptions non capturées et requêtes échouées *pendant l'interaction* |
| 4 | **Données vides et factices** | Données manquantes, ainsi que des espaces réservés comme `lorem ipsum`, `TODO`, `test@test.com` |
| 5 | **Formulaires cassés** | Boutons de soumission inactifs, validation qui ne se déclenche jamais |
| 6 | **Perte d'état** | Remplissez un formulaire, revenez en arrière, et il est effacé |
| 7 | **Régressions de parcours / impasses** | Un parcours qui ne peut pas être complété |
| 8 | **Mauvais états de chargement et d'erreur** | Spinners infinis, états d'erreur manquants |
| 9 | **Résultats asynchrones cassés** | Soumis mais aucun retour de succès (signalé comme "nécessite une vérification hors bande") |
| 10 | **Problèmes responsive** | Débordement et cibles de tap trop petites (un passage mobile à 375px) |
| 11 | **Accessibilité** | Texte alternatif et libellés manquants, contraste, via [axe-core](https://github.com/dequelabs/axe-core) |
| 12 | **Actions principales floues** | L'appel à l'action principal est enfoui ou ambigu |

Chaque résultat est livré avec :

- Une **preuve de reproduction** : la route exacte, les étapes ordonnées, une capture d'écran et l'extrait console/réseau.
- Une **sévérité**, pour que vous corrigiez ce qui est prioritaire en premier.
- Une **confiance** : `confirmed`, `likely` ou `uncertain`. Les résultats incertains sont masqués par défaut ; ajoutez `--all` pour les voir.
- **Un correctif suggéré.**

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg">
  <img alt="Les classes de bugs que Sniff détecte" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg" width="100%">
</picture>

---

## Pourquoi lui faire confiance

La plupart des scanners vous noient dans les faux positifs jusqu'à ce que vous arrêtiez de les lire. Sniff est conçu à l'opposé.

Nous l'avons mesuré sur une application de test plantée avec **21 bugs répartis sur l'ensemble des 12 classes**, ainsi qu'une page de contrôle propre qui ne devrait produire aucun résultat :

| | Ancien moteur | Nouveau moteur |
|:--|:--|:--|
| Bugs trouvés | 9 / 21 (43%) | **21 / 21 (100%)** |
| Précision | ~13% | **100%** |
| Faux positifs | 125 | **0** |
| Résultats sur la page propre | n/a | **0** |
| Commande principale | plantait | fonctionne |

Ces chiffres sont verrouillés comme test de régression. La suite complète comprend **441 tests**.

**Comment il maintient les faux positifs proches de zéro :**

- Un **filtre de bruit** interne élimine les parasites qui ne sont pas vos bugs : favicons, analytics, bavardage de hot-module-reload, redirections d'authentification attendues, abandons du moteur.
- Les résultats d'accessibilité sont appuyés par **axe-core**, qui est conçu pour produire zéro faux positif.
- **Les résultats incertains sont supprimés par défaut** (utilisez `--all` pour les voir).
- Une page cassée est signalée **une seule fois**, sans être re-signalée à chaque lien qui y pointe.

Si Sniff ne peut pas prouver un bug, il ne le signale pas.

---

## En quoi est-il différent ?

Les linters lisent votre code source. Les frameworks de tests bout-en-bout vous demandent d'écrire les tests vous-même. Les vérificateurs de liens ne vérifient que les liens. Sniff pilote votre vraie application et juge le résultat.

| | **Sniff** | linkinator | pa11y | Playwright codegen | Services de type QA-Wolf |
|:--|:--|:--|:--|:--|:--|
| Parcourt de vrais parcours utilisateurs dans un navigateur | **Oui** | Non | Non | Vous le scriptez | Oui |
| Zéro configuration, zéro rédaction de tests | **Oui** | Oui | Oui | Non (vous écrivez les tests) | Non (intégration) |
| Liens cassés | **Oui** | Oui | Non | Manuel | Manuel |
| Accessibilité (axe-core) | **Oui** | Non | **Oui** | Manuel | Partiel |
| Données vides / espaces réservés / factices | **Oui** | Non | Non | Non | Non |
| Perte d'état (le bouton retour efface un formulaire) | **Oui** | Non | Non | Manuel | Manuel |
| Preuve de reproduction unique par résultat | **Oui** | Non | Partiel | Non | Variable |
| Rapport HTML autonome | **Oui** | Non | Partiel | Non | Tableau de bord |
| Fonctionne en local, sans compte, sans clé API | **Oui** | Oui | Oui | Oui | Non (service) |

Ce que Sniff fait de façon unique en une seule commande : détecter les **données vides/espaces réservés**, la **perte d'état** et les **résultats asynchrones cassés**, et vous remettre un seul rapport de preuve, **sans aucun script à écrire et sans service à souscrire**.

---

## Commandes

```
sniff                  Parcourt votre application (détecte automatiquement le serveur de développement). Mode par défaut.
sniff --url <url>      Parcourt une URL spécifique
sniff scan             Analyse du code source uniquement, sans navigateur (espaces réservés, TODO, liens morts, etc.)
sniff report           Affiche les résultats du dernier lancement
sniff doctor           Vérifie votre environnement (Node, navigateur, configuration, serveur de développement)
sniff ci               Génère un workflow GitHub Actions
sniff fix              Corrige automatiquement les problèmes sans risque (console.log, debugger, etc.)
sniff --help           Affiche toutes les commandes et options
sniff --version        Affiche la version
```

### Options utiles

| Option | Ce qu'elle fait |
|:-----|:-------------|
| `--url <url>` | Parcourt cette URL au lieu de la détection automatique |
| `--report` | Écrit un rapport HTML autonome dans `sniff-reports/sniff-report.html` |
| `--all` | Affiche aussi les résultats à faible confiance (`uncertain`) |
| `--max-pages <n>` | Limite le nombre de pages à parcourir (défaut : 25) |
| `--no-mobile` | Ignore le passage responsive à 375px |
| `--headed` | Affiche la fenêtre du navigateur pendant le parcours |
| `--json` | Sortie JSON lisible par les machines |
| `--ci` | Mode CI (sortie stable, non interactive) |
| `--fail-on <sev>` | Termine avec un code non nul pour les résultats à cette sévérité ou au-dessus |

---

## Démo

Un vrai lancement sur une application boguée : 21 vrais problèmes, zéro faux positif, chaque résultat avec sévérité, confiance, étapes de reproduction et un correctif. Regardez Sniff parcourir l'application et diffuser les résultats en temps réel (la démo animée est visible en haut de ce README, [`.github/assets/demo.gif`](.github/assets/demo.gif)).

Ci-dessous, le même lancement sous forme de capture terminal stylisée :

<img alt="Sniff parcourant une application boguée et signalant 21 vrais problèmes avec zéro faux positif" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/demo.svg" width="100%">

---

## Utilisez-le depuis votre éditeur IA

Sniff se déploie aussi en tant que serveur MCP. Ajoutez-le une fois, puis demandez simplement à votre assistant de *"analyser ce projet pour des bugs"* ou de *"parcourir mon application."* Si votre application est en cours d'exécution, Sniff la détecte automatiquement, sans que vous ayez besoin de passer une URL.

**Un outil `sniff` unifié, trois modes :**

- `walk` : **recommandé.** Parcourt les vrais parcours de votre application en cours d'exécution (le parcours ci-dessus).
- `scan` : analyse du code source uniquement, sans navigateur.
- `report` : affiche les résultats du dernier lancement.

(`run` et `discover` sont des modes hérités conservés pour la compatibilité ascendante.)

### Slash commands et outils MCP

En tant que plugin Claude Code, Sniff ajoute trois slash commands :

| Slash command | Ce qu'elle fait |
|:--------------|:-------------|
| `/sniff` | Parcourt votre application en cours d'exécution et détecte les vrais bugs (le parcours). |
| `/sniff-fix` | Analyse et corrige automatiquement les problèmes sans risque (`console.log` parasites, `debugger`, etc.). |
| `/sniff-report` | Affiche les résultats du dernier lancement. |

En tant que serveur MCP, la surface est **un outil `sniff` unifié** qui accepte `{ mode, rootDir, baseUrl? }`. Les trois modes ci-dessus (`walk` / `scan` / `report`) sont la façon de le piloter, et l'outil unifié est celui que vous devez utiliser. Les outils ciblés (`sniff_scan`, `sniff_run`, `sniff_report`, ainsi que `sniff_discover` et `sniff_install`) restent enregistrés pour la compatibilité ascendante et les capacités délimitées, mais les nouveaux usages doivent passer par l'outil `sniff` unifié.

### Installez les skills dans n'importe quel CLI IA

Le serveur MCP ci-dessus fonctionne dans tous les clients compatibles MCP. Pour charger aussi les skills `/sniff` directement dans un autre CLI, lancez l'installateur en une ligne. Il crée des liens symboliques vers les trois skills dans le répertoire skills de ce CLI ; `--update` récupère la dernière version et recrée les liens, `--uninstall` les supprime.

```bash
curl -fsSL https://raw.githubusercontent.com/Aboudjem/sniff/main/install.sh | bash -s codex
```

Sous Windows, lancez `install.ps1 <platform>` depuis un checkout (le Mode développeur ou un shell élevé est nécessaire pour les liens symboliques).

| Plateforme | Répertoire des skills | Commande |
|:--|:--|:--|
| Claude Code | (plugin) | `claude plugin install sniff@10x` |
| Codex / Gemini / OpenCode / Pi | `~/.agents/skills` | `install.sh codex` |
| VS Code (Copilot) | `~/.copilot/skills` | `install.sh copilot` |
| Trae | `~/.trae/skills` | `install.sh trae` |
| Vibe | `~/.vibe/skills` | `install.sh vibe` |
| OpenClaw | `~/.openclaw/skills` | `install.sh openclaw` |
| Antigravity | `~/.gemini/antigravity/skills` | `install.sh antigravity` |
| Hermes / Cline / Kimi | `~/.<cli>/skills` | `install.sh hermes` |

Les conventions des répertoires de skills changent entre les versions de CLI. Si un lien ne se résout plus, revenez au serveur MCP (il fonctionne partout). Lancez `install.sh all` pour lier toutes les plateformes en une seule fois.

<details>
<summary><b>Claude Code</b></summary>

Installation en une commande depuis le [marketplace 10x](https://github.com/Aboudjem/10x) :

```bash
claude plugin marketplace add Aboudjem/10x
claude plugin install sniff@10x
```

Ou ajoutez uniquement le serveur MCP :

```bash
claude mcp add sniff-qa npx -- -y sniff-qa --mcp
```
</details>

<details>
<summary><b>Cursor</b></summary>

Ajoutez à `~/.cursor/mcp.json` :

```json
{ "mcpServers": { "sniff-qa": { "command": "npx", "args": ["-y", "sniff-qa", "--mcp"] } } }
```
</details>

<details>
<summary><b>VS Code (Copilot)</b></summary>

Ajoutez à `.vscode/mcp.json` :

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

Ajoutez à `~/.gemini/mcp_config.json` :

```json
{ "mcpServers": { "sniff-qa": { "command": "npx", "args": ["-y", "sniff-qa", "--mcp"] } } }
```
</details>

<details>
<summary><b>Windsurf</b></summary>

Ajoutez à `~/.codeium/windsurf/mcp_config.json` :

```json
{ "mcpServers": { "sniff-qa": { "command": "npx", "args": ["-y", "sniff-qa", "--mcp"] } } }
```
</details>

<details>
<summary><b>Continue.dev</b></summary>

Ajoutez à `.continue/mcpServers/sniff-qa.yaml` :

```yaml
mcpServers:
  sniff-qa: { command: npx, args: ["-y", "sniff-qa", "--mcp"], type: stdio }
```
</details>

> Le premier parcours basé sur un navigateur télécharge Chromium (~165 Mo). Via MCP, Sniff retourne une charge structurée `needsSetup` au lieu de bloquer l'éditeur sur un long téléchargement : lancez l'installation qu'il vous indique, puis redemandez.

---

## Fonctionnement

1. **Trouver l'application.** Sniff détecte automatiquement votre serveur de développement en cours d'exécution (ou vous passez `--url`).
2. **Parcourir les flux.** Il ouvre les pages dans un navigateur headless et interagit avec elles comme un utilisateur (en cliquant, en remplissant des formulaires, en suivant des liens) sur desktop et lors d'un passage mobile à 375px.
3. **Tout observer.** Il enregistre les erreurs de console, les requêtes réseau échouées, les rendus cassés, les retours manquants et les problèmes d'accessibilité au fil du parcours.
4. **Filtrer le bruit.** Le filtre de bruit interne et axe-core éliminent les faux positifs ; les résultats incertains sont retenus.
5. **Rapporter avec des preuves.** Chaque résultat retenu reçoit une sévérité, une confiance, des étapes de reproduction, une capture d'écran et un correctif suggéré, dans le terminal et dans un rapport HTML optionnel.

<img alt="Comment fonctionne sniff : crawl, act, assert, prove, report" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/how-it-works.svg" width="100%">

---

## Intégration CI

Lancez Sniff dans votre pipeline et faites échouer le build en cas de vrais bugs :

```bash
npx sniff-qa --ci --fail-on high
```

Générez un workflow GitHub Actions prêt à committer :

```bash
npx sniff-qa ci
```

Cela écrit `.github/workflows/sniff.yml` avec la mise en cache du navigateur et les artefacts de rapport.

---

## FAQ

**Fonctionne-t-il sans serveur de développement ?**
Sniff est conçu pour parcourir une application *en cours d'exécution*, c'est là qu'il excelle. Si aucun serveur ne tourne, il n'échoue pas silencieusement : il effectue une analyse du code source uniquement et vous indique précisément comment démarrer le vrai parcours (démarrez votre serveur de développement ou passez `--url`). Vous pouvez aussi lancer `npx sniff-qa scan` pour obtenir l'analyse du code source intentionnellement.

**Qu'est-ce qui est téléchargé au premier lancement ?**
La première fois que Sniff ouvre un navigateur, il télécharge une version de Chromium (~165 Mo, une seule fois, puis mise en cache). Vous verrez la progression et vous avez besoin d'un accès internet pour ce premier lancement. Rien d'autre n'est installé et aucun compte n'est créé.

**Ai-je besoin d'une clé API ?**
Non. Sniff s'exécute entièrement sur votre machine sans clé API ni inscription. Votre code et votre application ne quittent jamais votre ordinateur.

**En quoi est-il différent d'un linter ?**
Un linter lit vos fichiers source sans jamais exécuter votre application, il ne peut donc pas voir un bouton de soumission inactif, un spinner infini, un formulaire effacé ou une page 500. Sniff ouvre votre vraie application, interagit avec elle et signale ce qui s'est réellement cassé, avec une capture d'écran et les étapes de reproduction.

**En quoi est-il différent de Playwright codegen (ou de l'écriture de tests E2E) ?**
Playwright codegen enregistre un script que *vous* rédigez et maintenez ; il ne teste que le chemin sur lequel vous avez cliqué. Sniff ne vous demande rien à maintenir : il explore vos parcours de façon autonome et juge le résultat, détectant des choses qu'un happy-path enregistré ne vérifie jamais (données vides/espaces réservés, perte d'état, retour de succès manquant).

**Est-ce qu'il modifie mon code ?**
Non, pas pendant un parcours. Le parcours et l'analyse sont en lecture seule. La commande séparée `sniff fix` applique des corrections automatiques sans risque (comme les `console.log`/`debugger` parasites) et uniquement quand vous la lancez.

**Avec quels stacks fonctionne-t-il ?**
Toute application web que vous pouvez ouvrir dans un navigateur : React, Next.js, Vue, Svelte, Angular, Remix, SvelteKit, Astro, HTML pur et bien d'autres. Il parcourt l'application rendue, donc le framework n'a pas d'importance pour les vérifications en navigateur.

---

## Fonctionne nativement dans

Claude Code · Cursor · VS Code (Copilot) · Codex · Gemini CLI · Windsurf · Continue.dev, via le serveur MCP (commande `npx`, args `["-y", "sniff-qa", "--mcp"]`) ou le CLI directement.

---

## Historique des étoiles

<a href="https://star-history.com/#Aboudjem/sniff&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=Aboudjem/sniff&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=Aboudjem/sniff&type=Date" />
    <img alt="Graphique de l'historique des étoiles pour Aboudjem/sniff" src="https://api.star-history.com/svg?repos=Aboudjem/sniff&type=Date" width="70%" />
  </picture>
</a>

---

## Contribuer

Issues et PRs bienvenues. Voir [CONTRIBUTING.md](CONTRIBUTING.md).

---

<p align="center">
  <sub>
    Construit avec <a href="https://playwright.dev">Playwright</a> · <a href="https://github.com/dequelabs/axe-core">axe-core</a> · <a href="https://developer.chrome.com/docs/lighthouse">Lighthouse</a> · <a href="https://github.com/mapbox/pixelmatch">pixelmatch</a> · <a href="https://zod.dev">Zod</a> · <a href="https://github.com/modelcontextprotocol/typescript-sdk">MCP SDK</a>
  </sub>
</p>

<p align="center">
  <a href="https://www.linkedin.com/in/adam-boudjemaa/"><img src="https://img.shields.io/badge/LinkedIn-0A66C2?style=flat-square&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
  <a href="https://x.com/AdamBoudj"><img src="https://img.shields.io/badge/X-000000?style=flat-square&logo=x&logoColor=white" alt="X"></a>
  <a href="https://adam-boudjemaa.com/"><img src="https://img.shields.io/badge/Website-ef4444?style=flat-square&logo=googlechrome&logoColor=white" alt="Site web"></a>
</p>

<p align="center">
  <sub>Créé par <a href="https://github.com/Aboudjem">Adam Boudjemaa</a> · <a href="LICENSE">Apache 2.0</a></sub>
</p>

---

*Cette traduction a été réalisée avec l'assistance d'un outil automatique. Les locuteurs natifs sont invités à ouvrir une PR pour corriger toute formulation maladroite ou imprécision. Le README anglais ([../README.md](../README.md)) fait foi en cas de divergence.*
