# HANDOVER — ভূমি ও আমিন (ফিল্ড আমিন সংস্করণ) / Bhumi-O-Amin 2.0

> This file has everything a new developer or AI agent needs to keep working on this app.
> **Read all of it before you change any code.** The owner is not a programmer, so talk to him
> in short, simple Bengali, one step at a time.
>
> এই ফাইলে অ্যাপের সব তথ্য আছে। নতুন ডেভেলপার বা AI কাজ শুরুর আগে পুরোটা পড়বে।

Last updated: 2026-11-13

---

## 0. Quick facts

| Item | Value |
|---|---|
| App name | ভূমি ও আমিন – ফিল্ড আমিন সংস্করণ (`bhumi-o-amin-field` v2.0.0) |
| Owner / only user | **মেহেদী হাসান** (Mehedi Hasan), field amin (land surveyor), লেমুয়া বাজার, ফেনী সদর, ফেনী, Bangladesh |
| Owner phone | 01824989691 |
| Device | His own Android phone only (Chrome). Screen about 360×780. |
| Repo | https://github.com/mehedisaheb5-cpu/Bhumi-O-Amin-2.0 (**Public**) |
| Production branch | `main` (Vercel redeploys it automatically, about 2–3 minutes after a merge) |
| Live app | **https://bhumi-o-amin-2-0-l77f.vercel.app/** (use only this link; Vercel preview links need a login) |
| Hosting | Vercel Hobby (free), project `bhumi-o-amin-2-0`. `netlify.toml` is a spare config. |
| Stack | Vite 6 · React 19 · TypeScript 5.8 · Tailwind CSS 4 · vite-plugin-pwa · lucide-react |
| Node | 22 (`.nvmrc`) |
| Language of UI | Bengali (Noto Sans Bengali, bundled for offline use) |
| Backend | **None.** Offline-first PWA. Single user, no login, no server, no Firebase, no payment. |

---

## 1. Owner's rules (MUST follow) / মালিকের নিয়ম

These are the owner's standing instructions. Do not break them.

1. **Do not rebuild from scratch.** This app is a copy of the owner's older app "ভূমি ও আমিন". The copied code is the base. Improve it; do not rewrite it.
2. **Do not delete old features.** Hide them with flags only. Hidden: খতিয়ান, উত্তরাধিকার, মৌজা রেট, মৌজা ম্যাপ, পেমেন্ট, বুকিং, মার্কেটপ্লেস, GPS survey, legacy home, and so on.
3. **The চিত্র ভিত্তিক canvas (`src/components/survey/DrawingCanvas.tsx`) must behave exactly as before.** Keep snapping, the 45° magnet, Undo/Redo, autosave, ft-inch entry, plot and area logic, toolbar drag and collapse, and step order. Only the approved visual upgrade (bigger toolbar) and minimal changes for বাহু↔canvas sync are allowed.
4. **Style:** keep the old app's look: deep green `#065f46` and white, rounded cards, the same icons, Noto Sans Bengali. Upgrade only for usability: bigger buttons (48px or more), bigger text (15px or more), high contrast for sunlight, one-hand use. Premium pages use gold `#fde68a` / `#f59e0b`.
5. **Never touch the old app's Firebase project, config or data.** `src/lib/firebase.ts` has `FIREBASE_DISABLED = true`. Keep it that way. `firebase-applet-config.json` belongs to the old project; do not use it.
6. **No Firebase, server, online login or payment for now.** Supabase, Google Docs and Google Sheets are connected to the owner's account, but **must not be used**.
7. **One step at a time.** After each step:
   - report what changed (in Bengali);
   - show `npx tsc --noEmit` and `npm run build` results with their EXIT codes (fix tsc errors first);
   - give a short phone checklist;
   - wait for the owner to say **"পরের ধাপ"** (next step).
