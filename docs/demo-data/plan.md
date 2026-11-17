# Demo data: plán práce

Podle [spec.md](spec.md). Každý krok = vlastní větev a PR, merguje Yura. Odhady jsou hrubé.

## Krok 0: odsouhlasit specifikaci (tým)

- [ ] Projít `spec.md` a rozhodnout otevřené otázky (produkce ano/ne, `seed.ts`, vlastnictví).
- [ ] Rozdělit kroky 1–6 mezi lidi.

## Krok 1: kostra nástroje (~3 h)

- [ ] Workspace `tools/demo-data` (`package.json`, `tsconfig`, přidat do `workspaces` v kořenovém `package.json`).
- [ ] Načtení konfigurace z prostředí, srozumitelná chyba, když něco chybí (hlavně `DEMO_PASSWORD`).
- [ ] CLI: `seed`, `wipe`, `status`, `--dry-run`, `--yes`, `--scale`. Ochrana: proti produkci bez `--yes` konec,
      `--scale` na produkci zakázaný.
- [ ] HTTP klient s cookies (přihlášení přes `POST /api/auth/login`, session cookie pro další volání).
- [ ] Malý SQL modul (`pg`) pro identity / catalog / community DB, každý dotaz s komentářem proč.
- [ ] `typecheck` v CI (kořenový `npm run typecheck` ho vezme automaticky přes workspaces).

**Hotovo, když:** `npm run demo -w tools/demo-data -- status` lokálně vypíše nuly.

## Krok 2: uživatelé (~2 h)

- [ ] Fixtura uživatelů (jméno, e-mail `@demo.assetstore.test`, role, stav).
- [ ] `POST /api/auth/register`; když už existuje, jen přihlásit.
- [ ] SQL: `demo_admin` → `ADMIN`, `demo_suspended` → `SUSPENDED`.
- [ ] `status` počítá demo uživatele.

**Hotovo, když:** dva běhy `seed` za sebou dají pořád ~12 uživatelů a jde se za ně přihlásit na webu.

## Krok 3: soubory a assety (~5 h)

- [ ] Generátory souborů bez závislostí (Node `zlib` a `Buffer`):

  | Formát | Obsah |
  |---|---|
  | PNG | barevný vzor |
  | WAV | tón |
  | GLB | kostka |
  | ZIP | stored, bez komprese |
  | TMX | malá mapa |
- [ ] Fixtura ~60 assetů: všech 5 typů, ruční názvy a popisy, okrajové případy (dlouhý název, diakritika,
      prázdný popis, 2000 znaků).
- [ ] Nahrání přes `POST /api/assets` jako vlastník (multipart). Existující asset (stejné jméno a vlastník)
      se přeskočí.
- [ ] SQL: `created_at` do posledních 60 dní, `download_count`.
- [ ] Test (v CI): každá fixtura má typ z `ASSET_TYPES`, příponu z whitelistu catalogu, název do 100 a popis
      do 2000 znaků, soubory dohromady do 20 MB.

**Hotovo, když:** katalog na lokálu ukazuje ~60 assetů, stažení vrací skutečný soubor a „My assets“ u
nejaktivnějšího autora má 2 stránky.

## Krok 4: reporty (~2 h)

- [ ] Fixtura ~10 reportů (asset, autor, důvod, komentář, zamítnout ano/ne).
- [ ] `POST /api/assets/:assetId/reports` jako běžný uživatel, pak `POST /api/reports/:id/reject` jako
      `demo_admin`.
- [ ] Idempotence: stejný autor + asset se nehlásí znovu.

**Hotovo, když:** v `/admin/reports` je fronta otevřených reportů a pár zamítnutých.

## Krok 5: `wipe` a `status` (~2 h)

- [ ] `wipe` v pořadí:
  1. reporty na demo assety (SQL v community);
  2. demo assety přes `DELETE /api/assets/:id` jako vlastník (smaže i soubory v S3);
  3. demo uživatelé (SQL v identity).
- [ ] Před mazáním vypsat počty; na produkci bez `--yes` konec.
- [ ] `status` vypíše uživatele, assety a reporty.

**Hotovo, když:** `seed` → `wipe` → `status` dá nuly a v S3 nezůstanou soubory demo assetů.

## Krok 6: server a dokumentace (~3 h)

- [ ] Služba `demo-data` v `docker-compose.yml` s `profiles: [tools]` (image ze `services/Dockerfile`
      nebo vlastní malý Dockerfile).
- [ ] `DEMO_PASSWORD` do `.env` na serveru (ručně, ne do repa).
- [ ] Workflow `.github/workflows/demo-data.yml`:
  - spouští se ručně (`workflow_dispatch`), vstup `command` = `seed` / `wipe` / `status`;
  - na serveru přes SSM spustí `docker compose --profile tools run --rm demo-data <command> --yes`;
  - použije stejnou OIDC roli jako Deploy.
- [ ] Sekce v README „Demo data“: lokální spuštění, spuštění na serveru, jak data poznat a smazat.
- [ ] Rozhodnutí ke `services/identity/src/seed.ts` podle kroku 0.

**Hotovo, když:** workflow `seed` naplní produkci a `wipe` ji vrátí do původního stavu (počty před a po sedí).

## Později

Až backend bude umět následující věci, každá z nich = nový modul + fixtura + řádek ve `status` a `wipe`:

- [ ] tagy (vazba asset ↔ tag);
- [ ] preview obrázky;
- [ ] recenze a hodnocení.

## Celkem

Kroky 1–6 zaberou zhruba **17 h**. Kroky 2–4 jdou dělat paralelně, jakmile je hotová kostra (krok 1).
