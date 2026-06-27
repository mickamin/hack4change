# AgroPool — kontekst przekazania (hackathon)

## Co to za projekt
Apka łącząca **nadwyżki plonów** z **odbiorcami** i **transportem**, żeby ograniczyć food waste i puste przebiegi. Region: Powiat Kartuski (Pomorskie).
Repo: `https://github.com/mickamin/hack4change` · branch: **`przewoznicy`** (tu pracuje Piotr).
Kolega (Michał) robi apkę rolnika na **main**.

## GDZIE PRACUJEMY (ważne!)
- **Folder roboczy: `C:\Users\asusr\hack4change`** — TU uruchamiamy, tu są wszystkie zmiany.
- `E:\hack4change` i `E:\hack4change-main` to MARTWE klony (dysk exFAT, brak miejsca, `npm install` nie przechodzi). NIE używać. Można usunąć: `Remove-Item -Recurse -Force E:\hack4change`.
- Stack: Next.js 16.2.9 (Turbopack), React 19, TypeScript strict, Leaflet, Supabase, PWA.

## JAK ODPALIĆ
```
cd C:\Users\asusr\hack4change
npm run dev        # node_modules juz zainstalowany
```
→ http://localhost:3008  (port ustawiony w package.json: `next dev -p 3008`)
VS Code: File → Open Folder → C:\Users\asusr\hack4change, terminal Ctrl+`, `npm run dev`.

## ARCHITEKTURA — jedna apka, 3 role
- `/`            → ekran wyboru roli (app/page.tsx) — Rolnik / Przewoźnik / Dystrybutor
- `/rolnik`      → apka Michała skopiowana 1:1 (app/rolnik/page.tsx)
- `/przewoznik`  → pusty kurs + dopasowanie nadwyżek po trasie (app/przewoznik/page.tsx)
- `/dystrybutor` → popyt (produkt+ilosc+lokalizacja) → gminy z dostepna uprawa (app/dystrybutor/page.tsx)

## PLIKI DODANE/ZMIENIONE PRZEZ PIOTRA (branch przewoznicy)
- app/page.tsx                     — NADPISANY: ekran wyboru roli (3 przyciski)
- app/rolnik/page.tsx              — kopia 1:1 dawnego app/page.tsx (apka rolnika)
- app/przewoznik/page.tsx          — flow przewoznika (3 akty: hook → formularz → mapa)
- app/api/empty-runs/route.ts      — POST: kurs → dopasowane odbiory + CO2/wartosc
- utils/emptyRuns.ts               — matchEmptyRun: korytarz trasy (punkt-do-odcinka), haversine
- app/dystrybutor/page.tsx         — flow dystrybutora (3 akty)
- app/api/distributors/route.ts    — POST: popyt → gminy z uprawa
- utils/distributors.ts            — matchDemand: CROP_AVAILABILITY wg odleglosci
- package.json                     — dev na porcie 3008

Wszystkie dane na razie z mocka kolegi: app/api/data/mockData.ts (FARMERS, CROP_AVAILABILITY, TERYT_COMMUNES, EMISSIONS, ROUTE_CONSTANTS, WHOLESALE_PRICES_EXTENDED).

## STATUS
- Typecheck calego projektu (`node node_modules/typescript/bin/tsc --noEmit`) — 0 bledow.
- Logika dopasowania przewoznika przetestowana (5/5 na realnych wspolrzednych).
- NIE zacommitowane jeszcze (do zrobienia): `git add . && git commit -m "..." && git push`.

## RZECZY DO NAPRAWIENIA / TODO (nastepna sesja)
1. Sprawdzic w przegladarce, ze /przewoznik i /dystrybutor faktycznie rysuja mape z punktami (bylo blokowane przez wczesniejszy uszkodzony app/page.tsx — juz naprawione, ale trzeba zweryfikowac wizualnie).
2. UX "Start": teraz resetuje flow danej roli. Decyzja: czy ma wracac na ekran wyboru (/) — wtedy dorobic.
3. Prawdziwe dane zamiast mocka: nadwyzki/uprawy z Supabase (jest juz utils/supabaseClient.ts + /api/crops).
4. Katalog przewoznikow z KREPTD (kreptd.gitd.gov.pl, otwarty) + KRS PKD 49.41 — jeszcze nie zbudowane.
5. Modul odbiorcow z KRS (utils/krs.ts, /odbiorcy, /api/buyers) byl zrobiony na starym ZIP-ie E: — przepadl przy usuwaniu. Do odtworzenia, jesli potrzebny (filtr PKD roslinny 10.31/32/39/41/61/62, 46.21/46.31; seed: Farm Frites KRS 0000152098, Hortino KRS 0000024290).
6. Merge z mainem Michala: app/page.tsx bedzie konfliktowac (on ma rolnika na /, my mamy ekran wyboru). Ustalic: nasz ekran wyboru wchodzi na /, jego flow zostaje na /rolnik.

## GIT — szybka sciaga
- Commit: `git add . && git commit -m "opis" && git push`
- Zaciagnac maina Michala do swojego brancha: `git fetch origin` potem `git merge origin/main`
- safe.directory juz ustawione dla C:\Users\asusr\hack4change

## RESEARCH (zrodla danych, zweryfikowane)
- KRS open API: api-krs.ms.gov.pl/api/krs/OdpisAktualny/{krs}?rejestr=P&format=json — bez tokena, JSON. Tylko po numerze KRS (brak wyszukiwania po PKD — seed numerow z bulku dane.gov.pl).
- KREPTD (przewoznicy): kreptd.gitd.gov.pl — otwarty, szukanie po lokalizacji, bulk na dane.gov.pl.
- Rolnik: zwykle BEZ NIP (rolnik ryczaltowy = PESEL), poza CEIDG → strona dostawcow musi byc self-service.
- Adresow rolnikow nie da sie wyciagnac publicznie (WPR = tylko gmina+kod; ARiMR EP zamkniete; RODO).
- Banki zywnosci (eskalacja): 31 bankow, Federacja, adresy publiczne; Gdansk = al. Hallera 239.

## UWAGA TECHNICZNA (dla asystenta)
Plik-tool (Write/Edit) na mouncie `C:\Users\asusr\hack4change` UCINA pliki / dodaje null-bajty. Pisac przez bash heredoc (`cat > plik <<'EOF' ... EOF`) i weryfikowac `tsc --noEmit`.
