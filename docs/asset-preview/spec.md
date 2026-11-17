# Náhled assetů: specifikace

Plán práce je v [plan.md](plan.md). User stories se tím nemění.

## Proč

Na stránce assetu je teď jen dekorace (barevné tvary a první písmeno názvu). `previewUrl` je vždy `null`.
Uživatel tak neví, co stahuje.

Chceme, aby šlo **přímo na webu**:
- otočit 3D model myší;
- poslechnout zvuk;
- vidět obrázek.

## Co uživatel uvidí

| Soubor assetu | Na stránce assetu | V kartě katalogu |
|---|---|---|
| `png`, `jpg`, `jpeg`, `webp`, `gif` | obrázek (celý, `object-fit: contain`) | obrázek, jen do 5 MB |
| `glb`, `gltf` | 3D prohlížeč: otáčení myší / prstem, zoom, pomalá automatická rotace | dekorace jako teď |
| `wav`, `mp3`, `ogg`, `flac` | dekorace + přehrávač zvuku | dekorace jako teď |
| ostatní (`fbx`, `obj`, `blend`, `zip`, `tmx`, …) | dekorace jako teď + věta „No preview for this file type yet.“ (UI je anglicky) | dekorace jako teď |

**3D model větší než 20 MB** se nenačte sám. Uživatel uvidí tlačítko „Load 3D preview (xx MB)“, aby mobil
nestahoval 100 MB jen otevřením stránky.

## Backend: `GET /api/assets/:id/file`

Nový endpoint v catalogu, **jen pro zobrazení v prohlížeči**. Stahování dál jde jen přes `/download`.

| Endpoint | Pro co | `downloadCount` | Hlavička |
|---|---|---|---|
| `GET /api/assets/:id/download` | stáhnout soubor | **+1** | `Content-Disposition: attachment` |
| `GET /api/assets/:id/file` | náhled na webu | **beze změny** | `Content-Disposition: inline` |

Pravidla:

1. **Jen formáty z tabulky výše** (podle přípony `fileName`). Ostatní formáty → **404**
   `This file type has no preview`. Neexistující asset → **404** `Asset not found`, chybějící soubor v S3 → **404**,
   jiná chyba S3 → **502** (stejně jako `/download`).
2. **`Content-Type` podle přípony** z pevné tabulky, ne z `contentType` od uživatele. Prohlížeč tak nikdy nedostane
   `text/html` nebo `image/svg+xml` (SVG ani HTML na whitelistu nejsou).
3. **Bezpečnostní hlavičky:**
   - `X-Content-Type-Options: nosniff`;
   - `Content-Security-Policy: default-src 'none'; sandbox`. Soubor otevřený přímo v okně nemůže spustit skript,
     obrázky a média se zobrazí normálně.
4. **Range požadavky** (`Accept-Ranges: bytes`, odpověď **206** + `Content-Range`, nesplnitelný rozsah → **416**).
   Potřebuje je přehrávač zvuku na přetáčení a Safari pro audio vůbec. Rozsah se předá do S3 (`GetObject` s `Range`),
   takže server nikdy nedrží celý soubor v paměti.
5. **Cache:** `Cache-Control: private, max-age=3600`. Soubor assetu se po nahrání nemění (`PUT` mění jen název
   a popis). `private` proto, že web může běžet za `SITE_AUTH`.
6. **Žádný audit log ani počítadlo:** jen čtení.

`AssetView.previewUrl`: pro obrázky do 5 MB `"/api/assets/<id>/file"`, jinak `null`. Karty v katalogu
(PR #26 už `previewUrl` vykresluje) tak ukážou skutečný obrázek bez dalšího kódu ve frontendu.

## Frontend

- Komponenta **`AssetPreview`** v `detail-cover` na stránce assetu, podle přípony `fileName`:
  - **obrázek:** `<img>`;
  - **3D:** [`<model-viewer>`](https://modelviewer.dev) (Google, web component nad three.js) s `camera-controls`,
    `auto-rotate` a `touch-action="pan-y"` (svislý posun stránky na mobilu dál funguje);
  - **zvuk:** `<audio controls preload="metadata">`;
  - **ostatní:** dnešní dekorace.
- **`model-viewer` se načítá líně** (`import()`), jen na stránce 3D assetu. Katalog a ostatní stránky
  nestahují nic navíc.
- Stav načítání („Loading 3D model…“) a chyba (poškozený soubor) → dekorace + krátká hláška, stránka nespadne.
- Při prázdné odpovědi nebo chybě obrázku (`onError`) → dekorace.

## Mimo rozsah (později)

- **Další 3D formáty:**
  - `fbx`, `obj`, `stl`, `dae` přes loadery three.js;
  - `obj` potřebuje i `.mtl`, který je v jiném souboru.
- **Vlastní preview obrázek** nahraný autorem (pole `preview` ve formuláři, backend zatím neumí).
- **Generování náhledů na serveru** (miniatury, `blend` → obrázek).
- **Waveform zvuku.**

## Rizika

| Riziko | Opatření |
|---|---|
| XSS přes nahraný soubor | Whitelist přípon bez SVG/HTML, `Content-Type` z tabulky, `nosniff`, CSP `sandbox`. |
| Velké soubory | 3D nad 20 MB jen na tlačítko. Obrázky v kartách jen do 5 MB. Range pro audio. |
| Velikost bundle | `model-viewer` (~1 MB) jen v samostatném chunku pro 3D stránku. |
| Náklady S3 | Náhled = stejné čtení jako stažení. Cache 1 h v prohlížeči. Při naší návštěvnosti zanedbatelné. |
