# LifeTrack Hub

All-in-one student productivity suite: tasks (NLP quick-add, Kanban, Eisenhower matrix, Pomodoro), habits with scoring, finances, exam planning, daily life metrics (mood/energy/sleep), AI-powered insights (Gemini), and a VTU academics hub — syncing across **Web (React)**, **Android**, and **Windows Desktop** (Kotlin Multiplatform) via a local-first architecture with Hybrid Logical Clock (HLC) event-sourced sync over Cloud Firestore.

> **Project status (honest matrix):**
>
> | Surface | State |
> |---|---|
> | Web app (React + Express + Firestore) | ✅ Works; local-first with cloud sync for signed-in users |
> | Server AI proxy (Gemini) | ✅ Works with graceful offline fallbacks (`GEMINI_API_KEY` optional) |
> | KMP shared sync engine (HLC, outbox, LWW) | ✅ Unit-tested on JVM/Desktop targets |
> | Android app | 🟡 Compiles after CI fix; requires `ANDROID_APPLICATION_ID` (see below) for full Firebase services |
> | Desktop app | 🟡 Email/password auth via Identity Toolkit REST; runs on JVM |
> | Cross-platform sync | 🟡 Unified on one Firebase project (Phase 0 fix); E2EE **not** implemented — see `ENCRYPTION_BOUNDARY.md` |

## Architecture

```
┌───────────────────────────────┐   ┌──────────────────────────────┐
│  Web (React 19 + Vite + TW4)  │   │  KMP (Compose Multiplatform) │
│  src/  ──►  Express server.ts │   │  androidApp/  desktopApp/    │
│            └─ /api (Gemini    │   │  shared/ (HLC sync engine,   │
│               proxy + fallback│   │   SQLite local-first store)  │
│               heuristics)     │   │                              │
└──────────────┬────────────────┘   └──────────────┬───────────────┘
               │ Firebase JS SDK                   │ Firestore SDK / REST
               ▼                                   ▼
        ┌─────────────────────────────────────────────────┐
        │  Cloud Firestore — ONE project (see config map) │
        │  /users/{uid}            web full-state doc     │
        │  /users/{uid}/deltas/…   KMP immutable event    │
        │                          stream (HLC-ordered)   │
        │  /users/{uid}/syncState/… per-device checkpoints│
        └─────────────────────────────────────────────────┘
```

**Single source of truth for Firebase config** (all must point at the SAME project):

| File | Used by |
|---|---|
| `firebase-applet-config.json` | Web app |
| `shared/.../sync/FirebaseConfig.kt` | Android + Desktop (KMP) |
| `.firebaserc` | `firebase deploy` (rules + indexes) |

## Getting started (Web)

```bash
npm ci                 # requires Node >= 20.19 (22 LTS recommended)
cp .env.example .env   # optionally set GEMINI_API_KEY, GEMINI_MODEL, PORT
npm run dev            # Express + Vite middleware on http://localhost:3000
```

Without `GEMINI_API_KEY` every AI endpoint degrades to deterministic heuristic fallbacks (and responses are flagged `isFallbackTemplate`).

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server (Express + Vite middleware) |
| `npm run build` | Production web bundle (`dist/`) + server bundle (`dist/server.cjs`) |
| `npm start` | Run production server (honors `PORT`) |
| `npm run lint` | TypeScript strict typecheck |
| `npm test` | All suites: jsdom UI workflows + API router robustness + rules integrity |
| `npm run test:firebase` | Real Firestore **emulator** rules tests (needs `firebase-tools` + Java) |

## Getting started (KMP: Android / Desktop)

```bash
./gradlew :shared:desktopTest        # JVM unit tests (no Android SDK needed at runtime,
                                     # but AGP configuration requires an SDK present)
./gradlew :androidApp:assembleDebug  # Android APK
./gradlew :desktopApp:run            # Compose Desktop app
```

**One-time Android setup:** register an Android app with package id `com.lifetrack.android`
in the Firebase Console for the unified project, then set
`FirebaseConfig.ANDROID_APPLICATION_ID` in
`shared/src/commonMain/kotlin/com/lifetrack/sync/FirebaseConfig.kt`.
(The `google-services` Gradle plugin is intentionally **not** applied — Firebase is
initialized programmatically — so no `google-services.json` is required to build.)

## Deploying Firestore rules & indexes

```bash
npm i -g firebase-tools
firebase login
firebase deploy --only firestore:rules,firestore:indexes
```

`.firebaserc` must match the project in `firebase-applet-config.json`, otherwise the
web app runs against unverified rules.

## Testing

- `test/browser_ui_workflows.test.ts` — real React rendering in jsdom (task create/complete, command palette, modals, navigation).
- `test/api_router_robustness.test.ts` — API input validation, crash resilience, rate limiting, finance heuristics.
- `test/firestore.rules.emulator.test.ts` — rules file integrity checks (string-level; run `test:firebase` for semantic emulator tests).
- `shared/src/commonTest` + `desktopTest` — 13 KMP suites: HLC ordering/pagination, outbox/checkpoints, local-first survival, repository logic, JSON round-trips.

## Security model

- Firestore rules: default-deny; owner-scoped; sync deltas are **immutable** (no update/delete) and schema-validated; see `firestore.rules`.
- Gemini API key lives **server-side only**; client AI features proxy through `/api/*` with per-IP rate limiting.
- Encryption boundary and E2EE roadmap: `ENCRYPTION_BOUNDARY.md` (E2EE is **not** implemented yet — payloads are plaintext JSON in transit-encrypted TLS storage).
- Client API keys are public by design but must be domain-restricted in Google Cloud Console.

## Known limitations / roadmap

See `docs/ANALYSIS.md` (deep repo audit) — highlights: unify web sync onto the per-entity delta protocol (currently the web client writes one full-state document), replace the string-matching rules test with `@firebase/rules-unit-testing`, migrate web tests to vitest, split oversized components (`VtuSyncSection.tsx`), VTU "rankings" are simulated heuristics (labeled as such), upgrade KMP toolchain to Kotlin 2.x.

## License

MIT — see [LICENSE](./LICENSE).
