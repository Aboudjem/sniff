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

<p align="center"><a href="../README.md">English</a> · <a href="zh-CN.md">简体中文</a> · <a href="ja.md">日本語</a> · <b>Español</b> · <a href="fr.md">Français</a></p>

<p align="center"><b>Detecta lo que está roto en tu aplicación web antes que tus usuarios.</b></p>

<p align="center"><a href="#qué-obtienes">Qué obtienes</a> · <a href="#instalación">Instalación</a> · <a href="#cómo-funciona">Cómo funciona</a> · <a href="#compatibilidad">Compatibilidad</a> · <a href="#pruebas">Pruebas</a> · <a href="#preguntas-frecuentes">Preguntas frecuentes</a> · <a href="#límites">Límites</a></p>

```bash
npx sniff-qa --url http://localhost:3000
```

## Qué obtienes

Un informe que empieza con el veredicto, luego las tres cosas que corregir primero y luego cada hallazgo.
Este es el informe de una ejecución real sobre la aplicación de prueba con bugs sembrados de este repositorio (2026-11-17, sniff 0.9.3).

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

Cambiaste un formulario y ahora una página que nunca abriste devuelve un error 500.
sniff abre tu aplicación en un navegador real y la recorre como lo haría un usuario.
Cada bug de página que reporta viene con los pasos que lo reproducen.

### Por qué usarlo

- **Corrígelo, no lo busques.** Cada hallazgo de página indica la ruta, los pasos y una corrección, la mayoría con una captura de pantalla.
- **Prueba de que encuentra bugs reales.** Probado con bugs sembrados a propósito: 21 de 21 encontrados, 0 hallazgos falsos en la página limpia (`npm run build && npm run proof`).
- **Bloquea los merges malos.** `--fail-on` sale con 1 ante hallazgos críticos o altos, y `npx sniff-qa ci` escribe el archivo de GitHub Actions. Sin clave de API.

Necesita tu aplicación en marcha y envía formularios reales, así que usa una aplicación de desarrollo o de staging.
El primer recorrido descarga una vez el motor de navegación y Chromium.
Son unos 440 MB de descarga y unos 730 MB en disco, medidos en un Mac.

Para reproducir el ejemplo desde un clon, inicia la aplicación de prueba y recórrela desde una segunda terminal:

```bash
node sniff-tests/planted-bugs/server.mjs 4517
npx sniff-qa --url http://localhost:4517
```

<img alt="sniff walking a buggy app and streaming findings with severity, confidence, steps to reproduce, and a fix" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/demo.gif" width="100%">

## Instalación

Node.js 22 o posterior. Elige una vía.

**Línea de comandos, sin editor.** Inicia tu aplicación y recórrela desde una segunda terminal:

```bash
npx sniff-qa --url http://localhost:3000
```

El paquete npm es `sniff-qa`. No ejecutes `npx sniff`: es un paquete sin relación.

