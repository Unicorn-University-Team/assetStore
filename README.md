# assetStore

Asset Store — projekt pro UU (BPMI, tým 1): webová platforma pro sdílení herních assetů (2D a 3D modely, mapy,
zvuky, prostředí). Uživatelé assety nahrávají, hledají a stahují.

Web běží na **https://3-125-15-78.sslip.io** (dočasná adresa, dokud nemáme vlastní doménu).

- [Co kde leží](#co-kde-leží)
- [Architektura: mikroslužby](#architektura-mikroslužby)
- [Nástroje, které používáme](#nástroje-které-používáme)
- [Lokální vývoj](#lokální-vývoj)
- [Databáze a migrace](#databáze-a-migrace)
- [Jak funguje nahrávání a stahování souborů](#jak-funguje-nahrávání-a-stahování-souborů)
- [Přihlášení](#přihlášení)
- [Ochrana zápisu](#ochrana-zápisu)
- [Komunikace mezi službami](#komunikace-mezi-službami)
- [Audit log](#audit-log)
- [Pravidla pro routy: frontend × backend](#pravidla-pro-routy-frontend--backend)
- [API](#api)
- [Práce s Gitem](#práce-s-gitem)
- [CI](#ci)
- [Nasazení](#nasazení)

## Co kde leží

```
services/                         backend: tři mikroslužby (npm workspaces)
├── identity/                     uživatelé, přihlášení, role
├── catalog/                      assety, tagy, soubory v S3
├── community/                    recenze, kolekce, reporty
└── Dockerfile                    jeden Dockerfile pro všechny služby
    každá služba:
    ├── prisma/schema.prisma      schéma její databáze
    ├── prisma/migrations/        migrace (SQL), patří do gitu
    └── src/
        ├── app.ts, server.ts     Express aplikace a její spuštění
        ├── config/env.ts         nastavení z proměnných prostředí
        ├── db/prisma.ts          připojení k vlastní databázi
        ├── models/ controllers/ views/ routes/   MVC: data, logika, odpovědi, URL
        └── generated/prisma/     vygenerovaný klient Prismy (není v gitu)
packages/shared/                  kód společný pro všechny služby (HttpError, obsluha chyb…)
frontend/
└── src/
    ├── api/client.ts             fetch na /api
    ├── api/assets.ts             assety: seznam, nahrání, smazání, odkaz ke stažení
    └── components/               komponenty (karta assetu, vyhledávání, dialogy…)
deploy/                           Caddy (API gateway), skripty pro server a AWS, vytvoření databází
docker-compose.yml                celý stack: PostgreSQL, tři služby, Caddy s frontendem
package.json                      kořen npm workspaces pro backend (frontend má vlastní)
```

## Architektura: mikroslužby

Backend jsou tři samostatné služby. Každá má **vlastní databázi** a do cizí databáze nikdy nesahá.

| Služba | Data | Požadavky (spec) | Veřejné cesty | Lokální port |
|---|---|---|---|---|
| **identity** | uživatelé, refresh tokeny | AUTH-1…3, ADM-1, ADM-2 | `/api/auth/*`, `/api/users/*` | 3001 |
| **catalog** | assety, tagy, soubory v S3 | AST-1…7, TAG-1…2 | `/api/assets/*`, `/api/tags/*` | 3002 |
| **community** | recenze, kolekce, reporty | REV-1…3, COL-1…2, REP-1…3 | `/api/assets/:id/reviews`, `/api/assets/:id/reports`, `/api/reviews/*`, `/api/collections/*`, `/api/reports/*` | 3003 |

```
prohlížeč ──▶ Caddy (API gateway, HTTPS)
               ├── /api/auth, /api/users                     ──▶ identity  ──▶ databáze identity
               ├── /api/assets/:id/reviews|reports,
               │   /api/reviews, /api/collections, /api/reports ──▶ community ──▶ databáze community
               ├── /api/assets, /api/tags                     ──▶ catalog   ──▶ databáze catalog + S3
               └── všechno ostatní                             ──▶ frontend
```

- **Caddy je API gateway.** Pro frontend existuje jen jedna adresa `/api`; Caddy podle cesty pošle požadavek
  správné službě (`deploy/Caddyfile`). Ve vývoji dělá totéž Vite (`frontend/vite.config.ts`), obě místa se musí
  měnit spolu. Neznámá cesta pod `/api` vrátí JSON 404.
- **Databáze:** jeden PostgreSQL, v něm databáze `identity`, `catalog` a `community`. Vytvoří je služba `db-init`
  v `docker-compose.yml`. Mezi službami nejsou cizí klíče: `ownerId`, `userId`, `assetId` jsou jen UUID.
- **Zdraví služeb:** každá služba má `GET /health` (kontroluje svou databázi, catalog i S3). Zvenku je to
  `/api/health/identity`, `/api/health/catalog`, `/api/health/community`.
- **Přihlášení (přijde v PR identity):** krátký JWT a refresh token v httpOnly cookie. Token podepisuje identity,
  ostatní služby ho ověřují samy veřejným klíčem.
- **Komunikace mezi službami:** přímé HTTP volání uvnitř sítě Dockeru na `/internal/...`, které Caddy ven
  nepouští, chráněné klíčem `INTERNAL_KEY`. Podrobně v [Komunikace mezi službami](#komunikace-mezi-službami).
- **Společný kód** je v `packages/shared` (`import { HttpError } from '@assetstore/shared'`). Po změně:
  `npm run build -w @assetstore/shared`.

Nová cesta pod `/api` = přidat ji do `deploy/Caddyfile` i do `frontend/vite.config.ts` k té službě, která ji vlastní.

## Nástroje, které používáme

### Backend

| Nástroj | K čemu ho máme |
|---|---|
| **Node.js 24** | běhové prostředí pro backend |
| **Express 5** | HTTP server a routy v každé službě, struktura MVC |
| **npm workspaces** | jeden `npm install` v kořeni pro všechny služby a `packages/shared` |
| **TypeScript** | typy v celém projektu; `npm run typecheck` |
| **Prisma 7** | práce s databází: schéma, migrace, typovaný klient (`prisma.asset.findMany()`…) |
| **PostgreSQL 17** | databáze; lokálně i na serveru běží v Dockeru |
| **AWS SDK v3** (`@aws-sdk/client-s3`, `@aws-sdk/lib-storage`) | ukládání, čtení a mazání souborů v S3 |
| **busboy** | čtení `multipart/form-data`, tedy formuláře se souborem, bez ukládání na disk |
| **dotenv** | načte `services/<služba>/.env` do `process.env` |
| **tsx** | spouští TypeScript ve vývoji a restartuje server při změně (`npm run dev`) |

### Frontend

| Nástroj | K čemu ho máme |
|---|---|
| **React 19** | uživatelské rozhraní |
| **Vite 8** | vývojový server a sestavení; ve vývoji posílá `/api` na správnou službu |
| **TypeScript** | typy; přísné nastavení (viz PR #2) |
| **oxlint** | linter; `npm run lint` |

### Infrastruktura

| Nástroj | K čemu ho máme |
|---|---|
| **Docker + Docker Compose** | celý stack v kontejnerech: `db`, `db-init`, `identity`, `catalog`, `community`, `caddy` |
| **Caddy 2** | jediný vstup zvenku a API gateway: HTTPS certifikát (Let's Encrypt, sám), frontend, `/api` → služby |
| **AWS EC2** | server: `t4g.micro` (ARM, 1 GB RAM), Ubuntu 24.04, region Frankfurt |
| **AWS S3** | úložiště souborů assetů: bucket `assetstore-files-tym1` (web) a `assetstore-files-tym1-dev` (vývoj) |
| **AWS IAM** | přístupová práva: role `assetstore-ec2` pro server, user `assetstore-dev` pro vývoj |
| **sslip.io** | dočasná doména: `3-125-15-78.sslip.io` vede na IP serveru, aby šlo HTTPS bez vlastní domény |
| **GitHub** | kód a pull requesty; do `main` jde všechno přes PR |

## Lokální vývoj

Potřeba: Node.js 24, Docker. Všechno se spouští z kořene repozitáře, pokud není řečeno jinak.

**1. Databáze:**

```bash
cp .env.example .env              # vyplnit POSTGRES_PASSWORD, jen písmena a číslice
docker compose up -d db-init      # PostgreSQL na localhost:5432 + databáze identity, catalog, community
```

**2. Backend:**

```bash
npm install                       # všechny služby; sestaví packages/shared a vygeneruje klienty Prismy
for s in identity catalog community; do cp services/$s/.env.example services/$s/.env; done
# v každém .env doplnit heslo do DATABASE_URL, v services/catalog/.env navíc S3 (níže)
npm run db:deploy --workspaces --if-present    # vytvoří tabulky ve všech třech databázích
```

Každá služba se pouští ve vlastním terminálu (nebo jen ta, na které se pracuje):

```bash
cd services/identity && npm run dev     # http://localhost:3001
cd services/catalog && npm run dev      # http://localhost:3002
cd services/community && npm run dev    # http://localhost:3003
```

V `services/catalog/.env` navíc:

- `S3_BUCKET=assetstore-files-tym1-dev`: vývojový bucket, soubory z vývoje se tak nemíchají se soubory na webu.
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`: přístupový klíč k vývojovému bucketu, dá ho Yura.
  Klíč neposílat do skupinových chatů a nikdy necommitovat.
- `JWT_PUBLIC_KEY`: stejná hodnota jako v `services/identity/.env`. Bez něj nahrávání, úpravy a mazání vrací **503**
  (viz [Ochrana zápisu](#ochrana-zápisu)).

Kontrola: `curl http://localhost:3002/health` vrátí `{"service":"catalog","status":"ok","database":"ok","storage":"ok"}`.
Když je `storage` `error`, chybí nebo nesedí `S3_BUCKET` nebo AWS klíče.

**3. Frontend** (v dalším terminálu):

```bash
cd frontend && npm install && npm run dev    # web na http://localhost:5173
```

Vite posílá `/api` na správnou službu podle stejných pravidel jako Caddy na serveru (`frontend/vite.config.ts`).
Když služba běží na jiném portu, stačí do `frontend/.env.local` napsat třeba `CATALOG_URL=http://localhost:4002`
(také `IDENTITY_URL`, `COMMUNITY_URL`).

Celý stack jako na serveru: `docker compose up -d --build` → http://localhost.

Soubory `.env` a `.env.local` do gitu nepatří, jsou v `.gitignore`.

## Databáze a migrace

Každá služba má vlastní schéma `services/<služba>/prisma/schema.prisma` a vlastní migrace. Za schéma služby odpovídá
ten, kdo službu vede. Postup při změně, třeba nové tabulce v catalog:

1. Upravit `services/catalog/prisma/schema.prisma`.
2. V `services/catalog`: `npm run db:migrate -- --name add-tags`. Prisma vytvoří SQL migraci v `prisma/migrations/`,
   použije ji na lokální databázi a znovu vygeneruje klienta.
3. Složku s migrací commitnout ve stejném PR jako změnu schématu.

Pravidla:

- Už nasazené migrace se nikdy neupravují, jen se přidává nová.
- Změnu schématu napsat dopředu do chatu, ať dva lidi nemění stejnou tabulku.
- PR s migrací před mergem aktualizovat z `main`; CI ověří, že schéma a migrace sedí.

Na serveru se migrace použijí samy: kontejner každé služby při startu spustí `prisma migrate deploy`.

| Příkaz (ve složce služby) | Co dělá |
|---|---|
| `npm run db:migrate -- --name <název>` | nová migrace po změně schématu (jen lokálně) |
| `npm run db:deploy` | použije všechny migrace, které v databázi ještě nejsou |
| `npm run db:studio` | prohlížeč databáze v prohlížeči |

Klienta Prismy importovat jen přes `src/db/prisma.ts` dané služby (`import { prisma } from '../db/prisma'`).
Každý `new PrismaClient()` otevírá vlastní sadu spojení k databázi.

## Jak funguje nahrávání a stahování souborů

### Kde co je

| Kde | Co |
|---|---|
| **PostgreSQL**, tabulka `asset` | popis assetu: `name`, `description`, `type`, `fileName`, `fileSize`, `contentType`, `downloadCount`, `fileKey` |
| **S3** | samotný soubor pod klíčem `assets/<uuid>` |

`fileKey` je odkaz ze záznamu v databázi na soubor v S3. Generuje ho backend, nikdy se nebere ze jména souboru od
uživatele, a klient ho nikdy nedostane.

Bucket je privátní: soubor nemá veřejnou adresu a ven se dostane jen přes náš endpoint pro stažení. Díky tomu funguje
počítadlo stažení (spec, AST-4) a backend může kontrolovat práva.

### Nahrání: `POST /api/assets`

```
prohlížeč ──multipart──▶ Caddy ──▶ catalog ──▶ busboy ──stream──▶ S3 (assets/<uuid>)
                                                  │
                                                  └── po uložení souboru ──▶ PostgreSQL (záznam asset)
```

1. **Frontend** pošle `multipart/form-data`: pole `name`, `description`, `type`, nepovinně `tagList`, obrázek náhledu
   `preview` a soubor `file`. Textová pole jdou první, soubory poslední (`uploadAsset()` ve `frontend/src/api/assets.ts`).
2. **Caddy** požadavek jen přepošle službě catalog, nic neukládá.
3. **`receiveUpload()`** (`services/catalog/src/utils/receiveUpload.ts`) čte požadavek přes busboy:
   - zkontroluje příponu podle whitelistu `ALLOWED_EXTENSIONS` (`services/catalog/src/models/asset.model.ts`); nepovolená
     přípona → **400**, nic se neukládá;
   - `preview` (AM `asset/create`, povinný): jen `png`, `jpg`, `jpeg`, `webp`, nejvýš **2 MB**, jinak **400**
     (`invalidPreviewType`) nebo **413** (`previewTooLarge`); bez náhledu **400**. `Content-Type` náhledu je podle
     přípony, ne od prohlížeče. Klíč `previews/<uuid>`;
   - vygeneruje klíč `assets/<uuid>`;
   - soubor **streamuje rovnou do S3**. Velký soubor jde po částech po 5 MB (S3 multipart upload) a v paměti jsou
     najednou nejvýš 4 části, tedy asi 20 MB. Celý soubor se nikdy nedrží v paměti ani neukládá na disk serveru.
4. **Limit velikosti** `MAX_UPLOAD_MB` (výchozí 100 MB): když ho soubor překročí, nahrávání do S3 se zruší
   a odpověď je **413**.
5. **Kontrola polí** (`name` 1–100 znaků, `type` jeden z `2d`, `3d`, `map`, `sound`, `environment`, `description`
   do 2000 znaků, tagy podle [Tagy při publikaci](#tagy-při-publikaci-us-11)) proběhne po uložení souboru. Když něco
   nesedí, soubor se z S3 hned smaže a odpověď je **400**.
6. **Záznam v databázi** se vytvoří, až když je soubor v S3: asset, vazby `asset_tag` a audit
   `assetCreated` v jedné transakci. Odpověď **201** s novým assetem.

### Tagy při publikaci (US-1.1)

`tagList` v `POST /api/assets` je seznam názvů tagů: jedno pole na tag (`-F tagList=medieval -F tagList=low-poly`),
nebo jedno pole s JSON polem (`-F 'tagList=["medieval","low-poly"]'`). Bez `tagList` je asset bez tagů.

1. Každý název se ořízne a převede na malá písmena, stejný tag dvakrát se počítá jednou.
2. Název musí mít 1–50 znaků: latinka, číslice, pomlčka (BR-05). Jinak **400** se jménem tagu a **nic** se nevytvoří:
   ani asset, ani žádný tag.
3. Nejvýš 10 tagů na asset, jinak **400**.
4. Každý tag musí už existovat (AM `asset/create` krok 3), jinak **400** `Tag "<název>" does not exist; create it first`
   a nic se neuloží. Chybějící tag se nejdřív vytvoří přes `POST /api/tags` (AM `tag/create`).
5. Potvrzení „vytvořit nový tag?“ řeší frontend (`TagInput`): po potvrzení zavolá `POST /api/tags` a teprve potom
   dá tag k assetu.

`POST /api/tags` `{ "name": "Low-Poly" }` (jen přihlášený, jinak **401**): název se ořízne a převede na malá písmena,
pravidla jako v bodě 2 (jinak **400**). Odpověď **201** `{ id, name }`, existující název **409**
`Tag "<název>" already exists`. Dva současné požadavky se stejným novým názvem dají jeden tag a jednu 409, žádnou 500
(`INSERT … ON CONFLICT DO NOTHING`).

Pravidla jsou v `services/catalog/src/utils/tags.ts` (testy `npm test` v `services/catalog`), uložení
v `AssetModel.setTags()` (bere jen existující tagy, `TagModel.findExisting`): stejnou funkci použije úprava assetu (US-2). Smazání assetu smaže jeho vazby, tagy zůstanou.

Když se cokoli pokazí, i když uživatel zavře stránku uprostřed nahrávání, v S3 nic nezůstane. Případné nedokončené
části multipart uploadu navíc po 1 dni smaže lifecycle pravidlo bucketu.

### Stažení: `GET /api/assets/:id/download`

1. Backend najde záznam; neexistující id → **404**.
2. Otevře soubor v S3. Když soubor v S3 chybí, odpoví **404** `The file of this asset is missing`, jiná chyba
   S3 → **502**.
3. Soubor **streamuje** do prohlížeče s hlavičkou `Content-Disposition: attachment; filename="<původní jméno>"`,
   takže se stáhne pod původním jménem, a s `X-Content-Type-Options: nosniff`, aby ho prohlížeč nikdy nezobrazil
   jako stránku.
4. Teprve po přenosu celého souboru zvýší `downloadCount` o 1 (AM `asset/download` krok 4). Přerušené nebo zrušené
   stažení se nepočítá. `downloadCount` mění jen server.

Ve frontendu stačí obyčejný odkaz s atributem `download`: `<a href={downloadUrl(asset.id)} download>Stáhnout</a>`.
Chybová odpověď pak skončí jako nepovedené stažení v prohlížeči a stránka zůstane.

### Obrázek náhledu: `GET /api/assets/:id/preview`

AM `asset/preview` (US-12): obrázek náhledu z privátního S3 (`preview_key`), s uloženým `Content-Type`. Tuhle adresu
vrací `previewUrl` v každém assetu, používají ji karty v katalogu, My assets a stránka assetu. `downloadCount` se nemění.

- Náhled se nahrává při publikaci (povinný) a při úpravě (`PUT /api/assets/:id` jako `multipart/form-data` s polem
  `preview`, nepovinné). Nový náhled nahradí starý, starý se z S3 smaže až po uložení. Když úprava selže, smaže se
  nový a starý zůstane.
- `ETag` je klíč v S3 a `Cache-Control: private, no-cache`: prohlížeč se zeptá znovu, ale dokud je obrázek stejný,
  dostane **304**. Po novém náhledu hned vidí nový.
- Asset bez náhledu → **404** `This asset has no preview`, chyba S3 → **502** (`previewReadFailed`).
- Assety nahrané před náhledy: migrace `asset_preview` u obrázků `png`/`jpg`/`jpeg`/`webp` do 5 MB nastavila jako náhled
  samotný soubor (stejný objekt v S3; takový náhled se samostatně nikdy nemaže). Ostatní staré assety mají
  `previewUrl: null`, dokud jim vlastník nepřidá náhled v úpravě.
- Při smazání assetu se smaže soubor i náhled (AM `asset/delete` krok 6).

### Soubor na stránce assetu: `GET /api/assets/:id/file`

Není v AM. Soubor pro **3D prohlížeč a přehrávač zvuku na stránce assetu**, ne ke stažení (podrobně `docs/asset-preview/spec.md`):

| | `/download` | `/file` |
|---|---|---|
| `downloadCount` | +1 | beze změny |
| `Content-Disposition` | `attachment` | `inline` |
| Které soubory | všechny | jen `png jpg jpeg webp gif`, `glb gltf`, `wav mp3 ogg flac`, jinak **404** `This file type has no preview` |

- `Content-Type` je podle přípony z pevné tabulky (`services/catalog/src/utils/preview.ts`), ne od uživatele. SVG ani
  HTML na seznamu nejsou.
- Hlavičky `X-Content-Type-Options: nosniff` a `Content-Security-Policy: default-src 'none'; sandbox`: soubor otevřený
  přímo v okně nespustí skript.
- **Range** (`Range: bytes=0-99` → **206** + `Content-Range`, mimo soubor → **416**): přehrávač zvuku přetáčí,
  rozsah jde rovnou do S3.
- `Cache-Control: private, max-age=3600`: soubor assetu se po nahrání nemění.

Ve frontendu ho používá `components/AssetPreview.tsx`:
- **obrázek:** `<img>`;
- **3D:** `<model-viewer>` (otáčení myší, zoom). Knihovna se stahuje jen na stránce 3D assetu, model nad 20 MB až na
  tlačítko;
- **zvuk:** `<audio>`;
- **ostatní:** kreslený obal.

### Smazání: `DELETE /api/assets/:id`

Smazat smí vlastník assetu nebo admin, ostatní dostanou **403**. Nejdřív se smaže záznam v databázi, takže asset hned zmizí z katalogu, potom soubor v S3. Když se smazání v S3
nepovede, chyba se zapíše do logu služby catalog a záznam zůstane smazaný.

### Chyby

| Kód | Kdy |
|---|---|
| 401 | uživatel není přihlášený, token je neplatný nebo prošlý |
| 403 | úprava cizího assetu, smazání cizího assetu (kromě admina), viz [Ochrana zápisu](#ochrana-zápisu) |
| 400 | chybí `name` nebo `file`, neplatný `type`, nepovolená přípona, požadavek není `multipart/form-data` |
| 404 | asset neexistuje (i neplatné id), u stažení i chybějící soubor v S3 |
| 413 | soubor je větší než `MAX_UPLOAD_MB` |
| 502 | soubor se nepodařilo uložit do S3 nebo z něj přečíst |
| 507 | všechny soubory dohromady by překročily `MAX_STORAGE_GB` |
| 503 | catalog nemá `JWT_PUBLIC_KEY`, takže nejde ověřit přihlášení |

Chybová odpověď je vždy JSON `{ "error": "..." }`. Funkce ve `frontend/src/api/client.ts` z něj udělají `Error`
s touto zprávou.

### Vyzkoušení přes curl

```bash
curl -b cookies.txt -F name='Meč' -F type=3d -F description='Low poly' -F tagList=medieval -F preview=@sword.png -F file=@sword.glb http://localhost:3002/api/assets
curl 'http://localhost:3002/api/assets?name=meč&pageIndex=0&pageSize=20'
curl 'http://localhost:3002/api/assets?ownerId=<id uživatele>'   # assety jednoho uživatele (i My assets)
curl -b cookies.txt -H 'Content-Type: application/json' -d '{"name":"medieval"}' http://localhost:3002/api/tags   # nový tag
curl 'http://localhost:3002/api/assets?tagList=medieval&tagList=low-poly'   # jen assety se všemi těmito tagy
curl -OJ http://localhost:3002/api/assets/<id>/download     # uloží soubor pod původním jménem
curl -b cookies.txt -X DELETE http://localhost:3002/api/assets/<id>
```

Nahrání a smazání potřebují přihlášení: `cookies.txt` vznikne při přihlášení, viz [Ochrana zápisu](#ochrana-zápisu).

### Přístup k S3

- **Server** nemá žádné klíče. AWS SDK si přihlášení vezme z IAM role `assetstore-ec2`, kterou má instance EC2.
  Role smí jen číst, zapisovat a mazat soubory v bucketu `assetstore-files-tym1`.
- **Vývoj** používá IAM usera `assetstore-dev` s klíčem v `services/catalog/.env`. Smí jen do bucketu
  `assetstore-files-tym1-dev`, k souborům na webu se nedostane.

### Co zatím chybí

- Tagy, recenze, kolekce.

## Nahlášení assetů (reporty)

Reporty jsou ve službě **community** (tabulka `report` podle AM `reportSchema`,
`services/community/src/models/report.model.ts`). Při nahlášení se od catalogu zjistí vlastník a **název assetu**
a uloží se do reportu (`asset_name`), aby historie porušení zůstala čitelná i po smazání assetu. Jména uživatelů se
při čtení doptají identity přes `/internal` (viz [Komunikace mezi službami](#komunikace-mezi-službami)).

| Metoda | Cesta | Kdo | Co dělá |
|---|---|---|---|
| `POST` | `/api/assets/:id/reports` | přihlášený | US-5: `{ reason, comment? }` → **201** report; zablokovaný uživatel (`SUSPENDED`) → **403** |
| `GET` | `/api/reports?status=&assetOwnerId=&pageIndex=&pageSize=` | admin | seznam od nejnovějších; `status` `open` (výchozí), `resolved`, `rejected` nebo `all`; `assetOwnerId` (nepovinné, UUID) = jen reporty na assety tohoto vlastníka; stránky jako u assetů: `{ itemList, pageInfo }` |
| `GET` | `/api/reports/:id` | admin | jeden report |
| `POST` | `/api/reports/:id/reject` | admin | US-7: zamítnutí, `open` → `rejected`, zapíše `reportRejected` do audit logu |

- **Důvody** (`reason`, podle AM): `inappropriateContent`, `copyright`, `spam`, `brokenFile`, `other`. `comment` je
  nepovinný, nejvýš 500 znaků. Stejný seznam je ve frontendu (`frontend/src/api/reports.ts`) a jako CHECK v databázi.
- **Stavy:** `open` → `resolved` (US-6, přijetí: zatím chybí) nebo `rejected` (US-7). Rozhodnutý report má
  `decidedById` a `decidedAt`.
- **Pravidla:** vlastní asset nahlásit nejde (**403**), zablokovaný uživatel nahlásit nejde (**403**; stav se ověří
  v identity, když neodpoví → **503**), stejný uživatel má na jeden asset nejvýš jeden otevřený
  report (**409**; v databázi částečný unikátní index `report_one_open_per_author_asset`, platí i pro dva požadavky
  najednou), neexistující asset → **404**. Rozhodnutý report znovu zamítnout nejde (**409**). Seznam, detail
  a zamítnutí bez role admin → **403**, bez přihlášení **401**. Bez `JWT_PUBLIC_KEY` odpoví community **503**.
- **Report v odpovědi** (`services/community/src/views/report.view.ts`): `id`, `assetId`, `assetName`, `assetOwnerId`,
  `assetOwnerName`, `authorId`, `authorName`, `reason`, `comment`, `status`, `createdAt`, `decidedById`,
  `decidedByName`, `decidedAt`. `assetName` a `assetOwnerId` jsou uložené v době nahlášení, takže zůstanou i po
  smazání assetu. Jména uživatelů jsou `null`, když uživatel už neexistuje nebo identity neodpověděla.

## Recenze

Recenze jsou ve službě **community** (tabulka `review`, `services/community/src/models/review.model.ts`). Stejně
jako u reportů se ukládají jen id assetu a autora, vlastníka assetu community zjistí od catalogu.

| Metoda | Cesta | Kdo | Co dělá |
|---|---|---|---|
| `GET` | `/api/assets/:id/reviews` | kdokoli | recenze assetu od nejnovějších: `?pageIndex=&pageSize=` → `{ itemList, pageInfo }` |
| `POST` | `/api/assets/:id/reviews` | přihlášený | US-4: `{ rating, comment? }` → **201** recenze |

- `rating` je celé číslo 1–5 (i CHECK v databázi), `comment` je nepovinný, nejvýš 2000 znaků; prázdný = `null`.
- **Pravidla:** vlastní asset hodnotit nejde (**403**), jeden uživatel má na jeden asset nejvýš jednu recenzi
  (**409**, unikátní `(author_id, asset_id)`), neexistující asset → **404**, bez přihlášení **401**.
- **Odpověď:** `id`, `assetId`, `authorId`, `authorName`, `rating`, `comment`, `createdAt` a nový stav assetu
  `averageRating` (zaokrouhlený na jedno desetinné místo) a `reviewCount`. `authorName` je `null`, když identity
  neodpoví.
- **Seznam:** stránky od 0, `pageSize` 1–100 (výchozí 20), jinak **400**; neplatné id assetu → **400**. Existenci
  assetu se catalogu neptá: neznámý asset prostě nemá recenze (prázdný `itemList`). Položka má stejná pole jako
  odpověď na `POST`, bez `averageRating` a `reviewCount`.

## Kolekce

Kolekce jsou ve službě **community** (tabulky `collection` a `collection_asset`,
`services/community/src/models/collection.model.ts`). Vlastník se bere z tokenu, nikdy z požadavku, a kolekce
vidí jen on.

| Metoda | Cesta | Kdo | Co dělá |
|---|---|---|---|
| `POST` | `/api/collections` | přihlášený | COL-1: `{ name, description? }` → **201** kolekce |
| `GET` | `/api/collections` | přihlášený | vlastní kolekce od nejnovějších: `{ itemList }` |

- `name` je povinný, 1–100 znaků, `description` nepovinný, nejvýš 2000 znaků (obojí se ořízne), jinak **400**.
  Bez přihlášení **401**.
- **Kolekce v odpovědi:** `id`, `ownerId`, `name`, `description`, `createdAt`.

## Přihlášení

Registraci a přihlášení dělá služba identity:

| Metoda | Cesta | Co dělá |
|---|---|---|
| `POST` | `/api/auth/register` | `{ username, email, password }` → **201** `{ id, username, email }`, obsazené jméno nebo e-mail → **409** (jméno bez ohledu na velikost písmen: `Tester` = `tester`) |
| `POST` | `/api/auth/login` | `{ email, password }` → nastaví cookies `access_token` a `refresh_token`, zablokovaný účet → **403** |
| `GET` | `/api/auth/me` | přihlášený uživatel `{ user: { id, username, email, role, status, confirmedViolations, suspendedAt } }`; bez jakékoli cookie session `{ user: null }` (**200**, nikdo není přihlášený), s neplatným nebo prošlým tokenem **401** |
| `POST` | `/api/auth/refresh` | vymění refresh token za nový access token a nový refresh token |
| `POST` | `/api/auth/logout` | zruší session a smaže obě cookies |
| `GET` | `/api/users?status=&pageIndex=&pageSize=` | jen admin (AM `user/list`, US-8): stránka účtů, `status` = `active` nebo `suspended` (zablokovaní uživatelé, nejnovější zablokování první), jinak **400**: `{ itemList: [{ id, username, email, role, status, confirmedViolations, suspendedAt, createdAt }], pageInfo }`; bez přihlášení **401**, uživatel **403** |
| `GET` | `/api/users/:id` | jen admin (AM `user/get`): jeden účet se stejnými poli, neznámé id **404**; historii porušení vrací `GET /api/reports?status=resolved&assetOwnerId=` |

**Porušení pravidel (US-6, AM `user/addViolation`):** každý přijatý report vlastníkovi assetu přidá jedno potvrzené
porušení (`confirmedViolations`). Report se počítá jen jednou: tabulka `user_violation` má klíč `report_id`. U pátého
porušení se účet zablokuje (`status` `SUSPENDED`, `suspendedAt`) a zruší se všechny jeho session; access token ještě
platí až 15 minut. `user/removeViolation` porušení daného reportu vrátí zpět (když report/accept nemohl uložit
rozhodnutí) a zablokování zruší, když jich je zase méně než 5. Zrušené session zůstanou zrušené.

- **Access token** je JWT podepsaný RS256: `sub` = id uživatele, `role` = `USER` nebo `ADMIN`, platí 15 minut.
  Identity podepisuje soukromým klíčem, ostatní služby ověřují veřejným (zatím catalog).
- **Refresh token** platí 30 dní. V databázi je jen jeho hash a při každém refresh se mění za nový.
- Oba tokeny jsou httpOnly cookies, ne hlavička `Authorization` (tu používá heslo na celý web, `SITE_AUTH`).
  Na serveru (`NODE_ENV=production`) se posílají jen přes HTTPS.

**Klíče.** Pár klíčů se vygeneruje jednou a do `.env` se dává jako base64 na jednom řádku:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem
openssl pkey -in private.pem -pubout -out public.pem
echo "JWT_PRIVATE_KEY=$(base64 < private.pem | tr -d '\n')"
echo "JWT_PUBLIC_KEY=$(base64 < public.pem | tr -d '\n')"
rm private.pem public.pem
```

Lokálně patří oba řádky do `services/identity/.env`, na serveru do `~/assetStore/.env`. Soukromý klíč nikomu
neposílat a do gitu nepatří. Bez klíčů služba běží, ale přihlášení a refresh vrátí **503**.

**Admin a demo účty:** `cd services/identity && npx tsx src/seed.ts` vytvoří admina `admin@example.com` s heslem
`SEED_ADMIN_PASSWORD`. S `NODE_ENV=development` navíc aktivního a zablokovaného demo uživatele. Spustit se dá
opakovaně, existující účty nemění.

## Ochrana zápisu

`POST`, `PUT` a `DELETE` na `/api/assets` smí jen přihlášený uživatel. Catalog ověří access token z cookie
`access_token` veřejným klíčem (`JWT_PUBLIC_KEY`, stejná hodnota jako v identity) a id uživatele zapíše do audit
logu jako `actorId`. Platí tři pojistky:

1. **Přihlášení.** Bez cookie nebo s neplatným či prošlým tokenem je odpověď **401** a soubor se ani nezačne
   nahrávat. Když catalog nemá `JWT_PUBLIC_KEY`, odpoví **503**. Prohlížení, hledání a stahování přihlášení
   nepotřebují.
2. **Limit celkové velikosti** `MAX_STORAGE_GB` (výchozí 5 GB). Když by všechny soubory dohromady limit překročily,
   nahrání skončí **507** a soubor se v S3 nenechá. Bucket tak nejde zaplnit donekonečna, ani když se přihlásí
   někdo, kdo nemá.

Prohlížeč posílá cookie sám, stačí se přihlásit na stejném webu. Postman taky (viz [Postman](#postman)). Přes curl
se cookie uloží při přihlášení a pak se přikládá:

```bash
curl -c cookies.txt -H 'Content-Type: application/json' -d '{"email":"admin@example.com","password":"<heslo>"}' http://localhost:3001/api/auth/login
curl -b cookies.txt -F name='Meč' -F type=3d -F file=@sword.glb http://localhost:3002/api/assets
```

3. **Vlastník.** Kdo asset nahraje, je jeho vlastník (`ownerId` se bere z tokenu, nikdy z požadavku). Upravit
   asset smí jen vlastník, smazat vlastník nebo admin. Ostatní dostanou **403** (ne 404: assety jsou veřejné, není
   co skrývat). Assety nahrané dřív než vlastníci mají `ownerId = null`: upravit je nesmí nikdo, smazat jen admin.
   Kontrola je v `AssetModel` (`services/catalog/src/models/asset.model.ts`) nad záznamem přečteným v transakci,
   ne v middleware, takže se asset nečte dvakrát a mezi kontrolou a změnou ho nikdo nepřepíše.

Registrace je otevřená, na serveru cizí lidi drží venku `SITE_AUTH`.

## Komunikace mezi službami

Služba nikdy nesahá do cizí databáze. Když potřebuje cizí data, zeptá se vlastníka přes HTTP na jeho cestě
`/internal/...`. Příklad: community před vytvořením recenze ověří u catalog, že asset existuje.

```
community ──GET /internal/assets/:id/exists──▶ catalog ──▶ databáze catalog
          ◀────────── { "exists": true } ──────────┘
```

- **Adresy služeb** jsou v proměnných prostředí (`CATALOG_URL`…) v `src/config/env.ts` dané služby.
  Lokálně `http://localhost:3002`, v Dockeru jméno služby `http://catalog:3000` (`docker-compose.yml`);
  `localhost` v kontejneru je kontejner sám.
- **Ochrana:** Caddy posílá službám jen `/api/...`, takže `/internal` zvenku dostupné není. Navíc každé volání nese
  hlavičku `X-Internal-Key` se společným klíčem `INTERNAL_KEY` (stejná hodnota ve všech službách). Bez klíče nebo
  se špatným klíčem je odpověď **401**. Prázdný `INTERNAL_KEY` (lokální vývoj) = bez kontroly.
- **Volání:** jen přes `callService` z `@assetstore/shared`. Přidá klíč, po 3 s to vzdá a chyby převede na
  `HttpError`: služba neběží nebo neodpoví včas → **503**, odpoví chybou → **502**. Podrobnosti jdou do logu.

| Služba | Cesta | Odpověď | Kdo volá |
|---|---|---|---|
| catalog | `GET /internal/assets/:id/exists` | `{ "exists": boolean }` | community |
| identity | `POST /internal/users/:id/violations` `{ reportId }` | účet (jako `GET /api/users/:id`); stejný report podruhé nic nezmění; neznámý účet **404** | community (report/accept) |
| identity | `POST /internal/users/:id/violations/:reportId/remove` | `{}`; neznámý účet **404** | community (report/accept, když se rozhodnutí neuloží) |
| identity | `GET /internal/users?ids=<id>,<id>` (nejvýš 100) | `{ "itemList": [{ "id", "username", "status" }] }` (`ACTIVE` / `SUSPENDED`), neznámá id chybí | catalog (`ownerName`, zablokovaný uživatel nesmí publikovat), community (jména v reportech, zablokovaný autor nesmí nahlásit asset) |
| catalog | `GET /internal/assets?ids=<id>,<id>` (nejvýš 100) | `{ "itemList": [{ "id", "name", "ownerId" }] }`, smazané assety chybí | community (reporty) |
| community | `GET /internal/reviews/summaries?ids=<id>,<id>` (nejvýš 100) | `{ "itemList": [{ "assetId", "averageRating", "reviewCount" }] }`, assety bez recenzí chybí | catalog (hodnocení assetů) |

### Nová interní cesta

Příklad: catalog bude chtít, aby community smazala recenze smazaného assetu.

1. **Služba, která odpovídá** (community): cesta v `src/routes/internal.routes.ts`, připojená v `app.ts` přes
   `app.use('/internal', requireInternalKey(env.internalKey), internalRoutes)`.
2. **Služba, která volá** (catalog): adresa v `src/config/env.ts` (`communityUrl: process.env.COMMUNITY_URL ??
   'http://localhost:3003'`), v `.env.example` a v `docker-compose.yml` (`COMMUNITY_URL: http://community:3000`).
3. Funkce v `src/clients/<služba>.client.ts` (vzor `services/community/src/clients/catalog.client.ts`):

   ```ts
   await callService(env.communityUrl, `/internal/assets/${id}`, { internalKey: env.internalKey, method: 'DELETE' });
   ```

4. Přidat řádek do tabulky výše.

Synchronní volání dělat jen tam, kde bez cizích dat nejde akci správně provést (kontrola existence, mazání
souvisejících dat). Data jen pro zobrazení, třeba název assetu u recenze, ať raději spojí frontend.

### Vyzkoušení

Lokálně musí běžet obě služby (`npm run dev` v `services/catalog` i `services/community`):

```bash
curl http://localhost:3002/internal/assets/<id>/exists        # catalog přímo
```

S nastaveným `INTERNAL_KEY` přidat `-H 'X-Internal-Key: <klíč>'`. Cestu community → catalog používají reporty
a recenze (`CatalogClient.assetSummaries`): když catalog neběží, vrátí jejich vytvoření 503.

## Audit log

Záznam důležitých akcí: kdo co udělal, s jakým objektem a kdy. Slouží k řešení sporů, v aplikaci se nezobrazuje.
Záznamy se nikdy nemění ani nemažou.

Každá služba má vlastní tabulku `audit_log` a model `src/models/audit-log.model.ts`. Model `AuditLog` je ve všech
třech `schema.prisma` stejný a tak má zůstat.

| Služba | Akce | Stav |
|---|---|---|
| catalog | `assetCreated`, `assetUpdated`, `assetDeleted` | zapisuje se |
| community | `reportResolved`, `reportRejected` | `reportRejected` (US-7) se zapisuje, přijetí reportu (US-6) zatím není |
| identity | `userDeleted` | jen tabulka a model, mazání uživatele zatím není |

Sloupce: `actorId` (kdo akci provedl), `action`, `objectType` (`asset`, `report`, `user`), `objectId`, `changes`
a `createdAt`. `changes` je jen u `assetUpdated`, obsahuje změněná pole: `{ "name": { "old": "…", "new": "…" } }`.
V catalogu je `actorId` id přihlášeného uživatele (`sub` z access tokenu); starší záznamy ho mají prázdný.

Pravidla:

1. **Akce a záznam jdou v jedné transakci.** Když se záznam nepovede zapsat, celá akce se vrátí a odpověď je **500**.
2. **Neúspěšné pokusy se nezapisují.** Validace a kontrola práv proběhnou v controlleru ještě před transakcí.
3. **`userDeleted` obsahuje jen id**, bez osobních údajů. Mazání souvisejících dat v jiných službách vlastní záznamy
   nepíše.

```ts
return prisma.$transaction(async (tx) => {
  const report = await tx.report.update({ ... });       // akce
  await AuditLogModel.create(tx, { action: 'reportResolved', objectType: 'report', objectId: report.id });
  return report;
});
```

Uvnitř transakce používat jen `tx`, ne `prisma`, jinak dotaz proběhne mimo transakci. Soubory v S3 a volání jiných
služeb se s transakcí nevrátí. Při chybě se uklízejí ručně, vzorem jsou `create` a `remove` v
`services/catalog/src/controllers/asset.controller.ts`.

## Pravidla pro routy: frontend × backend

Frontend i backend běží na jedné adrese. Caddy dělí požadavky podle cesty:

| Cesta | Kam jde |
|---|---|
| `/api/...` | služba, která cestu vlastní (viz [Architektura](#architektura-mikroslužby)), odpovídá JSONem |
| `/static/...` | soubory sestavení frontendu (JS, CSS) |
| všechno ostatní | `index.html`, stránku vykreslí React Router |

Přechody uvnitř aplikace přes React Router (`<Link>`, `navigate`) na server vůbec nejdou. Na server jde jen první
načtení, obnovení stránky a požadavky `fetch` na `/api`.

1. **`/api` patří jen backendu.** Všechny veřejné routy služeb jsou pod `/api/...` a žádná stránka frontendu nezačíná na `/api`.
   Jinak by po obnovení stránky šel požadavek na backend a vrátil JSON 404.
2. **`/static` patří jen sestavení frontendu.** Vite tam ukládá JS a CSS (`build.assetsDir` ve `vite.config.ts`).
   Stránky frontendu na `/static` nedávat. Cesty jako `/assets/:id` jsou pro stránky volné.
3. **Přihlášení přes httpOnly cookie, ne přes hlavičku `Authorization`.** Heslo na celý web (`SITE_AUTH`, viz níže)
   hlavičku `Authorization` už používá, takže `Authorization: Bearer …` by s ním kolidoval a Caddy by vracel 401.
   Pokud se tým rozhodne pro Bearer tokeny, při zapnutí přihlášení je potřeba nastavit `SITE_AUTH=off`.

Frontend volá API vždy relativní cestou, `fetch('/api/...')` (viz `frontend/src/api/client.ts`), bez adresy serveru
a bez CORS.

## API

Endpointy mají **catalog** (assety), **identity** (přihlášení, viz [Přihlášení](#přihlášení)) a **community**
(reporty, recenze a kolekce, viz [Nahlášení assetů](#nahlášení-assetů-reporty), [Recenze](#recenze) a
[Kolekce](#kolekce)). Všechno se dá vyzkoušet v Postmanu, viz [Postman](#postman) níže.

| Metoda | Cesta | Co dělá |
|---|---|---|
| `GET` | `/api/health/<služba>` | stav služby `identity`, `catalog` nebo `community`: `{ service, status, database }` (catalog i `storage`), při chybě 503 |
| `GET` | `/api/assets?name=&ownerId=&tagList=&pageIndex=&pageSize=` | seznam od nejnovějších, hledání v názvu bez ohledu na velikost písmen (`%` a `_` jsou obyčejné znaky); `ownerId` (uuid, jinak 400) vrátí jen assety tohoto uživatele (stránka „Moje assety“); `tagList` = názvy tagů, parametr jednou na tag (`tagList=medieval&tagList=low-poly`), vrátí jen assety, které mají **všechny** tyto tagy; stejná pravidla jako při publikaci (velikost písmen se ignoruje, nejvýš 10, neplatný název → 400), neznámý tag → prázdný seznam; stránky od 0, `pageSize` 1–100 (výchozí 20), jinak 400: `{ itemList, pageInfo: { pageIndex, pageSize, total } }` |
| `GET` | `/api/assets/:id` | jeden asset |
| `POST` | `/api/assets` | nahrání, `multipart/form-data`: `name`, `description`, `type`, `tagList` (nepovinné, viz [Tagy při publikaci](#tagy-při-publikaci-us-11)), `preview` (obrázek do 2 MB), `file`; potřebuje přihlášení, zablokovaný účet (`SUSPENDED`) → **403** (AM `userSuspended`) |
| `PUT` | `/api/assets/:id` | JSON `{ name, description?, tagList? }`, s novým náhledem `multipart/form-data` (stejná pole + `preview`, `tagList` jako JSON pole); bez `description` zůstane popis beze změny; `tagList` nahradí tagy (každý musí existovat, jinak **400**), bez něj zůstanou, soubor se nemění; jen vlastník, jinak **403** |
| `DELETE` | `/api/assets/:id` | smaže záznam i soubor; jen vlastník nebo admin, jinak **403** |
| `GET` | `/api/assets/:id/download` | stažení souboru, `downloadCount` + 1 až po celém přenosu (přerušené stažení se nepočítá) |
| `GET` | `/api/assets/:id/preview` | obrázek náhledu (AM `asset/preview`), `ETag` + **304**, `downloadCount` beze změny; bez náhledu **404** |
| `GET` | `/api/assets/:id/file` | soubor pro 3D prohlížeč a zvuk na stránce assetu (není v AM), `inline`, Range, `downloadCount` beze změny; jiný formát **404** |
| `POST` | `/api/tags` | nový tag (AM `tag/create`, US-1.1) `{ name }`: jen přihlášený, **201** `{ id, name }`, neplatný název **400**, existující **409** |
| `GET` | `/api/tags?prefix=` | nápověda tagů a filtr (AM `tag/list`): nejvýš 10 tagů začínajících na `prefix` (bez ohledu na velikost písmen, nejvýš 50 znaků, jinak **400**), řazeno podle názvu: `{ itemList: [{ id, name }] }` |

Asset v odpovědi (`services/catalog/src/views/asset.view.ts`). `ownerId` je id uživatele z identity (u starých
assetů `null`), `ownerName` jeho uživatelské jméno: catalog se na jména ptá identity (`GET /internal/users`,
viz [Komunikace mezi službami](#komunikace-mezi-službami)). Když identity neodpoví, je `ownerName` `null` a katalog
funguje dál. `previewUrl` je `/api/assets/<id>/preview` (jen u starých assetů bez náhledu `null`, viz [Obrázek náhledu](#obrázek-náhledu-get-apiassetsidpreview)).
`tagList` jsou názvy tagů podle abecedy. `averageRating` (na jedno desetinné místo) a `reviewCount` v `GET /api/assets`,
`GET /api/assets/:id` a `PUT /api/assets/:id` počítá community (jedno volání
`GET /internal/reviews/summaries` na odpověď). Bez recenzí, nebo když community neodpoví, je `averageRating` `null`
a `reviewCount` 0 a katalog funguje dál. Nový asset z `POST /api/assets` recenze ještě nemá, proto vrací `null` a 0:

```json
{
  "id": "1f628f53-d68c-47d0-b147-0f7b0386ad43",
  "ownerId": "29367033-ee56-41e2-a003-d463a556c47c",
  "ownerName": "pixel_smith",
  "name": "Medieval sword",
  "description": "Low poly",
  "type": "3d",
  "tagList": ["low-poly", "medieval"],
  "fileName": "sword.glb",
  "fileSize": 300000,
  "previewUrl": "/api/assets/1f628f53-d68c-47d0-b147-0f7b0386ad43/preview",
  "downloadCount": 0,
  "averageRating": null,
  "reviewCount": 0,
  "createdAt": "2026-10-21T21:38:54.677Z",
  "updatedAt": "2026-10-21T21:38:54.677Z"
}
```

### Postman

Kolekce se všemi endpointy je v `postman/AssetStore.postman_collection.json`. V Postmanu: **Import** → vybrat soubor.

1. Spustit backend a frontend lokálně (viz [Lokální vývoj](#lokální-vývoj)). Kolekce volá `{{baseUrl}}`, výchozí
   `http://localhost:5173`: Vite pošle `/api` na správnou službu stejně jako Caddy na serveru.
2. **Auth → Login** jako první. Přihlášení nastaví cookies `access_token` a `refresh_token`, Postman je pak sám posílá
   s dalšími požadavky. E-mail a heslo jsou v proměnných kolekce `email` a `password`: výchozí e-mail je lokální admin
   ze seedu, heslo doplnit z `SEED_ADMIN_PASSWORD` v `services/identity/.env`.
3. **Assets → Create**: v záložce Body vybrat soubor u pole `file`. Create a List uloží id do proměnné `assetId`,
   Get, Update, Download a Delete s ním pak pracují.

**Prostředí (environments):** importovat i `postman/AssetStore-Local.postman_environment.json` a
`AssetStore-Server.postman_environment.json` a vpravo nahoře vybrat, proti čemu se volá. Hesla a klíče v souborech
nejsou: v **Environments** → prostředí → sloupec **Current value** doplnit `password` (lokálně `SEED_ADMIN_PASSWORD`).
Tajné hodnoty psát jen do **Current value**, ne do Initial value: Initial value se synchronizuje do cloudu Postmanu a vidí ji každý, s kým se prostředí sdílí.

Každý požadavek má test na očekávaný status, takže celou složku jde pustit přes **Run**.

## Práce s Gitem

Jediná dlouhodobá větev je `main`. Co je v `main`, to běží na serveru.

1. Na každý úkol si uděláš vlastní větev z aktuálního `main`:
   ```bash
   git switch main && git pull
   git switch -c feature/<krátký-popis>     # opravy: fix/<popis>
   ```
2. Commituješ a pushuješ do své větve (`git push -u origin feature/<krátký-popis>`).
3. Otevřeš pull request do `main`. Počkáš, až CI zezelená a Yura PR schválí.
4. PR mergneš sám tlačítkem **Merge pull request**. Větev se po mergi sama smaže.
5. Po mergi se `main` sám nasadí na server (viz [Nasazení](#nasazení)).

Pravidla:

- Do `main` se nepushuje napřímo, jen přes PR. Bez zeleného CI a bez schválení nejde PR mergnout.
- Když je tvoje větev pozadu za `main`, aktualizuj ji: `git pull origin main` (nebo tlačítko **Update branch** v PR).
- Žádné sdílené větve typu `dev/backend` nebo `dev/frontend`: každý PR jde rovnou do `main`.

## CI

Každý pull request a každý push do `main` zkontroluje GitHub Actions (`.github/workflows/ci.yml`). Výsledek je vidět
v PR jako zelená nebo červená značka; pro veřejný repozitář je to zdarma.

| Úloha | Co kontroluje |
|---|---|
| Service (identity / catalog / community) | pro každou službu zvlášť: `npm ci`, platné schéma Prismy, migrace projdou na prázdné databázi, **schéma a migrace sedí**, `typecheck`, `build` |
| Backend | souhrn: zelený, jen když prošly všechny tři služby (tuhle kontrolu vyžaduje pravidlo pro `main`) |
| Frontend | `npm ci`, `lint` (i varování jsou chyba), `build` |
| Docker images | sestaví obrazy všech tří služeb i frontendu stejně jako při nasazení |
| Deploy | jen po mergi do `main` a jen když jsou všechny kontroly výše zelené: nasadí na server (viz [Nasazení](#nasazení)) |

Když CI selže:

- **„schema.prisma differs from the migrations“**: změnilo se `schema.prisma`, ale chybí migrace. Spustit
  `npm run db:migrate -- --name <co-se-změnilo>` a složku z `prisma/migrations/` commitnout.
- **Lint**: `npm run lint` ve `frontend/` ukáže totéž lokálně.
- **Typecheck nebo build**: `npm run typecheck` / `npm run build` v příslušné složce (nebo v kořeni pro všechny služby).

Lokálně stačí před pushnutím pustit stejné příkazy; detail chyby je v PR pod „Details“ u neúspěšné kontroly.

## Nasazení

Server je AWS EC2, celý stack běží v Dockeru podle `docker-compose.yml`. Změny jdou do `main` přes pull request.

**Nasazení je automatické.** Po mergi do `main` proběhne CI a když jsou všechny kontroly zelené, úloha **Deploy**
aktualizuje server:

1. GitHub Actions dostane od AWS dočasný přístup přes OIDC. V GitHubu nejsou uložené žádné AWS klíče a roli
   `assetstore-github-deploy` může použít jen větev `main` tohoto repozitáře.
2. Přes AWS SSM pošle serveru příkaz: posunout `main` přesně na otestovaný commit a spustit `deploy/deploy.sh`.
   Port SSH zůstává zavřený.
3. `deploy/deploy.sh` sestaví a restartuje kontejnery, počká, až jsou všechny tři služby zdravé, a smaže staré
   obrazy, aby se nezaplnil disk. Každá služba při startu sama použije nové migrace své databáze.
4. Úloha nakonec ověří `https://3-125-15-78.sslip.io/api/health/<služba>` pro všechny tři služby.

Průběh a výsledek je vidět v záložce **Actions**, u commitu v `main` je zelená nebo červená značka. Nasazení jdou
jedno po druhém, nikdy dvě najednou.

Ručně (třeba po změně `.env` na serveru): `cd ~/assetStore && deploy/deploy.sh`.

Nastavení v AWS pro automatické nasazení dělá jednorázově skript `deploy/aws/setup-github-deploy.sh` (spouští se
v AWS CloudShell). V repozitáři jsou k tomu proměnné `AWS_DEPLOY_ROLE_ARN` a `DEPLOY_INSTANCE_ID`
(Settings → Secrets and variables → Actions → Variables).

Nastavení serveru je v `~/assetStore/.env`. Vzor je `.env.example`, samotný `.env` do gitu nepatří.

| Proměnná | Význam |
|---|---|
| `POSTGRES_PASSWORD` | heslo databáze, jen písmena a číslice |
| `SITE_ADDRESS` | doména, pro kterou Caddy získá HTTPS certifikát; prázdné = HTTP na portu 80 |
| `SITE_AUTH` | `on` = jedno společné heslo na celý web, `off` = web je otevřený |
| `SITE_AUTH_USER`, `SITE_AUTH_HASH` | jméno a bcrypt hash hesla pro `SITE_AUTH=on` |
| `S3_BUCKET` | bucket se soubory assetů, na serveru `assetstore-files-tym1` |
| `AWS_REGION` | region bucketu, `eu-central-1` |
| `MAX_UPLOAD_MB` | největší povolená velikost nahrávaného souboru v MB, výchozí 100 |
| `MAX_STORAGE_GB` | limit pro všechny soubory dohromady v GB, výchozí 5 |
| `JWT_PUBLIC_KEY` | veřejný klíč pro ověření přihlášení (identity, catalog); bez něj catalog na zápis vrací 503 |
| `INTERNAL_KEY` | společný klíč služeb pro volání `/internal/...`; prázdné = bez kontroly. `openssl rand -hex 32` |

Nový server se poprvé připraví skriptem `deploy/setup-server.sh` (Docker, swap, naklonování repozitáře). Instance
navíc potřebuje IAM roli s přístupem k bucketu.
