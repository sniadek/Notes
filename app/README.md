# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

## Installing the built macOS app on another Mac

The macOS build produced by [`deploy_macos_app.yml`](../.github/workflows/deploy_macos_app.yml) is only ad-hoc signed (no Apple Developer ID / notarization). Downloading `Notes.app` (or the `.dmg`) via a browser — e.g. from a GitHub Actions artifact — stamps it with a quarantine flag, and Gatekeeper then refuses to open it with a **"Notes is damaged and can't be opened"** message. This is not real corruption — Gatekeeper just doesn't trust an ad-hoc signature once quarantined.

Fix it by running, after downloading:

```bash
../scripts/install-macos-app.sh ~/Downloads/Notes.app
```

This clears the quarantine attribute, re-applies an ad-hoc code signature, and installs the app to `/Applications`. Run it again any time you move the app to a new Mac.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
