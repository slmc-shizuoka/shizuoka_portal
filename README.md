# ShizuokaPortal

Personal workspace portal with shortcuts, calendar, performance tracking, to-dos, memos and a local image gallery.

## Cloudflare

The site is a static PWA. No build command is required.

- Cloudflare Pages build command: leave blank
- Build output directory: `dist`

It can also be deployed with Wrangler:

```sh
npx wrangler deploy
```

PWA installation and offline support require HTTPS. Cloudflare provides HTTPS automatically after deployment.
