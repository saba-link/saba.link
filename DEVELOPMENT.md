# saba-landing — Development Log

**Live URL:** https://saba.link  
**Worker:** `small-tree-9310`  
**Source:** `~/saba-landing/`  
**GitHub:** `github.com/saba-link/saba.link` (git remote konfiguriert, Token `~/.github_token`)

---

## Architektur

```
saba-landing/
├── public/                  ← Statische Assets (via Cloudflare Workers Assets)
│   ├── index.html           ← Hauptseite (saba.link)
│   ├── favicon.svg
│   ├── CV-Dark.pdf / CV-Light.pdf
│   ├── shortcuts/           ← Paula iOS Shortcuts CDN
│   └── blog/
│       ├── blog-common.css  ← ZENTRALES Stylesheet (Blog + share.saba.link!)
│       ├── audio-player.js  ← Wiederverwendbarer Player + Section-Highlighting
│       ├── audio/           ← Generierte MP3s
│       └── *.html           ← Blog-Artikel
└── src/
    └── worker.js            ← Analytics Engine (page_views) + Asset-Passthrough
```

### ⚠️ Wichtig: blog-common.css ist CDN für share.saba.link

`share.saba.link` (Worker `likes-v2-share`) lädt CSS direkt von:
```html
<link rel="stylesheet" href="https://saba.link/blog/blog-common.css">
```
→ **Änderungen an `blog-common.css` wirken sofort auf Blog UND share.saba.link**  
→ Kein separater Deploy des Share-Workers nötig für CSS-Fixes

---

## Deploy

```bash
cd ~/saba-landing

# 1. Änderungen committen
git add -A && git commit -m "Beschreibung"

# 2. Push zu GitHub
git push https://$(cat ~/.github_token)@github.com/saba-link/saba.link.git main

# 3. Deploy (Worker + alle Assets)
CLOUDFLARE_API_TOKEN=$(cat ~/.cloudflare_token) npx wrangler deploy
```

**Hinweis:** Branch ist aktuell divergiert (56 lokale / 6 remote Commits). Vor nächstem Push: `git log --oneline -5` prüfen.

---

## Analytics Engine

**Dataset:** `page_views`  
**Worker-Binding:** `env.ANALYTICS`

| Feld | Inhalt |
|------|--------|
| `blob1` | URL-Pfad (z.B. `/`, `/blog/zero-trust-is-not-a-product`) |
| `blob2` | Land (ISO, z.B. `DE`) |
| `blob3` | Stadt |
| `blob4` | Gerät (`mobile` / `desktop`) |
| `blob5` | Referrer (`direct`, `google`, `twitter`, `linkedin`, `whatsapp`, `telegram`, `other`) |
| `blob6` | Seitentyp (`landing` / `blog` / `cv`) |
| `double1` | Timestamp (unix ms) |

**Assets werden nicht getrackt** — nur HTML-Seiten (`.css`, `.js`, `.svg`, etc. werden gefiltert).

**Beispiel-Queries:**
```sql
-- Meistbesuchte Seiten (letzte 7 Tage)
SELECT blob1 AS page, count() AS views
FROM page_views
WHERE timestamp > now() - interval '7' day
GROUP BY page ORDER BY views DESC

-- Blog vs Landing vs CV Split
SELECT blob6 AS type, count() AS views
FROM page_views GROUP BY type ORDER BY views DESC

-- Woher kommen Besucher?
SELECT blob5 AS source, count() AS views
FROM page_views GROUP BY source ORDER BY views DESC
```

---

## Log

### 2026-02-20
- ✅ Worker mit Analytics Engine (`page_views` Dataset) deployed
- ✅ `wrangler.toml` mit `[[analytics_engine_datasets]]` Binding konfiguriert
- ✅ `.gitignore` hinzugefügt (`node_modules/`, `.wrangler/`)
- ✅ Push zu GitHub
- ✅ **Sun icon unified** — kanonischer SVG-Pfad in `index.html` + alle 9 Blog-Artikel korrigiert
  - Alter Pfad Hauptseite: `M12 17a5 5 0 1 0...` (ohne diagonale Strahlen)
  - Alter Pfad Blog: `M12 7c-2.76 0-5 2.24...` (rundes Icon ohne diagonale Strahlen)
  - Neuer Pfad überall: `M6.76 4.84l-1.8-1.79...` (mit 8 diagonalen Strahlen — wie share.saba.link)
- ✅ **Spin-Animation in `blog-common.css`** — zentral für Blog + share.saba.link:
  ```css
  .theme-toggle:hover { transform: scale(1.1); }
  .theme-toggle svg { transition: transform 0.3s ease; }
  .theme-toggle:hover svg { transform: rotate(15deg); }
  ```
- ✅ Committed (nicht gepusht — divergierter Branch, Push ausstehend)

---

## Blog-Artikel

| Artikel | Audio | Dauer |
|---------|-------|-------|
| zero-trust-is-not-a-product | ✅ | ~7.7 min |
| startup-funding-explained | ✅ | ~7.7 min |
| understanding-your-equity-offer | ✅ | ~9.8 min |
| notes-on-being-a-sales-engineer | ❌ | — |
| vpn-is-not-dead | ❌ | — |
| the-poc-trap | ❌ | — |
| why-i-left-after-8-years | ❌ | — |
| startup-funding-explained-v2 | ❌ | — |

---

## Offene Punkte

- [ ] GitHub Push (divergierter Branch — `git push --force` oder Rebase nötig)
- [ ] Audio für neuere Blog-Artikel (notes-on-being-a-sales-engineer, vpn-is-not-dead, etc.)
- [ ] Homepage Card-Styles: aktuell inline-Styles → in `blog-common.css` migrieren (niedrige Prio)
