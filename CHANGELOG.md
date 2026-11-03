# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Changed

- Target DSH 0.2.x (built and verified against 0.2.1-rc.5). The host half needed no
  changes: the Loader surface it drives (`entries()`, `resolve()`, `entry.disabled`,
  `entry.update({disabled})`, `entry.fiber.state`) and the home patch layer
  (`$DSH_HOME/cordis.patch.yml`, "applied over every profile's own layer") are both
  unchanged in 0.2.
- `dsh.client.inject` is now `[]`. It used to list `@deepseek-ai/dsh-client-runtime` and
  `@deepseek-ai/dsh-client-ui-slots`, both removed in 0.2, which silently kept the client
  half from composing (a stale inject name is skipped, not reported). The bundle only
  requires `react` — a module-table seed — and declares `inject = ['slots']` itself.

### Fixed

- `pnpm-workspace.yaml`: added `nodeLinker: hoisted`. On Windows pnpm links packages as
  junctions and Node resolves a package's nested imports from the junction path, so the
  strict layout hid tsdown's own dependencies and `pnpm build` died with
  `Cannot find package 'consola'` on a fresh install.
