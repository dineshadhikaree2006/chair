# Is This a Chair?
A small, deliberately unreliable furniture inspector. Next.js App Router, TypeScript, React, plain CSS, and Zod. No database or accounts.

## Run locally
Requires Node.js 20.9+ (Node 24 recommended) and npm.

```sh
npm install
npm run dev
```
Open http://127.0.0.1:3000. For a production run: `npm run build` then `npm start`.

## Demo in 30 seconds
Choose any of the three sample cases: sandwich, car, or actual chair. Each uses a clearly labeled text sample card and handcrafted **Scripted demo** report. Type an objection and appeal repeatedly. Demo replies remain scripted templates. With a configured Gemini key, the same structured concession detection used for real cases checks demo messages too. Without a key, demo chat stays scripted and the UI explains that the surrender button still works. Click **Inspect another** to reset.

## Real photo inspection
Copy `.env.example` to `.env.local`, replace the placeholder with your Gemini API key locally, and restart the server. Never put the key in client code or a `NEXT_PUBLIC_` variable. Environment files are gitignored.

The official `@google/genai` SDK runs exclusively on the server. `GEMINI_MODEL` defaults to `gemini-3.8-flash`, a supported vision-capable model. Set another image-input/structured-output model if needed. Official documentation: https://ai.google.dev/gemini-api/docs/models and https://github.com/googleapis/js-genai . Responses are validated with Zod.

Upload or drop one JPEG, PNG, or WebP (up to 10 MiB), then select **Inspect this object**. Real analysis sends the image itself, not its filename. Every appeal includes the actual original photo, original report, objection, and full previous conversation. Each photo receives a separate random case ID; clients cannot replace its report or history. Markers use normalized image coordinates and stay relative to the displayed image, without cropping. Confidence is fictional.

Uploads remain in server memory, with no application disk, database, or browser-storage persistence. Cases expire after 30 minutes of inactivity and are capped at 20 cases per process, 20 objections per case, and 500 characters per objection. Images are decoded and limited to 40 megapixels. Object URLs are revoked on replacement/reset. Gemini receives real uploads and its provider data policies apply. Reset clears the photo, report and thread and requests server-case deletion. An upstream request already running may finish; abandoned cases expire automatically. Server requests time out at 45 seconds. Duplicate and concurrent debate submissions are rejected. Images and objections are treated as untrusted input. Errors never substitute demo data.

The memory store is intended for this single-process local app. Restarting the server expires conversations. Multi-instance hosting needs a shared store before deployment. This folder currently has no Git repository; `.gitignore` excludes `.env.local`, but tracked-file status cannot be checked until a repository exists.

## Surrender and certificates
Click **🏳️ Surrender — fine, it’s a chair.**, or clearly accept the original verdict in chat. For the actual-chair reversal, the button says **🏳️ Surrender — fine, it’s not a chair.** Both use the same local acceptance handler: mark the inspection conceded, show one victory message, briefly celebrate (unless reduced motion is requested), and bring the certificate preview into view. Surrender preserves the conversation and allows further debate within the existing 20-message limit. Repeating surrender keeps the same certificate, date, and ID.

Chat interpretation uses Gemini's required structured `conceded` boolean, validated by Zod, alongside its response. The prompt distinguishes personal acceptance of the original verdict from negations, quotations, attribution, hypotheticals, questions, and instructions attempting to forge agreement. There is no local keyword detector. The surrender button makes no API call, including while an appeal is pending.

Certificates include the original photo (or a clearly marked DEMO sample), original funny classification, date, stable ID, resistance statement, and the number of user debate messages before surrender, excluding the surrender message. Failed submitted messages stay visible and count as objections. A pending message is counted if the button is clicked, then excluded if Gemini identifies it as the concession; the download waits until that pending decision finishes so it cannot save an incorrect count. Each PNG is rendered locally at 2400 × 1800 with browser Canvas; no certificate service receives the image. Downloads happen only when **Download certificate** is clicked. Reset clears acceptance and the certificate along with the rest of the inspection.

## Checks
```sh
npm test
npm run typecheck
npm run build
```
Tests cover file types, sizes, signatures, decoding, report shape, coordinates, scripted cases, missing credentials, and mocked Gemini route integration with two objections, image/history retention, separate cases, duplicate submissions, expiration, reset, quota errors, and malformed AI output. Concession tests exercise both verdicts, the required structured boolean, false-positive examples, malformed output, and demo fallback with a mocked provider. Certificate tests cover titles, DEMO filenames, long text, and cancellation. Real AI quality needs a configured account/key and is not established by offline tests. This is a local hackathon app, not a public service with authentication or abuse controls.

Browser regression checks use Playwright and Chrome against a running app. All API responses are intercepted, so the suite does not call Gemini:

```sh
# In one terminal, after building:
npm start -- --port 3100
# With Playwright installed (or PLAYWRIGHT_MODULE pointing to its package):
CHAIR_BASE_URL=http://127.0.0.1:3100 node --import tsx scripts/surrender-smoke.ts
```

The browser checks cover both surrender paths/verdicts, false-positive responses, repeat acceptance, continued debate, failed and pending appeals, PNG contents/download, DEMO certificates, reduced motion, reset, and mobile overflow. Screenshots and downloaded certificates are written to a temporary directory printed by the script.

To explicitly check real Gemini concession decisions with the configured key (makes model requests):

```sh
node --conditions=react-server --import tsx scripts/verify-concessions.ts
```
