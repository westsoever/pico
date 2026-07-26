# pico

App to create a Vivino clone that works for coffee.

**Live site:** https://westsoever.github.io/pico/

## Development

```bash
npm install
npm run dev
```

## Submodule setup

Use this repo as a submodule in a parent repository (for example at `02-Projects/pico`):

```bash
# In the parent repo
git pull origin main
git submodule update --init --recursive

cd 02-Projects/pico
git fetch origin
git checkout main
git pull origin main
cd ../..

git add 02-Projects/pico
git commit -m "Sync pico submodule with remote"
git push origin main
```

### First-time add

If the submodule is not configured yet:

```bash
git submodule add https://github.com/westsoever/pico.git 02-Projects/pico
git commit -m "Add pico submodule"
git push origin main
```

### Clone with submodules

```bash
git clone --recurse-submodules <parent-repo-url>
# or after a regular clone:
git submodule update --init --recursive
```

## Current main commit

The parent repo should track `main` on `https://github.com/westsoever/pico.git`. If a local submodule points at a commit that is not on GitHub, sync the submodule directory to `origin/main` and commit the updated pointer in the parent repo.
