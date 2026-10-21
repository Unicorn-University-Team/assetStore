# assetStore

Asset Store — projekt pro UU (BPMI, tým 1): webová platforma pro sdílení herních assetů (2D a 3D modely, mapy,
zvuky, prostředí). Uživatelé assety nahrávají, hledají a stahují.

Web běží na **https://3-125-15-78.sslip.io** (dočasná adresa, dokud nemáme vlastní doménu).

- [Co kde leží](#co-kde-leží)
- [Nástroje, které používáme](#nástroje-které-používáme)
- [Lokální vývoj](#lokální-vývoj)
- [Databáze a migrace](#databáze-a-migrace)
- [Jak funguje nahrávání a stahování souborů](#jak-funguje-nahrávání-a-stahování-souborů)
- [Pravidla pro routy: frontend × backend](#pravidla-pro-routy-frontend--backend)
- [API](#api)
- [Nasazení](#nasazení)

## Co kde leží

```
backend/
├── prisma/schema.prisma          schéma databáze
├── prisma/migrations/            migrace (SQL), patří do gitu
└── src/
    ├── config/env.ts             nastavení z proměnných prostředí
    ├── db/prisma.ts              připojení k PostgreSQL
    ├── storage/file-storage.ts   práce se soubory v S3
    ├── utils/receiveUpload.ts    příjem nahrávaného souboru
    ├── models/ controllers/ views/ routes/   MVC: data, logika, odpovědi, URL
    └── generated/prisma/         vygenerovaný klient Prismy (není v gitu)
frontend/
└── src/
    ├── api/client.ts             fetch na /api
    ├── api/assets.ts             assety: seznam, nahrání, smazání, odkaz ke stažení
    └── components/               komponenty (AssetsDemo.tsx = testovací stránka)
deploy/                           konfigurace Caddy a skript pro první nastavení serveru
docker-compose.yml                celý stack: PostgreSQL, backend, Caddy s frontendem
```

## Nástroje, které používáme

### Backend

| Nástroj | K čemu ho máme |
|---|---|
| **Node.js 24** | běhové prostředí pro backend |
| **Express 5** | HTTP server a routy, struktura MVC |
| **TypeScript** | typy v celém projektu; `npm run typecheck` |
| **Prisma 7** | práce s databází: schéma, migrace, typovaný klient (`prisma.asset.findMany()`…) |
| **PostgreSQL 17** | databáze; lokálně i na serveru běží v Dockeru |
| **AWS SDK v3** (`@aws-sdk/client-s3`, `@aws-sdk/lib-storage`) | ukládání, čtení a mazání souborů v S3 |
| **busboy** | čtení `multipart/form-data`, tedy formuláře se souborem, bez ukládání na disk |
| **dotenv** | načte `backend/.env` do `process.env` |
| **tsx** | spouští TypeScript ve vývoji a restartuje server při změně (`npm run dev`) |

### Frontend

| Nástroj | K čemu ho máme |
|---|---|
| **React 19** | uživatelské rozhraní |
| **Vite 8** | vývojový server a sestavení; ve vývoji přeposílá `/api` na backend |
| **TypeScript** | typy; přísné nastavení (viz PR #2) |
| **oxlint** | linter; `npm run lint` |

### Infrastruktura

| Nástroj | K čemu ho máme |
|---|---|
| **Docker + Docker Compose** | celý stack v kontejnerech: `db`, `backend`, `caddy` |
| **Caddy 2** | jediný vstup zvenku: HTTPS certifikát (Let's Encrypt, sám), frontend, `/api` → backend |
| **AWS EC2** | server: `t4g.micro` (ARM, 1 GB RAM), Ubuntu 24.04, region Frankfurt |
| **AWS S3** | úložiště souborů assetů: bucket `assetstore-files-tym1` (web) a `assetstore-files-tym1-dev` (vývoj) |
| **AWS IAM** | přístupová práva: role `assetstore-ec2` pro server, user `assetstore-dev` pro vývoj |
| **sslip.io** | dočasná doména: `3-125-15-78.sslip.io` vede na IP serveru, aby šlo HTTPS bez vlastní domény |
| **GitHub** | kód a pull requesty; do `main` jde všechno přes PR |

## Lokální vývoj

Potřeba: Node.js 24, Docker.

**1. Databáze** (v kořeni repozitáře):

```bash
cp .env.example .env          # vyplnit POSTGRES_PASSWORD, jen písmena a číslice
docker compose up -d db       # PostgreSQL na localhost:5432
```

**2. Backend:**

```bash
cd backend
cp .env.example .env          # vyplnit DATABASE_URL, S3_BUCKET a AWS klíče (níže)
npm install                   # nainstaluje balíčky a vygeneruje klienta Prismy
npm run db:deploy             # vytvoří tabulky v lokální databázi
npm run dev                   # API na http://localhost:3000
```

V `backend/.env`:

- `DATABASE_URL=postgres://assetstore:<POSTGRES_PASSWORD>@localhost:5432/assetstore`
- `S3_BUCKET=assetstore-files-tym1-dev`: vývojový bucket, soubory z vývoje se tak nemíchají se soubory na webu.
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`: přístupový klíč k vývojovému bucketu, dá ho Yura.
  Klíč neposílat do skupinových chatů a nikdy necommitovat.

Kontrola: `curl http://localhost:3000/api/health` vrátí `{"status":"ok","database":"ok","storage":"ok"}`.
Když je `storage` `error`, chybí nebo nesedí `S3_BUCKET` nebo AWS klíče.

**3. Frontend** (v druhém terminálu):

```bash
cd frontend && npm install && npm run dev    # web na http://localhost:5173
```

Vite přeposílá požadavky na `/api` na backend (`frontend/vite.config.ts`), stejně jako to dělá Caddy na serveru.
Když je port 3000 obsazený: v `backend/.env` nastavit `PORT=3001` a do `frontend/.env.local` napsat
`API_PROXY_TARGET=http://localhost:3001`.

Soubory `.env` a `.env.local` do gitu nepatří, jsou v `.gitignore`.

## Databáze a migrace

Schéma je v `backend/prisma/schema.prisma`. Postup při změně, třeba nové tabulce:

1. Upravit `schema.prisma`.
2. `npm run db:migrate -- --name add-tags`: Prisma vytvoří SQL migraci v `prisma/migrations/`, použije ji
   na lokální databázi a znovu vygeneruje klienta.
3. Složku s migrací commitnout spolu se změnou schématu.

Na serveru se migrace použijí samy: kontejner backendu při startu spustí `prisma migrate deploy`.

| Příkaz | Co dělá |
|---|---|
| `npm run db:migrate -- --name <název>` | nová migrace po změně schématu (jen lokálně) |
| `npm run db:deploy` | použije všechny migrace, které v databázi ještě nejsou |
| `npm run db:studio` | prohlížeč databáze v prohlížeči |

Klienta Prismy importovat jen přes `src/db/prisma.ts` (`import { prisma } from '../db/prisma'`). Každý
`new PrismaClient()` otevírá vlastní sadu spojení k databázi.

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
prohlížeč ──multipart──▶ Caddy ──▶ Express ──▶ busboy ──stream──▶ S3 (assets/<uuid>)
                                                  │
                                                  └── po uložení souboru ──▶ PostgreSQL (záznam asset)
```

1. **Frontend** pošle `multipart/form-data`: pole `name`, `description`, `type` a soubor `file`. Textová pole jdou
   první, soubor poslední (`uploadAsset()` ve `frontend/src/api/assets.ts`).
2. **Caddy** požadavek jen přepošle backendu, nic neukládá.
3. **`receiveUpload()`** (`backend/src/utils/receiveUpload.ts`) čte požadavek přes busboy:
   - zkontroluje příponu podle whitelistu `ALLOWED_EXTENSIONS` (`backend/src/models/asset.model.ts`); nepovolená
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
nepovede, chyba se zapíše do logu backendu a záznam zůstane smazaný.

### Chyby

| Kód | Kdy |
|---|---|
| 400 | chybí `name` nebo `file`, neplatný `type`, nepovolená přípona, požadavek není `multipart/form-data` |
| 404 | asset neexistuje (i neplatné id) |
| 413 | soubor je větší než `MAX_UPLOAD_MB` |
| 502 | soubor se nepodařilo uložit do S3 |

Chybová odpověď je vždy JSON `{ "error": "..." }`. Funkce ve `frontend/src/api/client.ts` z něj udělají `Error`
s touto zprávou.

### Vyzkoušení přes curl

```bash
curl -F name='Meč' -F type=3d -F description='Low poly' -F file=@sword.glb http://localhost:3000/api/assets
curl 'http://localhost:3000/api/assets?search=meč'
curl -OJ http://localhost:3000/api/assets/<id>/download     # uloží soubor pod původním jménem
curl -X DELETE http://localhost:3000/api/assets/<id>
```

### Přístup k S3

- **Server** nemá žádné klíče. AWS SDK si přihlášení vezme z IAM role `assetstore-ec2`, kterou má instance EC2.
  Role smí jen číst, zapisovat a mazat soubory v bucketu `assetstore-files-tym1`.
- **Vývoj** používá IAM usera `assetstore-dev` s klíčem v `backend/.env`. Smí jen do bucketu
  `assetstore-files-tym1-dev`, k souborům na webu se nedostane.

### Co zatím chybí

- Vlastník assetu (`owner_id`) a kontrola práv: přijde s přihlášením (AUTH-1 až AUTH-3). Zatím může nahrávat
  a mazat každý.
- Tagy, recenze, kolekce.

## Pravidla pro routy: frontend × backend

Frontend i backend běží na jedné adrese. Caddy dělí požadavky podle cesty:

| Cesta | Kam jde |
|---|---|
| `/api/...` | backend, odpovídá JSONem |
| `/static/...` | soubory sestavení frontendu (JS, CSS) |
| všechno ostatní | `index.html`, stránku vykreslí React Router |

Přechody uvnitř aplikace přes React Router (`<Link>`, `navigate`) na server vůbec nejdou. Na server jde jen první
načtení, obnovení stránky a požadavky `fetch` na `/api`.

1. **`/api` patří jen backendu.** Všechny routy Express jsou pod `/api/...` a žádná stránka frontendu nezačíná na `/api`.
   Jinak by po obnovení stránky šel požadavek na backend a vrátil JSON 404.
2. **`/static` patří jen sestavení frontendu.** Vite tam ukládá JS a CSS (`build.assetsDir` ve `vite.config.ts`).
   Stránky frontendu na `/static` nedávat. Cesty jako `/assets/:id` jsou pro stránky volné.
3. **Přihlášení přes httpOnly cookie, ne přes hlavičku `Authorization`.** Heslo na celý web (`SITE_AUTH`, viz níže)
   hlavičku `Authorization` už používá, takže `Authorization: Bearer …` by s ním kolidoval a Caddy by vracel 401.
   Pokud se tým rozhodne pro Bearer tokeny, při zapnutí přihlášení je potřeba nastavit `SITE_AUTH=off`.

Frontend volá API vždy relativní cestou, `fetch('/api/...')` (viz `frontend/src/api/client.ts`), bez adresy serveru
a bez CORS.

## API

| Metoda | Cesta | Co dělá |
|---|---|---|
| `GET` | `/api/health` | stav: `{ status, database, storage }`, při chybě 503 |
| `GET` | `/api/assets?search=&page=` | seznam, hledání v názvu bez ohledu na velikost písmen, 20 na stránku: `{ items, page, pageSize, total }` |
| `GET` | `/api/assets/:id` | jeden asset |
| `POST` | `/api/assets` | nahrání, `multipart/form-data`: `name`, `description`, `type`, `file` |
| `PUT` | `/api/assets/:id` | JSON `{ name, description }`; soubor se nemění |
| `DELETE` | `/api/assets/:id` | smaže záznam i soubor |
| `GET` | `/api/assets/:id/download` | stažení souboru, `downloadCount` + 1 |

Asset v odpovědi (`backend/src/views/asset.view.ts`):

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

## Nasazení

Server je AWS EC2, celý stack běží v Dockeru podle `docker-compose.yml`. Změny jdou do `main` přes pull request.
Po mergi se na serveru spustí:

```bash
cd ~/assetStore && git pull && docker compose up -d --build
```

Backend při startu sám použije nové migrace databáze. Kontrola: `https://3-125-15-78.sslip.io/api/health`.

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

Nový server se poprvé připraví skriptem `deploy/setup-server.sh` (Docker, swap, naklonování repozitáře). Instance
navíc potřebuje IAM roli s přístupem k bucketu.
