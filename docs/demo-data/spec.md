# Demo data: specifikace

Stav: **návrh k odsouhlasení týmem**. Plán práce je v [plan.md](plan.md).

## Proč

Na webu i lokálně je teď skoro prázdný katalog, takže demo (prezentace, testování, screenshoty) vypadá chudě
a každý si data vyrábí ručně. Chceme jedním příkazem dostat **realistický, vždy stejný obsah**: uživatele,
assety se skutečnými soubory, reporty a později recenze a tagy. A stejně jednoduše ho zase odstranit.

## Co to je (a co ne)

**Nástroj `tools/demo-data`**, ne další běžící mikroslužba. Spustí se, naplní data a skončí
(jednorázový job, `docker compose run --rm`). Běžící služba by žrala RAM na malém serveru (t4g.small, 1,8 GB)
a nic by nepřinesla: data se generují jednou, ne pořád.

- Je to npm workspace vedle služeb (`tools/demo-data`), sdílí `packages/shared`.
- Nemá vlastní databázi ani vlastní API.
- Do produkčních služeb se kvůli němu nepřidávají žádné „seed“ endpointy.

## Hlavní pravidla

1. **Přes veřejné API, kde to jde.** Registrace, přihlášení, nahrání assetu, report a jeho zamítnutí jdou přes
   stejné endpointy jako z webu. Data tak projdou validací a audit logem a soubory skončí v S3 stejně jako od
   uživatele. Když se API změní, nástroj to hned ukáže.
2. **SQL jen na to, co API neumí:** role `ADMIN`, stav `SUSPENDED`, zpětné datum `createdAt`, počet stažení,
   tabulka `tag`. Každý takový zásah je v kódu na jednom místě a okomentovaný.
3. **Deterministický obsah.** Data jsou v ručně psaných fixturách (JSON/TS), ne náhodný lorem ipsum.
   Dva běhy = stejný výsledek. Na zátěžové testy (jen lokálně) je volitelný přepínač `--scale N`,
   který z fixtur vyrobí N× víc assetů.
4. **Idempotence.** Opakovaný `seed` nic nezdvojí: existujícího uživatele jen přihlásí, asset se stejným
   jménem u stejného vlastníka přeskočí.
5. **Demo data jdou poznat a smazat.** Všichni demo uživatelé mají e-mail v doméně
   `@demo.assetstore.test`. Demo asset = asset demo uživatele. `wipe` maže jen tohle a nic jiného.
6. **Žádná tajemství v repu.** Heslo demo účtů je v proměnné `DEMO_PASSWORD` (`.env` na serveru,
   lokálně v `tools/demo-data/.env`). Bez ní nástroj skončí s chybou.

## Příkazy

| Příkaz | Co udělá |
|---|---|
| `seed` | Vytvoří (doplní) demo data. |
| `wipe` | Smaže demo assety přes API (tím i soubory v S3), demo reporty a demo uživatele. |
| `status` | Vypíše, kolik demo uživatelů, assetů a reportů je v systému. |

Společné přepínače:

- `--dry-run` vypíše, co by se udělalo, a nic nezmění;
- `--yes` je povinný pro `seed` a `wipe` proti produkci;
- `--scale N` jen lokálně, na produkci je zakázaný.

## Obsah demo dat (verze 1)

### Uživatelé (~12)

| Kdo | Počet | Poznámka |
|---|---|---|
| Autoři assetů | 8 | Různě aktivní: jeden má 20+ assetů (stránkování v „My assets“), jeden jen 1. |
| Běžní uživatelé bez assetů | 2 | Posílají reporty. |
| `demo_admin` | 1 | Role `ADMIN` (SQL), na moderování reportů. |
| `demo_suspended` | 1 | Stav `SUSPENDED` (SQL), na ukázku zablokovaného účtu. |

Jména jsou uvěřitelná (`pixel_forge`, `lowpoly_lena`, …), ne `user1`.

### Assety (~60)

