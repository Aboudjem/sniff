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

<p align="center"><a href="../README.md">English</a> · <a href="zh-CN.md">简体中文</a> · <a href="ja.md">日本語</a> · <b>Español</b> · <a href="fr.md">Français</a></p>

<p align="center"><b>Apúntalo a tu aplicación en ejecución. Recorre tus flujos de usuario reales en un navegador real y te dice qué está roto de verdad, con pruebas.</b></p>

<p align="center"><a href="#qué-hace">Qué hace</a> · <a href="#instalación">Instalación</a> · <a href="#cómo-usarlo">Cómo usarlo</a> · <a href="#qué-obtienes">Qué obtienes</a> · <a href="#funciona-en-tu-editor">Funciona en tu editor</a> · <a href="#conviene-saber">Conviene saber</a></p>

<img alt="sniff walking a buggy app and streaming findings with severity, confidence, steps to reproduce, and a fix" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/demo.gif" width="100%">

```bash
claude plugin marketplace add Aboudjem/10x
claude plugin install sniff@10x
```

## Qué hace

La mayoría de los linters leen tu código fuente sin llegar a ejecutar tu aplicación, y los frameworks
de extremo a extremo te piden escribir y mantener las pruebas por tu cuenta. sniff abre tu aplicación
en ejecución en un navegador real, hace clic y rellena campos como lo haría una persona, y juzga lo
que ocurrió de verdad.

- **Encuentra 12 clases de errores**, desde rutas que devuelven HTTP 500 y enlaces rotos hasta datos
  de relleno, botones de envío que no hacen nada, formularios que el botón de retroceso vacía,
  indicadores de carga atascados y desbordamiento en móvil.
- **Prueba cada uno.** Cada hallazgo lleva la ruta y los pasos ordenados que lo produjeron, más la
  captura de pantalla y el fragmento de consola o de red que recogió la comprobación. Sin pasos, no
  hay hallazgo.
- **Está medido.** Sobre una aplicación de prueba con 21 errores plantados que cubren las 12 clases,
  más una página de control limpia, sniff encuentra 21 de 21 y no informa nada en la página de
  control.

## Instalación

