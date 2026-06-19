# Business Contact Tracker

Track outreach to businesses imported from your CSV directories. Built with
Next.js, Firebase (Auth + Firestore), and Tailwind CSS. Deploy to Vercel.

## Features

- **CSV upload** — import any `Direktori Usaha Menengah *.csv` file in batches
  into Firestore. Expected columns: `Provinsi, Kategori, Nama Usaha, Alamat Usaha, Nomor Telepon`.
- **Email/password auth** — Firestore rules restrict all reads/writes to
  signed-in users. Create the first account from the login page.
- **Per-business tracking** — statuses: Not Contacted, Contacted, Responded,
  Not Interested, Follow Up, Converted / Deal. Add notes and a contact log is
  written on every status change.
- **Filters & search** — by status, province, category, and free-text over
  name / address / phone.
- **Dashboard** — totals, progress %, status breakdown, and contacted-by-province.

## 1. Set up Firebase

1. Go to <https://console.firebase.google.com> and create a project.
2. **Build → Authentication → Sign-in method →** enable **Email/Password**.
3. **Build → Firestore Database → Create database** (start in production mode).
4. **Project settings → General → Your apps → Web (`</>`)**, register an app,
   and copy the config values.
5. **Firestore Rules** tab: paste the contents of `firestore.rules` from this
   folder and Publish.

## 2. Configure environment

Copy `.env.local.example` to `.env.local` and fill in the Firebase web config:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

## 3. Run locally

```bash
cd web
npm install
npm run dev
```

Open <http://localhost:3000>, click **Create account** on the login page to
make your admin user, then go to **Upload CSV** and import a file.

## 4. Deploy to Vercel

1. Push this repo to GitHub/GitLab.
2. In Vercel, **Import Project**. Set the **Root Directory** to `web`.
3. Add the same six `NEXT_PUBLIC_FIREBASE_*` variables under **Environment
   Variables**.
4. Deploy. After it's live, create your account and start importing.

## Notes

- Each import writes in batches of 450 (Firestore caps a batch at 500 writes).
  Keep the tab open for very large files.
- All business records and status-change logs live in the `businesses` and
  `logs` Firestore collections.
- The CSV parser is tolerant of the quoted/commas format used in the
  Direktori files (powered by PapaParse).