8. **Never say "পাস" (passed)** unless the owner has tested it on his phone.
9. **No commit, push or merge to `main` without the owner's explicit "হ্যাঁ" for that batch.**
10. **Use only free tools.**
11. **Ask the owner if an instruction is unclear.** He prefers multiple-choice questions in Bengali.
12. **Feni land units (owner-given, exact): ১ কানি = ২০ গন্ডা = ৩৯.৬৭ শতাংশ.** This is used in the converter and the বাহু results. Do not use the old `land-units.ts` "গন্ডা" (180 sqft) for this.
13. **Plan for later (do NOT build now):** after 10–15 days, open the app to other amins with per-user login, profile and dashboard, plus paid subscriptions. Keep the code easy to extend; for example, keep the profile in one store.

---

## 2. Run, check, deploy

```bash
npm ci                 # install (uses package-lock.json)
npm run dev            # dev server on 0.0.0.0:3000
npx tsc --noEmit       # type check (must be EXIT 0)
npm run build          # production build into dist/ (must be EXIT 0)
npm run preview        # serve dist on :4173
```

- In a sandbox with a host allowlist, start preview with `ALLOWED_HOSTS=.e2b.app,localhost npx vite preview --host 0.0.0.0 --port 4173`. `vite.config.ts` reads `ALLOWED_HOSTS` into `preview.allowedHosts`.
- Deploy: merge to `main`, and Vercel builds it with `vercel.json` (`npm ci`, `npm run build`, output `dist`, no-cache headers for `sw.js`, `index.html` and the manifest).
- After a deploy, the owner may need to fully close and reopen the PWA to get the new version (service worker update).
- The build warns about a chunk larger than 700 kB (old code in `chunk-survey-mouza`). This is expected and harmless.

### How changes were tested so far
- `tsc` and `build` after every change.
- Headless Chromium tests at 360×780. These used `@sparticuz/chromium` and `puppeteer-core` installed in `/tmp`, with `LD_LIBRARY_PATH` pointing to the extracted `al2023` libs. Data was seeded through `localStorage`, buttons were clicked, and screenshots were checked.
- Each headless run uses a fresh browser profile, so seed data inside the same run.
- **Gotcha:** do not open `indexedDB.open('fa-bhumi')` without a version from test code before the app does. It creates an empty v1 DB. `faDb.ts` self-heals by bumping the version.

---

## 3. Project map (important files only)

```
src/
  App.tsx                      Screen router (state + URL hash), flags SHOW_LEGACY_HOME / SHOW_LEGACY_MAP_LINKS
  index.css                    Tailwind 4 + @theme --font-sans = Noto Sans Bengali (do not remove)
  types.ts                     SurveyRecord, SurveyPlotRecord, DrawingSegment, PlotMeta, SurveyDrawing, SurveyReportRecord …
  assets/fonts/                NotoSansBengali-{Bengali,Latin}.woff2 + OFL.txt (imported with ?url)
  components/
    Header.tsx                 Top bar with ☰ (SHOW_LEGACY_HEADER_ACTIONS=false)
    BottomNav.tsx              4 tabs: হোম · দখল পরিমাপ · কনভার্টার · রিপোর্ট
    SurveyScreen.tsx           দখল পরিমাপ: tabs বাহুভিত্তিক / চিত্র ভিত্তিক / সংরক্ষিত
                               (SHOW_LEGACY_BAHU=false, SHOW_GPS=false); #drawing-info-strip with "← বাহু" and "✓ সম্পন্ন"
    survey/DrawingCanvas.tsx   চিত্র ভিত্তিক canvas (PROTECTED — see rule 3). Saves to localStorage bhumi_possession_drawing_v1
    fieldamin/
      FieldHomeScreen.tsx      Home: big cards (দখল পরিমাপ, হ্যান্ড ম্যাপ, রিপোর্ট), stats, live time, English and Bangla dates, season
      SidePanel.tsx            ☰ panel: photo, name, phone (tap to call), address, Facebook, menu
      SideMeasureWizard.tsx    New বাহুভিত্তিক flow: customer info page → sides page (N/S/E/W ft+inch, optional diagonal)
      ConverterScreen.tsx      Unit converter (Feni কানি/গন্ডা, recent list)
      HandMapScreen.tsx        হ্যান্ড ম্যাপ (hand-drawn style sketch, edit sheet, PNG save/share, "রিপোর্টে যোগ")
      ComingSoonScreen.tsx     Placeholder (used for এডমিন until Step 8)
    report/
      SurveyReportScreen.tsx   Report screen (list + preview); renders ReportDocumentA4
      ReportDocumentA4.tsx     A4 2-page editable report; drawing section uses ResizableFigure
      ResizableFigure.tsx      Drawing in the report: grab any corner to resize, drag inside to move (view only)
  lib/
    bahuDraftStore.ts          বাহু draft, calculations, বাহু→canvas handoff, canvas→বাহু sync, reportDrawingFor()
    plot-measure-utils.ts      computePlotCoordinates(n,s,e,w,unit,diag?,choice) → A(NW) B(NE) C(SE) D(SW)
    survey-report-utils.ts     Report records (localStorage bhumi-amin-reports)
    handmapRender.ts           SVG renderer for hand map (340×452 viewBox, label collision avoidance)
    handmapStore.ts            Hand map edits/options, PNG export, saveHandMapForReport()
    faDb.ts                    IndexedDB "fa-bhumi" (stores: handmaps, kv), self-healing version bump
    profileStore.ts            Owner profile (fa_profile_v1) with defaults
    banglaDate.ts              toBnDigits, banglaDate (1 বৈশাখ = 14 April; year = gy − 593), formatNow
    print-utils.ts             printWithNoto() — waits for the Noto font, then window.print()
    firebase.ts                FIREBASE_DISABLED = true (keep)
design-previews/               Approved HTML design mockups 01–10 + DESIGN-SUMMARY.md (the design source of truth)
public/                        PWA icons, _headers
vite.config.ts                 PWA config (globPatterns include woff2), preview.allowedHosts from ALLOWED_HOSTS
```

