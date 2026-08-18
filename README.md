# FreshTrack — GitHub Pages + Supabase

This version is shared across devices.

## How it works

GitHub Pages hosts the static website. Supabase provides:

- shared Postgres database
- employee authentication
- Row Level Security (RLS)
- Realtime database updates

Every authenticated employee sees the same inventory.

## Files

- `index.html`
- `styles.css`
- `app.js`
- `config.js`
- `setup.sql`

## 1. Create a Supabase project

Create a project at Supabase.

## 2. Build the database

In your Supabase project:

1. Open **SQL Editor**
2. Create a new query
3. Paste all of `setup.sql`
4. Run it

This creates the `inventory_items` table, enables RLS, allows only authenticated users to work with the shared inventory, and enables Realtime for the table.

If the final `alter publication` line says the table is already part of `supabase_realtime`, that is harmless.

## 3. Get your Project URL and key

In the Supabase dashboard, find your project's API settings.

Copy:

- Project URL
- Publishable key

Use the publishable key (or legacy anon key if your project displays that terminology).

DO NOT use a secret key or `service_role` key in this website.

## 4. Edit `config.js`

Replace:

```js
SUPABASE_URL: "YOUR_SUPABASE_PROJECT_URL",
SUPABASE_PUBLISHABLE_KEY: "YOUR_SUPABASE_PUBLISHABLE_KEY"
```

with your actual values.

## 5. Configure authentication

FreshTrack uses email/password accounts.

By default, hosted Supabase projects generally require new users to confirm their email.

You can create an account from the FreshTrack sign-up screen and confirm the email.

For a real workplace, consider creating the accounts you need and then disabling open sign-ups so random visitors cannot register themselves.

## 6. Configure your GitHub Pages URL in Supabase

Once GitHub Pages gives you your final URL:

1. In Supabase, open your Auth URL configuration.
2. Set the Site URL to your GitHub Pages website.
3. Add the GitHub Pages URL as an allowed Redirect URL if you use email confirmation links.

Example format:

`https://USERNAME.github.io/REPOSITORY/`

## 7. Deploy to GitHub Pages

Upload these files to the root of your GitHub repository:

- `index.html`
- `styles.css`
- `app.js`
- `config.js`

You may also keep `setup.sql` and this README in the repository.

Then:

1. Go to repository **Settings**
2. Open **Pages**
3. Choose **Deploy from a branch**
4. Select the main branch
5. Select `/ (root)`
6. Save

## Testing sync

1. Sign into FreshTrack on your computer.
2. Sign into another employee account on your phone.
3. Add an item on one device.
4. It should appear on the other device automatically.

If it does not appear automatically but appears after refresh, check that Realtime / Postgres Changes is enabled for `inventory_items`.

## Security notes

The publishable Supabase key is allowed to exist in frontend JavaScript. It does not grant unrestricted database access by itself. Access is controlled by Supabase Auth and the RLS policies in `setup.sql`.

Never put a Supabase secret key or service-role key in a GitHub Pages repository.

## Current permissions

Any signed-in employee can:

- see all inventory
- add an item
- mark an item complete

Items are not hard-deleted; completion is recorded so history remains available in the database.

## Good next upgrades

- manager vs employee roles
- product shelf-life presets stored in Supabase
- edit/correct an item
- completion/history screen
- QR codes
- store/location support
- audit log showing which account created/completed each item
- manager-only employee onboarding
