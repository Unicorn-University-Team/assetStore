# assetStore

Asset Store — projekt pro UU (BPMI, tým 1): webová platforma pro sdílení herních assetů.

## Co kde leží

```
backend/             API na Express 5 + TypeScript, všechny routy pod /api
frontend/            React + Vite + TypeScript
deploy/              konfigurace Caddy a skript pro první nastavení serveru
docker-compose.yml   celý stack: PostgreSQL, backend a Caddy s frontendem
```

## Lokální vývoj

```bash
cd backend && npm install && npm run dev     # API na http://localhost:3000
cd frontend && npm install && npm run dev    # web na http://localhost:5173 (druhý terminál)
```

Vite přeposílá požadavky na `/api` na backend (`frontend/vite.config.ts`), stejně jako to dělá Caddy na serveru.
Když backend běží na jiném portu: `API_PROXY_TARGET=http://localhost:3001 npm run dev`.

PostgreSQL lokálně: `cp .env.example .env`, vyplnit `POSTGRES_PASSWORD` a spustit `docker compose up -d db`
(databáze poběží na `localhost:5432`). Backend ji zatím nepoužívá.

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

## Nasazení

Server je AWS EC2, celý stack běží v Dockeru podle `docker-compose.yml`. Změny jdou do `main` přes pull request.
Po mergi se na serveru spustí:

```bash
cd ~/assetStore && git pull && docker compose up -d --build
```

Nastavení serveru je v `~/assetStore/.env`. Vzor je `.env.example`, samotný `.env` do gitu nepatří.

| Proměnná | Význam |
|---|---|
| `POSTGRES_PASSWORD` | heslo databáze, jen písmena a číslice |
| `SITE_ADDRESS` | doména, pro kterou Caddy získá HTTPS certifikát; prázdné = HTTP na portu 80 |
| `SITE_AUTH` | `on` = jedno společné heslo na celý web, `off` = web je otevřený |
| `SITE_AUTH_USER`, `SITE_AUTH_HASH` | jméno a bcrypt hash hesla pro `SITE_AUTH=on` |

Nový server se poprvé připraví skriptem `deploy/setup-server.sh` (Docker, swap, naklonování repozitáře).