### Screen ids (App.tsx)
`home`, `measure_root`, `possession`, `reports`, `converter`, `handmap`, `admin`, plus hidden legacy screens (`khatian`, `inheritance`, `dalil`, `mouza_rates`, `services`, `profile`, `maps_and_drawings` …).
Hash shortcuts: `#measure`, `#reports`, `#converter`, `#handmap`, `#admin`.

---

## 4. Data storage

**localStorage** (small data):

| Key | What |
|---|---|
| `bhumi_surveys` | Saved surveys (`SurveyRecord[]`). বাহু surveys have id prefix `fa-bahu-`; `survey.drawing` holds the canvas snapshot taken at completion |
| `bhumi_possession_drawing_v1` | Canvas drawing `{segments, plots, updatedAt}` (one global canvas) |
| `fa_bahu_draft_v1` | Current বাহু draft (info, plots, status) |
| `fa_bahu_handoff_v1` | Link between the draft and the canvas (draftId, sidesSig, canvasSig, ringMap …) |
| `bhumi-amin-reports` | Report records |
| `bhumi_report_edits_<reportId>` | Edited fields of an A4 report |
| `fa_report_figure_v1` | Report drawing size and position, keyed by `rep:<reportId>` and `srv:<surveyId>` |
| `fa_handmap_v1` | Hand map edits and options |
| `fa_profile_v1` | Owner profile (name, phone, address, Facebook, photo) |
| `fa_converter_recent_v1` | Converter recent list |
| sessionStorage `fa_bahu_msg`, `fa_bahu_sync_note` | One-time messages shown on the বাহু page |

**IndexedDB** `fa-bhumi` (v1+): store `handmaps` holds `{id: recordId, surveyId|null, png: Blob, …}`; store `kv` is reserved. Helpers: `idbPut`, `idbGet`, `idbGetAll`, `idbDelete`.

Decision: the canvas keeps saving to localStorage. Reports, hand-map images and the logo go to IndexedDB.

---

## 5. How দখল পরিমাপ works now

