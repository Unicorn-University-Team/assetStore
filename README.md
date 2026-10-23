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
- [Ochrana zápisu](#ochrana-zápisu)
- [Pravidla pro routy: frontend × backend](#pravidla-pro-routy-frontend--backend)
- [API](#api)
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
    └── components/               komponenty (AssetsDemo.tsx = testovací stránka)
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
- **Komunikace mezi službami (přijde s funkcemi):** přímé HTTP volání uvnitř sítě Dockeru na `/internal/...`,
  které Caddy ven nepouští. Například smazání assetu v catalog → community smaže jeho recenze a reporty.
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
- `WRITE_KEY` nechat lokálně prázdný, pak je zápis otevřený (viz [Ochrana zápisu](#ochrana-zápisu)).

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

1. **Frontend** pošle `multipart/form-data`: pole `name`, `description`, `type` a soubor `file`. Textová pole jdou
   první, soubor poslední (`uploadAsset()` ve `frontend/src/api/assets.ts`).
2. **Caddy** požadavek jen přepošle službě catalog, nic neukládá.
3. **`receiveUpload()`** (`services/catalog/src/utils/receiveUpload.ts`) čte požadavek přes busboy:
   - zkontroluje příponu podle whitelistu `ALLOWED_EXTENSIONS` (`services/catalog/src/models/asset.model.ts`); nepovolená
     přípona → **400**, nic se neukládá;
   - vygeneruje klíč `assets/<uuid>`;
   - soubor **streamuje rovnou do S3**. Velký soubor jde po částech po 5 MB (S3 multipart upload) a v paměti jsou
     najednou nejvýš 4 části, tedy asi 20 MB. Celý soubor se nikdy nedrží v paměti ani neukládá na disk serveru.
4. **Limit velikosti** `MAX_UPLOAD_MB` (výchozí 100 MB): když ho soubor překročí, nahrávání do S3 se zruší
   a odpověď je **413**.
5. **Kontrola polí** (`name` 1–100 znaků, `type` jeden z `2d`, `3d`, `map`, `sound`, `environment`, `description`
   do 2000 znaků) proběhne po uložení souboru. Když něco nesedí, soubor se z S3 hned smaže a odpověď je **400**.
6. **Záznam v databázi** se vytvoří, až když je soubor v S3. Odpověď **201** s novým assetem.

Když se cokoli pokazí, i když uživatel zavře stránku uprostřed nahrávání, v S3 nic nezůstane. Případné nedokončené
části multipart uploadu navíc po 1 dni smaže lifecycle pravidlo bucketu.

### Stažení: `GET /api/assets/:id/download`

1. Backend najde záznam; neexistující id → **404**.
2. Otevře soubor v S3 a zvýší `downloadCount` o 1. `downloadCount` mění jen server.
3. Soubor **streamuje** do prohlížeče s hlavičkou `Content-Disposition: attachment; filename="<původní jméno>"`,
   takže se stáhne pod původním jménem, a s `X-Content-Type-Options: nosniff`, aby ho prohlížeč nikdy nezobrazil
   jako stránku.

Ve frontendu stačí obyčejný odkaz: `<a href={downloadUrl(asset.id)}>Stáhnout</a>`.

### Smazání: `DELETE /api/assets/:id`

Nejdřív se smaže záznam v databázi, takže asset hned zmizí z katalogu, potom soubor v S3. Když se smazání v S3
nepovede, chyba se zapíše do logu služby catalog a záznam zůstane smazaný.

### Chyby

| Kód | Kdy |
|---|---|
| 401 | chybí nebo nesedí klíč pro zápis (`X-Write-Key`) |
| 400 | chybí `name` nebo `file`, neplatný `type`, nepovolená přípona, požadavek není `multipart/form-data` |
| 404 | asset neexistuje (i neplatné id) |
| 413 | soubor je větší než `MAX_UPLOAD_MB` |
| 502 | soubor se nepodařilo uložit do S3 |
| 507 | všechny soubory dohromady by překročily `MAX_STORAGE_GB` |

Chybová odpověď je vždy JSON `{ "error": "..." }`. Funkce ve `frontend/src/api/client.ts` z něj udělají `Error`
s touto zprávou.

### Vyzkoušení přes curl

```bash
curl -F name='Meč' -F type=3d -F description='Low poly' -F file=@sword.glb http://localhost:3002/api/assets
curl 'http://localhost:3002/api/assets?search=meč'
curl -OJ http://localhost:3002/api/assets/<id>/download     # uloží soubor pod původním jménem
curl -X DELETE http://localhost:3002/api/assets/<id>
```

Lokálně bez `WRITE_KEY` klíč není potřeba; na serveru se přidá `-H 'X-Write-Key: <klíč>'`.

### Přístup k S3

- **Server** nemá žádné klíče. AWS SDK si přihlášení vezme z IAM role `assetstore-ec2`, kterou má instance EC2.
  Role smí jen číst, zapisovat a mazat soubory v bucketu `assetstore-files-tym1`.
- **Vývoj** používá IAM usera `assetstore-dev` s klíčem v `services/catalog/.env`. Smí jen do bucketu
  `assetstore-files-tym1-dev`, k souborům na webu se nedostane.

### Co zatím chybí

- Vlastník assetu (`owner_id`) a kontrola práv: přijde s přihlášením (AUTH-1 až AUTH-3). Do té doby zápis
  chrání společný klíč, viz [Ochrana zápisu](#ochrana-zápisu).
- Tagy, recenze, kolekce.

## Ochrana zápisu

Dokud nemáme registraci a přihlášení, nikdo cizí nesmí nahrávat, upravovat ani mazat assety. Proto platí dvě pojistky:

1. **Klíč pro zápis.** `POST`, `PUT` a `DELETE` na `/api/assets` vyžadují hlavičku `X-Write-Key` se společným klíčem
   týmu (`WRITE_KEY` v `.env` na serveru). Bez klíče nebo se špatným klíčem je odpověď **401** a soubor se ani
   nezačne nahrávat. Prohlížení, hledání a stahování klíč nepotřebují. Když `WRITE_KEY` není nastavený (lokální
   vývoj), je zápis otevřený.
2. **Limit celkové velikosti** `MAX_STORAGE_GB` (výchozí 5 GB). Když by všechny soubory dohromady limit překročily,
   nahrání skončí **507** a soubor se v S3 nenechá. I kdyby klíč unikl, bucket nejde zaplnit donekonečna.

Klíč dá Yura, posílat ho jen soukromě. Na testovací stránce se zadává do pole „Write key“ a prohlížeč si ho
pamatuje. Z kódu se posílá takto:

```ts
uploadAsset(asset, writeKey)    // frontend/src/api/assets.ts, přidá hlavičku X-Write-Key
```

```bash
curl -H 'X-Write-Key: <klíč>' -F name='Meč' -F type=3d -F file=@sword.glb https://3-125-15-78.sslip.io/api/assets
```

Klíč je záměrně v hlavičce `X-Write-Key`, ne v `Authorization`: tu používá heslo na celý web (`SITE_AUTH`).
Až bude přihlášení, nahradí klíč kontrola uživatele a jeho role.

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

Zatím má endpointy jen **catalog**; identity a community jsou připravené prázdné služby.

| Metoda | Cesta | Co dělá |
|---|---|---|
| `GET` | `/api/health/<služba>` | stav služby `identity`, `catalog` nebo `community`: `{ service, status, database }` (catalog i `storage`), při chybě 503 |
| `GET` | `/api/assets?search=&page=` | seznam, hledání v názvu bez ohledu na velikost písmen, 20 na stránku: `{ items, page, pageSize, total }` |
| `GET` | `/api/assets/:id` | jeden asset |
| `POST` | `/api/assets` | nahrání, `multipart/form-data`: `name`, `description`, `type`, `file`; potřebuje `X-Write-Key` |
| `PUT` | `/api/assets/:id` | JSON `{ name, description }`, soubor se nemění; potřebuje `X-Write-Key` |
| `DELETE` | `/api/assets/:id` | smaže záznam i soubor; potřebuje `X-Write-Key` |
| `GET` | `/api/assets/:id/download` | stažení souboru, `downloadCount` + 1 |

Asset v odpovědi (`services/catalog/src/views/asset.view.ts`):

```json
{
  "id": "1f628f53-d68c-47d0-b147-0f7b0386ad43",
  "name": "Medieval sword",
  "description": "Low poly",
  "type": "3d",
  "fileName": "sword.glb",
  "fileSize": 300000,
  "downloadCount": 0,
  "createdAt": "2026-10-21T21:38:54.677Z",
  "updatedAt": "2026-10-21T21:38:54.677Z"
}
```

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
| `WRITE_KEY` | společný klíč týmu pro nahrávání, úpravy a mazání; prázdné = zápis otevřený |

Nový server se poprvé připraví skriptem `deploy/setup-server.sh` (Docker, swap, naklonování repozitáře). Instance
navíc potřebuje IAM roli s přístupem k bucketu.