El bloque de arriba es la vía para Claude Code, a través del
[mercado 10x](https://github.com/Aboudjem/10x). Para cualquier otro agente, la CLI skills de Vercel
instala esas mismas tres habilidades:

```bash
npx skills add Aboudjem/sniff
```

Para usarlo como una herramienta de línea de comandos, sin ningún editor de por medio:

```bash
npx sniff-qa --url http://localhost:3000
```

El paquete de npm se llama `sniff-qa` y el binario que instala se llama `sniff`. No ejecutes
`npx sniff`, que es un paquete distinto y sin relación.

<details>
<summary>Versión de Node, instalación en el proyecto y CI</summary>

Node.js 22 o superior. `npm install -D sniff-qa` lo añade a las devDependencies de un proyecto, y
`npx sniff-qa ci` escribe un flujo de trabajo de GitHub Actions con caché del navegador y artefactos
de informe.
</details>

## Cómo usarlo

**1. Arranca tu aplicación,** con el servidor de desarrollo que tu proyecto ya use.

```bash
npm run dev
```

**2. Recórrela,** desde una segunda terminal. sniff detecta por su cuenta un servidor de desarrollo
en los puertos habituales, así que `--url` es opcional, pero pasarlo despeja la duda.

```bash
npx sniff-qa --url http://localhost:3000
```

**3. Lee los hallazgos.** Se imprimen agrupados por gravedad. Abajo hay un extracto de una ejecución
real contra la aplicación de prueba con errores plantados de este mismo repositorio, con el comando
`npx sniff-qa --url http://localhost:4321 --ci --max-pages 12`:

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

Añade `--report` para obtener una página HTML autónoma que puedes enviar a alguien. Ejecuta
`npx sniff-qa doctor` si el entorno parece estar mal.

<img alt="How sniff works: crawl, act, assert, prove, report" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/how-it-works.svg" width="100%">

## Qué obtienes

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg">
  <img alt="The 12 classes of bugs sniff finds" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg" width="100%">
</picture>

- **Un informe en la terminal** agrupado por gravedad, cada hallazgo con pasos, una corrección y una
  ruta de captura de pantalla.
- **Un archivo que puedes compartir**, un informe HTML autónomo con `--report` o JSON con `--json`.
- **Un código de salida** distinto de cero cuando los hallazgos alcanzan la gravedad de `--fail-on`,
  para que la integración continua falle ante errores reales.
- **Una etiqueta de confianza** en cada uno. `uncertain` queda oculto en la terminal salvo que pases
  `--all`.

Novedades de la versión 0.8.0:

- `--caps scan,report` reduce el servidor MCP al escaneo de código fuente y a la lectura de
  resultados guardados, sin abrir ni descargar ningún navegador.
- `--storage-state auth.json` recorre una aplicación con sesión iniciada. Los valores de cookies y
  tokens de ese archivo se ocultan en el texto de todos los informes que se escriben, aunque no en los
  píxeles de las capturas de pantalla.
- Un bloque `assert` en `sniff.config` limita los hallazgos por gravedad (`maxCritical`, `maxHigh`,
  `maxTotal`), aplicado en la línea de comandos por el recorrido, el escaneo de código fuente y el
  descubrimiento.

## Funciona en tu editor

Funciona en Claude Code, Cursor, Codex, Copilot, Gemini CLI y más de 70 agentes a través de
`npx skills add`. Las habilidades son Markdown, así que se ejecutan sobre el modelo que apunte tu
editor.

| Agente | Instalación en una línea |
|:--|:--|
| Claude Code | `claude plugin install sniff@10x` |
| Cualquiera de más de 70 agentes | `npx skills add Aboudjem/sniff` |
| Codex, Gemini CLI, OpenCode, Pi | `./install.sh codex` |
| VS Code (Copilot) | `./install.sh copilot` |
| Todo lo demás | ver [docs/editors.md](../docs/editors.md) |

<details>
<summary>Añadirlo como servidor MCP en su lugar</summary>

```bash
claude mcp add sniff-qa npx -- -y sniff-qa --mcp
codex mcp add sniff-qa -- npx -y sniff-qa --mcp
```

Cursor, VS Code, Gemini CLI, Windsurf, Continue, OpenCode y Zed aceptan el mismo comando como una
entrada JSON o TOML. Cada fragmento por editor está en [docs/editors.md](../docs/editors.md).
</details>

## Conviene saber

> [!IMPORTANT]
> Sin clave de API, sin cuenta, sin registro, y sin proveedor de IA salvo que tú configures uno. El
> recorrido y el escaneo nunca editan tu código fuente. `sniff fix` es el único comando que reescribe
> código, y solo cuando tú lo ejecutas.

> [!NOTE]
> Un recorrido hace clic en botones y envía formularios reales, así que puede crear datos reales.
> Apúntalo a una aplicación de desarrollo o de preproducción, no a producción. El primer recorrido
> también descarga una compilación de Chromium y la guarda en caché, así que esa ejecución necesita
> acceso a internet.

- **Quiere una aplicación en ejecución.** Si no hay ningún servidor de desarrollo levantado, recurre
  a un escaneo solo de código fuente y te explica cómo iniciar el recorrido real. `npx sniff-qa scan`
  ejecuta ese escaneo a propósito.
- **La comprobación de enlaces rotos sigue los enlaces externos,** así que un recorrido hace
  peticiones a las URL de terceros que tus propias páginas ya enlazan.
- **Un recorrido que encuentra errores termina con código 1** a propósito, para que la integración
  continua falle. Eso no es un fallo del programa. `--fail-on none` desactiva el umbral de gravedad,
  aunque un presupuesto `assert` todavía puede hacer fallar la ejecución.

## Más información

- [docs/editors.md](../docs/editors.md), instalación y fragmentos MCP para cada agente compatible
- [docs/authenticated-walks.md](../docs/authenticated-walks.md), recorrer una aplicación con sesión iniciada usando `--storage-state`
- [docs/assert-budgets.md](../docs/assert-budgets.md), limitar hallazgos por gravedad en `sniff.config`
- [docs/comparison.md](../docs/comparison.md), en qué se diferencia sniff de linters, comprobadores de enlaces y frameworks E2E
- [docs/faq.md](../docs/faq.md), las preguntas que esta página no responde
- [CHANGELOG.md](../CHANGELOG.md) · [CONTRIBUTING.md](../CONTRIBUTING.md) · [LICENSE](../LICENSE)

---

<p align="center"><sub>Built by <a href="https://github.com/Aboudjem">Adam Boudjemaa</a> · <a href="../LICENSE">Apache 2.0</a> · standing on <a href="https://playwright.dev">Playwright</a> and <a href="https://github.com/dequelabs/axe-core">axe-core</a></sub></p>

<p align="center"><sub>Esta traducción se hizo con ayuda automática. La versión de referencia es el <a href="../README.md">README.md</a> en inglés.</sub></p>
