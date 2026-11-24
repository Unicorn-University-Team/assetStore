# Náhled assetů: plán práce

Podle [spec.md](spec.md). Větev `feature/asset-preview`, PR česky, merguje Yura.

## Krok 1: backend `GET /api/assets/:id/file`

- [x] Tabulka náhledových přípon → `Content-Type` (`services/catalog/src/utils/preview.ts`).
- [x] `FileStorage.download(key, range?)`: rozsah do S3 `GetObject`.
- [x] Controller `preview`:
  - 404 pro formát bez náhledu;
  - 404/502 jako u `/download`;
  - Range → 206/416;
  - hlavičky `inline`, `nosniff`, CSP `sandbox`, `Cache-Control`;
  - žádné `incrementDownloads`.
- [x] Route `assetRoutes.get('/:id/file', …)`. Caddy i vite proxy už `/api/assets/*` posílají do catalogu.
- [x] `previewUrl` v `toAssetView`: obrázek do 5 MB.
- [x] README: sekce „Náhled: `GET /api/assets/:id/file`“, řádek v tabulce API.

**Hotovo, když** (curl na lokálu):
- PNG vrátí 200 `image/png` a `downloadCount` se nezmění;
- `Range: bytes=0-99` u WAV vrátí 206 se 100 bajty;
- `zip` vrátí 404;
- `bytes=999999999-` vrátí 416.

## Krok 2: frontend `AssetPreview`

- [x] Závislost `@google/model-viewer` (a její peer `three`), načítaná přes `import()` jen pro 3D.
- [x] Typ JSX elementu `model-viewer` (`src/model-viewer.d.ts`).
- [x] `components/AssetPreview.tsx`: obrázek / 3D / zvuk / dekorace podle přípony, stav načítání, chyba,
      tlačítko pro 3D nad 20 MB.
- [x] `AssetDetailPage`: místo dnešního `previewUrl`/dekorace použít `AssetPreview`.
- [x] CSS: prohlížeč vyplní `detail-cover`, přehrávač dole přes celou šířku, mobil.

**Hotovo, když:**
- `npm run lint` a `npm run build` projdou;
- hlavní bundle nevyrostl (model-viewer je v samostatném chunku);
- na lokálu s demo daty: kostka se dá otočit myší, zvuk hraje a jde přetáčet, PNG se zobrazí, ZIP ukáže
  dekoraci s hláškou;
- v konzoli nejsou chyby, na mobilu (390 px) nic nepřetéká.

## Krok 3: ověření na serveru

- [ ] Po merge a deployi projít demo assety (`Low poly crate`, `Menu confirm`, `Knight sprite sheet`,
      `Sunset skybox`).
- [ ] Ověřit, že `downloadCount` po prohlížení nestoupá.
