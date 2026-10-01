# Upstream submodule

This repo vendors Temporal Web UI as a git submodule at `upstream/`, pinned to a release tag (currently `v2.54.1`). Never edit files under `upstream/`.

Packaging stages under `.build/` and installs the develop toolchain at the **repo root** ([ADR 0004](./docs/adr/0004-derived-deps-kit-root.md)). The submodule is never written by the Adapter build.

Root pins shared with Upstream (`.npmrc`, `.node-version`, `.editorconfig`, adapted `.tool-versions`, derived `package.json`) are maintained by `pnpm sync:upstream`. Policy: [docs/upstream-dotfiles.md](./docs/upstream-dotfiles.md).

## Bump Upstream

```sh
cd upstream
git fetch --tags origin
git checkout vX.Y.Z
cd ..
git add upstream
pnpm sync:upstream          # package.json + shared dotfiles
pnpm install
git add package.json pnpm-lock.yaml .npmrc .node-version .editorconfig .tool-versions
git commit -m "chore: bump upstream to vX.Y.Z"
```

Then cut a Release at Package version `X.Y.Z-fb.0` (or bump `-fb.n` if the pin is unchanged).