1. **বাহুভিত্তিক** (`SideMeasureWizard`):
   - Page 1 is customer info. Required: নাম, মৌজা, দাগ. Optional: ফোন (`01` + 9 digits), জে.এল., খতিয়ান, থানা. Defaults: জেলা = ফেনী, তারিখ = today.
   - Page 2 is sides: উত্তর/দক্ষিণ/পূর্ব/পশ্চিম in ফুট + ইঞ্চি, plus an optional কর্ণ (diagonal).
   - Area = (উ+দ)/2 × (পূ+প)/2, or Heron's formula when the diagonal is given.
   - Several plots are allowed, everything autosaves, and "✓ সম্পন্ন" saves the survey and opens the report.
2. **"চিত্র ভিত্তিক-এ খুলুন"**: the বাহু drawing and customer info are written to the canvas (`handoffToCanvas`).
3. **Canvas → বাহু sync** (`syncCanvasIntoDraft`) runs when leaving the canvas tab, on unmount, or on "✓ সম্পন্ন":
   - Length changes on বাহু plots and dag numbers are copied back.
   - **New 4-sided plots drawn on the canvas are added as new বাহু plots.** Sides without a length stay empty for the owner to fill in.
   - Plots deleted on the canvas are removed.
4. **Canvas "✓ সম্পন্ন"** (`#drawing-complete`):
   - If the canvas is linked to a বাহু draft: sync, then check all plots. An incomplete plot sends the owner back to the বাহু page with a message. Otherwise it saves the survey (with the canvas snapshot) and opens the report.
   - If the canvas has no linked draft: it creates a new draft from the canvas plots (`newDraftFromCanvas`) and opens the customer-info page first. "✓ সম্পন্ন" there then opens the report.
5. **Report drawing source** (`reportDrawingFor(surveyId)`), in this order:
   1. the live canvas, if it is linked and the বাহু sides did not change after it;
   2. otherwise a drawing built from the বাহু sides;
   3. otherwise the survey's saved `drawing` snapshot;
   4. otherwise the plots;
   5. otherwise the old global canvas.

Limits:
- Only 4-sided closed rings count as plots, the same as the canvas.
- A new plot whose corner touches the middle of another line (a T-junction) is not detected.
- If বাহু sides are edited after drawing, the report uses a drawing rebuilt from the sides, not the hand-drawn shape.

---

## 6. Status of the steps (roadmap)

