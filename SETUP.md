# Getting Backstory onto your iPhone + turning on the spotlights

## 1. Host it

A PWA can only be "Added to Home Screen" properly, and can only receive push
notifications, from a real HTTPS URL (not a local file). This project is
built for **Vercel** (static frontend + the `/api` functions in one place):

1. Push this folder to a new GitHub repo (see step 4 below for a walkthrough
   if you haven't done this before).
2. Go to [vercel.com/new](https://vercel.com/new) → import the repo → deploy
   with default settings (no build command needed, it's static + `/api`).
3. Your app is live at `https://<project-name>.vercel.app`.

## 2. Add it to your Home Screen

1. Open the URL from step 1 in **Safari** on your iPhone (must be Safari —
   Chrome on iOS can't install PWAs or register for push).
2. Tap the **Share** icon → **Add to Home Screen**.
3. It now opens full-screen, no Safari chrome, with its own icon.

Everything you read/save is stored locally on your phone (localStorage) —
nothing is synced to a server except your push subscription.

## 3. Turn on push notifications (2-4x/day spotlights)

### Create the storage + secrets on Vercel

1. In your Vercel project → **Storage** tab → **Create Database** → **Blob**
   → connect it to this project. This auto-adds a `BLOB_READ_WRITE_TOKEN`
   env var — nothing to copy manually. The store is private; the only thing
   ever written to it is your push subscription (endpoint + keys), so the
   app can send you notifications.

2. Project → **Settings → Environment Variables**, add:
   - `APP_SECRET` — a random string only you and the app know (shared with
     you in chat, not committed to git for obvious reasons)
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — the Web Push keypair (also
     shared in chat)
   - `VAPID_SUBJECT` — `mailto:your-email@example.com` (any email, required
     by the Web Push spec, not used for anything else)

   Prefer to generate your own instead of the ones I generated? Run locally:
   ```
   npx web-push generate-vapid-keys        # VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
   node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"   # APP_SECRET
   ```
   If you generate your own `VAPID_PUBLIC_KEY`, also update the
   `VAPID_PUBLIC_KEY` constant at the top of `app.js` to match — the client
   needs the public half too, to subscribe.

3. **Redeploy** (Vercel prompts for this automatically after settings
   changes, or trigger one from the Deployments tab).

### Set up the free scheduler (GitHub Actions)

The workflow at `.github/workflows/notify.yml` pings `/api/notify` 4x/day —
GitHub Actions is used instead of Vercel's own Cron because the free Hobby
plan limits Cron to once/day.

4. Repo → **Settings → Secrets and variables → Actions**, add:
   - `APP_URL` — your Vercel deployment URL, e.g.
     `https://backstory-yourname.vercel.app`
   - `APP_SECRET` — the same value as step 2

### Turn it on in the app

5. In the app: **Settings (⚙)** → paste the same `APP_SECRET` into
   **Sync key** → **Save key** → **Enable notifications** → accept the iOS
   permission prompt.

That's it — you'll now get pushed a new company spotlight a few times a day,
tapping one opens straight to that story.

## 4. Notification schedule

Defined in `.github/workflows/notify.yml`, currently ~9:30 AM / 1:30 PM /
5:30 PM / 9:30 PM **IST** (cron times in the file are UTC). Want 2 or 3
slots instead of 4? Just delete the schedule lines you don't want.

You can trigger a test push manually any time: repo → **Actions** →
"Backstory spotlights" → **Run workflow**, pick a slot.

## 5. Adding more case studies later

Everything lives in `data/case-studies.json` — one object per company. Ask
me (in a future session, referencing this project) to add another batch and
I'll append to that file in the same format; no code changes needed. The
notification/spotlight rotation adapts automatically as the list grows.

## Notes / limits

- GitHub Actions schedules can drift a few minutes and may pause if the repo
  goes fully inactive for 60 days (any commit resets that clock).
- This is single-user by design (one shared secret, one push subscription) —
  not meant to scale beyond your own phone.
- Facts in the case studies come from general knowledge, not a fresh
  research pass per company — treat them as "well-known public history,"
  not verified journalism. Flag anything that looks off and I'll fix it.
