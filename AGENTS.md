# AGENTS.md

## Project overview

This is a Node.js + TypeScript project. Keep changes small, explicit, and easy to review.

## Setup commands

```bash
npm install
```

## Common commands

```bash
npm run dev
npm run build
npm test
npm run lint
npm run typecheck
npm run check
```

## Before committing

Always run:

```bash
npm run check
```

Do not claim the project passes checks unless the command has actually been run successfully.

## Code style

* Use TypeScript.
* Use React + Tailwind for frontend.
* Prefer explicit types at public boundaries.
* Keep runtime code simple and boring.
* Avoid unnecessary dependencies.
* Prefer named exports unless the project already uses default exports.
* Do not mix formatting styles; follow Prettier.
* Do not silently rewrite unrelated code.

## File and folder conventions

* Vite + React frontend source code lives in `apps/client/src/`.
* Node.js backend/service source code lives in `apps/server/src/`.
* Shared types/utilities source code lives in `packages/shared/src/`.
* Tests live in `apps/server/test/`, `packages/shared/test/` or next to the file being tested as `*.test.ts`.
* Project scripts live in `scripts/`.
* Architecture notes live in `docs/adr/`.

## Dependency rules

* Do not add dependencies unless they clearly reduce complexity.
* Prefer built-in Node.js APIs when reasonable.
* If adding a dependency, explain why it is needed.

## Safety rules

* Never commit secrets, tokens, passwords, certificates, or `.env` files.
* Keep `.env.example` updated when environment variables change.
* Do not remove tests or checks just to make CI pass.

## Git rules

* Keep commits focused.
* Do not include generated build output unless the project explicitly requires it.
* If behavior changes, update the README or docs.
