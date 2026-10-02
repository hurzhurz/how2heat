# how2heat

> Finally solving one of humanity's greatest unsolved problems:
> the package says **"600 W for 3 minutes"** — but your microwave only
> offers 10%, 30%, 50%, 80% and 100%.

Civilisation gave us nuclear fission, the internet, and large language
models — yet nobody could tell us how long to microwave a lasagne at 80%.
Until now.

**[how2heat.it](https://how2heat.it)** · heat it. properly.

![lasagne-tested](https://img.shields.io/badge/lasagne-tested-orange)
![PWA](https://img.shields.io/badge/PWA-installable-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

## What is this?

A tiny, installable web app (PWA) that converts the power/time instructions
on frozen food packages to the actual power levels of *your* microwave —
and rounds the result to the time steps your microwave can actually be set to.

No accounts, no tracking, no backend. Everything runs in your browser and
persists locally.

Full disclosure: this is a hobby side project — mainly built to put local
LLMs to the test on a real (if deliciously trivial) problem. No models were
harmed, and the lasagne turned out fine.

## Why?

Because `600 W · 3 min` is useless information if your microwave only has
five power levels, and because guessing "eh, 2 minutes at full power"
leads to either a cold core or a lava-hot rim.

## How it works

1. Enter the recommended power and time from the package.
2. For every power level of your device, the app computes the exact
   conversion time via energy conservation:

   ```
   t₂ = t₁ × P₁ / P₂
   ```

3. The time is rounded **up** to the step grid your microwave supports
   (e.g. 5 s below 1 min, 10 s below 5 min, 30 s above).
4. The level whose *actual delivered energy* (P₂ × t₂-snapped) is closest
   to the target energy wins. Ties are broken by a configurable rule
   (lower power / higher power / shorter time).
5. All levels are shown with their deviation, so you can override manually.

Power levels can be defined either in **percent** (as on most microwaves)
or in **watts** (if your microwave displays actual wattage per level) —
switchable per device in the settings, existing levels are converted
automatically.

Everything (device levels, timing grid, presets) is configurable and can be
exported/imported as JSON.

## Languages

English, Deutsch, Français, Español, Italiano, Nederlands, Polski —
auto-detected from your browser, switchable in the settings.

## Self-hosting

Static files only. Any web server works:

```sh
python3 -m http.server 8000
```

### GitHub Pages + custom domain

1. Push this repo to GitHub.
2. Repo → Settings → Pages → **Source: GitHub Actions**.
3. Create a **release** (or run the workflow manually) to deploy —
   the included workflow deploys on every published release.

   ```sh
   git tag v1.0 && git push --tags
   gh release create v1.0 --title "v1.0" --notes "first release"
   ```
4. Point your domain at GitHub Pages:

   ```
   A      @      185.199.108.153
   A      @      185.199.109.153
   A      @      185.199.110.153
   A      @      185.199.111.153
   ```

5. The `CNAME` file handles the domain; enable "Enforce HTTPS" in Settings.

## Development

No build step, no dependencies. Files:

```
index.html     Calculator page
settings.html  Settings page (opened via the gear icon)
state.js       Shared state model (devices, timing, presets, validation)
app.js         Conversion logic + calculator rendering
settings.js    Settings page logic
i18n.js        translations (7 languages) + t() helper
style.css      mobile-first theme (dark/light)
sw.js          Service worker (cache-first offline)
```

The service worker cache name (`how2heat-vX` in `sw.js`) must be bumped
whenever assets change, otherwise installed PWAs keep the old version.

## FAQ

**Why not just use 100% and guess?**
Because chaos is a ladder.

**Is the physics exact?**
It assumes energy scales linearly with the power setting — good enough
for lasagne, not for nuclear engineering.

## License

MIT — see [LICENSE](LICENSE).
