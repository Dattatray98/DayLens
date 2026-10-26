# Daylens

**See your life more clearly.**

Daylens is a personal wellness and planning workspace for tracking money, nutrition, wellness metrics, notes, and reports. It is built as a frontend application and stores data locally on the device; it does not use an application backend or cloud account service.

## Features

- **Overview** — a dashboard for a quick view of recent activity and key summaries.
- **Money** — record income and expenses, organize them by category, and review balances and cash flow.
- **Diet** — save foods, log meals, and review nutrition against daily targets.
- **Notes** — create, edit, search, and organize personal text notes.
- **Reports** — review trends and summaries derived from available local records.
- **Wellness metrics** — track measurements and review historical entries.
- **Local accounts** — register and sign in within the app.

The exact data available in summaries and reports depends on the records entered on the device.

## Technology

- React and TypeScript
- Vite
- Tailwind CSS
- React Router
- SQLite through `@capacitor-community/sqlite`
- Capacitor for native Android and iOS app shells

For web use, the SQLite database is persisted through the browser storage integration. Native builds use the Capacitor SQLite plugin. Local authentication is intended for this device-based application and is not server-managed authentication.

## Requirements

- Node.js and npm
- Dependencies installed from the project lockfile

## Getting started

Install dependencies and start the local development server from `ClientApplication`:

```sh
cd ClientApplication
npm install
npm run dev
```

Vite prints the local development URL in the terminal.

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Run TypeScript project builds and create the production bundle in `dist/`. |
| `npm run preview` | Serve the production bundle locally for review. |
| `npm run lint` | Run ESLint across the project. |

## Production build

```sh
cd ClientApplication
npm run build
npm run preview
```

## Data and privacy

Application records are intended to remain on the device using local SQLite storage. Web persistence uses browser storage, so data is associated with the browser profile and can be affected by clearing site data or removing that profile. There is no cloud synchronization or server-side account recovery. Keep your device and its browser or app data protected.

Because authentication is local-only, it provides convenience within this prototype rather than the guarantees of a server-managed identity system.

## Project layout

```text
ClientApplication/
  src/
    Components/     Shared UI, startup, and model setup components
    database/       Database setup and wellness data repositories
    features/       Authentication, Diet, Money, Notes, and Reports
    pages/          Overview, settings, and other application pages
    tools/          Assistant tools and intent handling
    App.tsx         Application routes and shared shell
    index.css       Global styles and design system
  package.json      App scripts and dependencies
  vite.config.ts    Vite configuration
android/            Native Android project
```

## License

See [LICENSE](LICENSE).
