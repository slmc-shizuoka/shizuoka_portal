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

## Directory sync

The portal can load its Directory from a public Google Sheet. Use these header names in the first row:

```text
category,category_label,title,url,category_order,link_order,enabled
```

Set the Sheet to link-viewable or publish it as CSV, then open **Link Sync** from the portal menu and paste the Sheet URL. The built-in links remain as a fallback when the Sheet cannot be loaded. The same dialog can download the current Directory as a CSV template.

## News RSS

The News tab displays AI and Google stories from Google News RSS, while Apple stories are supplied in Japanese by iPhone Mania RSS. Results are cached in the browser for 30 minutes.
