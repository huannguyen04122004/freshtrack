# FreshTrack

A lightweight expiration-tracking dashboard for food-service teams.

## Features

- Add prepared/opened items
- Track expiration date and time
- Quick shelf-life presets
- Automatically classifies items as Good, Expiring Soon, or Expired
- "Needs Attention" section for priority items
- Search, filter, and sort inventory
- Mark items as used/discarded
- Responsive design for phones, tablets, and desktops
- Uses browser localStorage, so no backend is required for the MVP

## GitHub Pages deployment

1. Create a new GitHub repository.
2. Upload these files to the repository root:
   - `index.html`
   - `styles.css`
   - `app.js`
3. Commit and push.
4. Open your repository on GitHub.
5. Go to **Settings → Pages**.
6. Under **Build and deployment**, choose **Deploy from a branch**.
7. Select your main branch and `/ (root)`.
8. Save.
9. GitHub will provide the public website URL after deployment.

## Important MVP limitation

This version stores data in each browser using `localStorage`.

That means:
- Data stays after refreshing or closing the page.
- Data is only available on the same browser/device.
- Multiple workers on different devices will NOT share the same inventory.

For a real workplace deployment, the next step should be connecting the site to a shared database such as Supabase or Firebase.

## Suggested next upgrades

- Supabase shared database
- Employee login
- Manager/admin permissions
- Product shelf-life presets configured by managers
- QR codes for containers
- Edit item function
- Full history / audit log
- Notifications for soon-to-expire products
- Location/station management