| Step | What | Status |
|---|---|---|
| 0 | Audit of copied code | ✅ done |
| 1 | Design previews (`design-previews/`) | ✅ approved by owner |
| 2 | Name, PWA, Firebase disabled, icons, bundled font | ✅ merged (PR #1), phone ✅ |
| 3 | Side panel (☰), 4-tab bottom nav, converter, Back button handling | ✅ merged (PR #2), phone ✅ |
| 4 | New home, hide unneeded features | ✅ merged (PR #3), phone ✅ |
| 5 | দখল পরিমাপ: new বাহু flow + বাহু↔canvas sync | ✅ merged (PR #3), phone ✅ |
| 6 | হ্যান্ড ম্যাপ | ✅ merged (PR #4), owner said steps 1–6 are OK on the phone |
| 6+ | Report drawing: resize/move | ✅ merged (PR #5), first version |
| 6++ | Canvas "✓ সম্পন্ন" → report, new canvas plots sync to বাহু, smoother corner resize (no frame), bold ft-inch labels with a gap | ✅ merged to `main` together with this handover (tested headless). ⚠️ **Not yet phone-tested by the owner** — ask him to check it first. |
| 7 | **রিপোর্ট** (next) | ⏳ to do |
| 8 | **এডমিন + PIN + ব্যাকআপ** | ⏳ to do |
| 9 | **প্রোফাইল/যোগাযোগ + কাজের ক্যালেন্ডার** | ⏳ to do |
| 10 | Offline test + "Add to Home screen" check | ⏳ to do |

---

## 7. Specs for the remaining steps

### Step 7 — রিপোর্ট (design `07-report.html`, option B + C's 3 steps)
- Three steps: **যাচাই → দেখুন → পাঠান**.
- A4 page (794×1123 px).
- Contents: amin name, date, স্থান/মৌজা, দাগ, party name, sides, area, the drawing, **the hand map**, and a signature box.
- The header shows the owner's name and phone by default (from `profileStore`).
- **Show the stored hand map:** read IndexedDB `fa-bhumi` / `handmaps` with `idbGetAll()`, filter by `surveyId`. Canvas items have `surveyId: null` and id `canvas:<ringId>`.
- Output as **PDF and PNG**, with download, print, and share (Android share sheet / WhatsApp via `navigator.share` with files, falling back to download).
- The Bengali font must be embedded so it works offline. `printWithNoto()` already waits for the font.
- Keep the report drawing's resize/move (`ResizableFigure`) and its saved transform.

### Step 8 — এডমিন (designs `08-pin.html` C, `09-admin.html` B + C)
- **PIN:**
  - 4–6 digits, set on first use and changeable.
  - Stored only as salt + SHA-256 hash (Web Crypto).
  - Keypad with English digits and a 👁 show button.
  - 5 wrong tries lock it for 30 seconds; it auto-locks after 5 minutes.
  - Recovery code.
- **Reports:** view, search (date / দাগ / party), delete (with 5-second undo).
- **Settings:** name, address, phone, logo (resized to 256px, stored in IndexedDB), report header and footer. These replace the defaults in `profileStore`.
- **Backup:** JSON export and import (all localStorage keys above plus IndexedDB, no PIN), a "ব্যাকআপ নিন" button, and a gentle reminder if no backup has been taken for 7 days.

### Step 9 — প্রোফাইল + কাজের ক্যালেন্ডার (design `10-calendar.html` B + C)
- **Profile page:** only the owner's own details for now.
- **Calendar:** book measurements by day and place, with client name, address and phone (`01` + 9 digits).
  - Stats: আজ / এই সপ্তাহে / বাকি পাওনা.
  - Views: সপ্তাহ / তালিকা (আজ, আগামীকাল, এই ৭ দিনে, পরে, plus search) / মাস.
  - Call and WhatsApp buttons; a gold "+ নতুন বুকিং" button.
  - Clash warning when two bookings are within 90 minutes; 5-second undo on delete; `.ics` export.
  - Data in IndexedDB.
  - Add a menu item in the side panel and a "আজকের কাজ" card on the home screen.

### Step 10
- Offline test: airplane mode, then reload, measure, report, hand map.
- Add to Home screen check on Android.
- Optional cleanup: `.env.example`, `public/p2-version.txt`.

### Other open items
- The camera badge only shows a toast (planned with Step 8).
- In the hand map, side lengths and area are not editable (tapping shows a toast). This is by design: they come from the measurement.

---

## 8. Default profile (editable later in এডমিন)

- Name: মেহেদী হাসান · Title: আমিন · District: ফেনী
- Phone: 01824989691 (tap to call)
- Address: লেমুয়া বাজার, ফেনী সদর, ফেনী
- Facebook: Mehedi Saheb — https://www.facebook.com/share/1CaTSzyAqy/

## 9. Unit reference (converter)

- Length, in feet per unit: লিংক 0.66, হাত 1.5, গজ 3, মিটার 3.28084, চেইন 66.
- Area, in sqft per unit: শতাংশ 435.6, কাঠা 720, বিঘা 14400, একর 43560, অযুতাংশ 4.356, বর্গমিটার 10.76391.
- Feni: 1 কানি = 39.67 শতাংশ = 17,280.252 sqft; 1 গন্ডা = 864.0126 sqft.

---

## 10. Known pitfalls

- Bengali text containing য় / ড় / ঢ় may be stored in decomposed Unicode in some files, so exact-string find/replace can fail. Search with a shorter ASCII or anchor string.
- Generic CSS on `span` leaks into old components. Use scoped or child selectors.
- Do not remove the Tailwind 4 `@theme` font override in `index.css`.
- `#report-printable-area` uses CSS `zoom` on phones. Pointer math in `ResizableFigure` divides by `getBoundingClientRect().width / offsetWidth`.
- Draft reports get a new id on every open. That is why the report-drawing transform is also saved by survey id.
- Every canvas save overwrites `bhumi_possession_drawing_v1`. There is only one canvas, shared by all customers. The link to a customer is in `fa_bahu_handoff_v1`.
