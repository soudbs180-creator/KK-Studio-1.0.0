# KK Admin VPS Deployment

1. Create a non-root deployment user on the VPS and install Node 24 plus Nginx.
2. Build the admin app with `cmd /c npm run admin:build`.
3. Copy `apps/admin/dist` to `/var/www/kk-admin/dist`.
4. Run the API with `cmd /c npm run api:start`.
5. Install `deploy/nginx/kk-admin.conf` as the site config and reload Nginx.
6. Set `VITE_KK_ADMIN_URL` in the main frontend so the login page redirects to the VPS-hosted admin site.
7. After the site is reachable, add HTTPS and disable password-based root SSH login.