- Všech 5 typů (`2d`, `3d`, `map`, `sound`, `environment`), každý aspoň 8×.
- Názvy a popisy psané ručně, aby katalog a vyhledávání vypadaly přirozeně.
- Okrajové případy na test UI:
  - velmi dlouhý název;
  - diakritika;
  - prázdný popis;
  - popis s 2000 znaky.
- **Skutečné malé soubory**, generované v kódu (bez externích knihoven, bez stahování z internetu):

  | Typ souboru | Obsah |
  |---|---|
  | PNG | jednoduchý barevný vzor |
  | WAV | krátký tón |
  | GLB | minimální platná scéna (kostka) |
  | ZIP | pár souborů uvnitř |
  | TMX | malá mapa |

  Všechny přípony jsou na whitelistu catalogu. Každý soubor má do ~200 kB, celkem do **20 MB**.
- `createdAt` rozložené do posledních ~60 dní (SQL), aby řazení „nejnovější“ dávalo smysl.
- `downloadCount` různé, 0 až několik tisíc (SQL).

### Reporty (~10)

- Od běžných uživatelů, nikdy od vlastníka assetu (to API nedovolí).
- Různé důvody (`copyright`, `inappropriate`, `malware`, `spam`, `other`), některé s komentářem.
- Část zůstane `open` (fronta pro admina), část zamítne `demo_admin` přes `POST /api/reports/:id/reject`.

### Později (až to bude umět backend)

Každá oblast je v nástroji samostatný modul, takže přidání nové = nový modul + fixtura:

- **tagy** (až bude vazba asset ↔ tag; tabulka `tag` už existuje);
- **preview obrázky**;
- **recenze a hodnocení**.

## Kde a jak se spouští

| Prostředí | Jak | Kam míří |
|---|---|---|
| Lokálně | `npm run demo -w tools/demo-data -- seed` | služby na `localhost:3001–3003`, lokální DB, dev S3 bucket |
| Server | GitHub Actions → workflow **Demo data** (ručně, `workflow_dispatch`, volba `seed` / `wipe` / `status`) → SSM → `docker compose run --rm demo-data …` | služby v compose síti, produkční DB a S3 |

- V `docker-compose.yml` je `demo-data` v profilu `tools`, takže se nespouští s `docker compose up` ani deployem.
- Konfigurace přes proměnné prostředí: `IDENTITY_URL`, `CATALOG_URL`, `COMMUNITY_URL`, `IDENTITY_DATABASE_URL`,
  `CATALOG_DATABASE_URL`, `COMMUNITY_DATABASE_URL`, `DEMO_PASSWORD`.
- Workflow smí spustit jen admin repa (stejně jako merge do `main`).

## Bezpečnost a rizika

| Riziko | Opatření |
|---|---|
| `wipe` smaže skutečná data | Maže jen podle domény `@demo.assetstore.test`. Před smazáním vypíše počty a bez `--yes` na produkci skončí. |
| Někdo se přihlásí jako demo admin | Silné `DEMO_PASSWORD` jen v `.env` serveru. `demo_admin` se dá vynechat přepínačem `--no-admin`. |
| Místo na disku / S3 | Soubory celkem do 20 MB, do S3, ne na disk serveru. |
| Audit log se zaplní | Pár desítek záznamů na jeden `seed`, to nevadí. |
| Změna API rozbije nástroj | Typy ze `packages/shared`, CI kontroluje `typecheck` a test fixtur. |

## Otevřené otázky pro tým

1. Pouštět demo data i na produkci (kvůli prezentaci), nebo jen lokálně a na případném stagingu?
   *Návrh:* ano, na produkci, a před odevzdáním je jedním `wipe` uklidit.
2. Zrušit demo uživatele z `services/identity/src/seed.ts` (`NODE_ENV=development`) a nechat tam jen admina?
   *Návrh:* ano, demo uživatele přebírá tenhle nástroj.
3. Kdo nástroj vlastní a kdo doplňuje moduly, když přibude feature (recenze, tagy)?
   *Návrh:* autor feature přidá i modul do demo dat, je to bod v Definition of Done.