**Plugin de Claude Code**, a través del [marketplace 10x](https://github.com/Aboudjem/10x):

```bash
claude plugin marketplace add Aboudjem/10x
claude plugin install sniff@10x
```

**Skills para cualquier agente**, a través de la CLI de skills de Vercel:

```bash
npx skills add Aboudjem/sniff
```

**Servidor MCP**, para cualquier cliente MCP:

```bash
claude mcp add sniff-qa -- npx -y sniff-qa --mcp
```

El primer recorrido descarga dos cosas, una sola vez: el motor de navegación (Playwright, axe-core y
Lighthouse) y Chromium. Para hacerlo por adelantado, ejecuta:

```bash
npx sniff-qa install
```

Termina mostrando el tiempo que tardó. En un Mac con las cachés vacías mostró 43 s (2026-11-17, sniff 0.9.3).
Descargó unos 440 MB. Dejó 193 MB de motor y 530 MB de Chromium en disco.
Los tamaños varían según la plataforma. Para volver a medirlo en macOS:

```bash
du -sm ~/.cache/sniff-qa/engine/* ~/Library/Caches/ms-playwright
```

`npx sniff-qa doctor` comprueba Node, el navegador y tu servidor de desarrollo.

El servidor MCP arranca antes de esas descargas. Con la caché de npm vacía, `npx -y sniff-qa@0.9.1 --mcp`
respondió a su primer handshake en 3,1 a 4,9 s (5 ejecuciones, 2026-11-17). La versión 0.9.0 tardaba de 37 a 93 s,
más allá del límite de conexión de 30 s de Claude Code. Para volver a medirlo, en un clon de este repositorio:

```bash
npm run cold-start -- 0.9.1 5
```

Un recorrido muestra líneas de progreso y luego el informe. Puedes obtener el resultado de cuatro formas:

| Salida                 | Opción        | Para qué sirve                               |
| :--------------------- | :------------ | :------------------------------------------- |
| Informe en la terminal | (por defecto) | Leer el resultado ahora                      |
| Página HTML            | `--report`    | Enviarlo a alguien, un solo archivo autónomo |
| JSON                   | `--json`      | Scripts y otras herramientas                 |
| Código de salida       | `--fail-on`   | Hacer fallar la CI con bugs reales           |

| Código de salida | Significado                                                                            |
| :--------------- | :------------------------------------------------------------------------------------- |
| `0`              | Ningún hallazgo alcanzó las severidades de `--fail-on` (por defecto: crítica y alta)   |
| `1`              | Un hallazgo las alcanzó, se superó un presupuesto `assert`, o sniff no pudo ejecutarse |

<details>
<summary>Instalación en el proyecto y CI</summary>

`npm install -D sniff-qa` lo añade a un proyecto. `npx sniff-qa ci` escribe un workflow de GitHub Actions
con caché del navegador y artefactos de informe. Sin una aplicación en marcha, su primera ejecución solo lee tu código.
Quita el comentario de su paso `Start the app` y añade `--url` para recorrer la aplicación.
</details>

## Cómo funciona

<img alt="How sniff works: crawl, act, assert, prove, report" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/how-it-works.svg" width="100%">

1. **Encontrar la aplicación.** Usa `--url`, o un servidor de desarrollo en un puerto habitual.
2. **Recorrerla.** Un Chromium sin interfaz sigue tus enlaces, pulsa botones y rellena formularios, como un usuario.
3. **Juzgar lo que pasó.** Cada página se revisa en busca de 12 clases de bugs.
4. **Demostrarlo.** Un hallazgo necesita una ruta y los pasos. Añade una captura y las líneas de consola o de red cuando las tiene.
5. **Informar.** Primero el veredicto, luego la lista de lo que corregir primero, luego el detalle.

Las 12 clases:

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg">
  <img alt="The 12 classes of bugs sniff finds" src="https://raw.githubusercontent.com/Aboudjem/sniff/main/.github/assets/features-light.svg" width="100%">
</picture>

Sin una aplicación en marcha, `sniff` lee tu código fuente en su lugar (`sniff scan`). Señala sentencias de depuración,
texto provisional e imports rotos, y te dice cómo iniciar el recorrido real.

El servidor MCP expone estas herramientas:

| Herramienta      | Qué hace                                                         |
| :--------------- | :--------------------------------------------------------------- |
| `sniff`          | Un único punto de entrada: `mode: "walk"`, `"scan"` o `"report"` |
| `sniff_scan`     | Análisis solo del código fuente, sin navegador                   |
| `sniff_run`      | Análisis del código fuente más comprobaciones en el navegador    |
| `sniff_discover` | Genera escenarios a partir de tu código fuente y los ejecuta     |
| `sniff_install`  | Descarga el motor y Chromium, con progreso                       |
| `sniff_report`   | Lee los últimos resultados guardados                             |

`--caps scan,report` limita el servidor a `sniff_scan`, `sniff_report` y la herramienta unificada `sniff`, sin ningún navegador.

## Compatibilidad

Cada fila se probó el 2026-11-17 con la build de sniff 0.9.0.

| Agente                | Qué se ejecutó                                                                             | Probado    |
| :-------------------- | :----------------------------------------------------------------------------------------- | :--------- |
| Claude Code           | `claude -p` con sniff como servidor MCP llamó a `sniff_scan` y leyó 2 hallazgos            | 2026-11-17 |
| Codex CLI             | `codex exec` con sniff como servidor MCP llamó a `sniff_scan` y leyó 2 hallazgos           | 2026-11-17 |
| Gemini CLI            | `gemini extensions validate .` aceptó `gemini-extension.json`                              | 2026-11-17 |
| Cualquier cliente MCP | `node sniff-tests/mcp-smoke.mjs` listó 6 herramientas y un recorrido devolvió 20 hallazgos | 2026-11-17 |
| CLI de skills         | `npx skills@1.9.0 add Aboudjem/sniff` instaló las 3 skills en una carpeta temporal         | 2026-11-17 |

Documentados, no probados hoy: Cursor, VS Code con Copilot, Windsurf, OpenCode y Zed.
Sus fragmentos están en [docs/editors.md](../docs/editors.md).

## Pruebas

Tres comandos vuelven a mostrar las cifras de esta página. El primero muestra la puntuación sobre la aplicación de prueba.

```bash
npm run build && npm run proof
```

Inicia la aplicación de prueba con bugs sembrados, la recorre y puntúa el informe. Salida del 2026-11-17:

```text
  Recall:    21/21  (100%)
  Findings:  27 deduped (27 raw)
  Matched:   27   Candidate FP: 0   Precision proxy: 100%
  Hard FP on clean page (/clean): 0
```

El ejemplo de arriba muestra 26 hallazgos y dice que hay 1 hallazgo de baja confianza oculto. La ejecución de prueba usa `--all`, así que cuenta los 27.

La aplicación de prueba contiene 21 bugs sembrados en las 12 clases, más una página de control limpia.
El evaluador es [sniff-tests/score-fixture.mjs](../sniff-tests/score-fixture.mjs).
Los bugs están listados en [sniff-tests/planted-bugs/MANIFEST.json](../sniff-tests/planted-bugs/MANIFEST.json).

```bash
npm test
```

Muestra `Test Files  54 passed (54)` y `Tests  603 passed (603)` el 2026-11-17.
La suite incluye el control sobre la aplicación de prueba. Hace fallar la build si el recall baja del 85 %.
También falla ante cualquier hallazgo en la página limpia.

```bash
node sniff-tests/mcp-smoke.mjs
```

Muestra las 6 herramientas MCP y los 20 hallazgos citados en la tabla de arriba.

## Preguntas frecuentes

**¿Necesito una clave de API o una cuenta?**
No. El recorrido y el análisis del código fuente se ejecutan en tu máquina. No se envía nada a ningún sitio salvo que configures tú mismo la exploración opcional con IA.

**¿Un recorrido cambiará datos de mi aplicación?**
Puede. Un recorrido pulsa botones y envía formularios reales, así que apúntalo a una aplicación de desarrollo o de staging.

**¿Por qué salió con 1 si nada falló?**
Salir con 1 significa que encontró bugs con una severidad que hace fallar, así que la CI rompe la build. Pasa `--fail-on none` para salir siempre con 0.

**¿Editará mi código?**
No. Recorrer y analizar nunca tocan tu código fuente. Solo `sniff fix` edita archivos, y solo cuando lo ejecutas.

**¿Puede recorrer una aplicación con sesión iniciada?**
Sí. Pasa `--storage-state auth.json`. Los valores de cookies y tokens de ese archivo se ocultan en los informes escritos.

Hay más respuestas en [docs/faq.md](../docs/faq.md).

## Límites

- El recorrido necesita una aplicación en marcha. Sin ella solo obtienes el análisis del código fuente.
- El primer recorrido necesita internet para descargar una vez el motor y Chromium: unos 440 MB, luego unos 730 MB en disco en un Mac.
- Hasta entonces, las herramientas MCP de navegador responden `needsSetup` y el agente llama primero a `sniff_install`.
- La comprobación de enlaces rotos sigue los enlaces externos, así que un recorrido consulta las URL de terceros a las que enlazan tus páginas.
- La ocultación cubre el texto de los informes, no los píxeles de las capturas. Una captura de una página con sesión iniciada puede mostrar datos privados.
- Encuentra lo que vería un usuario. No lee los logs de tu servidor ni mide la carga.

## Más información

- [docs/editors.md](../docs/editors.md): instalación y fragmentos MCP para cada agente
- [docs/authenticated-walks.md](../docs/authenticated-walks.md): recorrer una aplicación con sesión iniciada
- [docs/assert-budgets.md](../docs/assert-budgets.md): limitar los hallazgos por severidad en `sniff.config`
- [docs/comparison.md](../docs/comparison.md): en qué se diferencia sniff de los linters y los frameworks E2E
- [CHANGELOG.md](../CHANGELOG.md) · [CONTRIBUTING.md](../CONTRIBUTING.md) · [LICENSE](../LICENSE)

---

<p align="center"><sub>Built by <a href="https://github.com/Aboudjem">Adam Boudjemaa</a> · <a href="../LICENSE">Apache 2.0</a> · built on <a href="https://playwright.dev">Playwright</a> and <a href="https://github.com/dequelabs/axe-core">axe-core</a></sub></p>

<p align="center"><sub>Esta traducción se hizo con ayuda automática. La versión de referencia es el <a href="../README.md">README.md</a> en inglés.</sub></p>
