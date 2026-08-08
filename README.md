# Karma Hyundai - Google Sheet Request Portal

Final architecture:

Zoho / Google split-mail user
-> Netlify portal
-> OTP authentication
-> request Google Sheet
-> Google admin approval
-> Apps Script creates the Sheet under the Google deployment-owner account
-> Sheet remains Restricted
-> exact requester email is added as Editor
-> Google visitor-sharing verification is used when the requester has no Google account.

## Hosting

Frontend:
- GitHub repository
- Netlify continuous deployment

Backend:
- Google Apps Script web app
- Execute as the Google account that should own generated Sheets

Control database:
- Google Sheet with only:
  - USER_MASTER
  - SHEET_REQUESTS

## Repository layout

/public
  index.html
  styles.css
  app.js

/netlify/functions
  api.mjs

/google-apps-script
  Code.gs
  appsscript.json

netlify.toml
.gitignore
.env.example
IMPLEMENTATION_STEPS.md

## Why the Netlify Function is included

The browser does not call Apps Script directly.

Instead:

Browser
-> /.netlify/functions/api
-> Apps Script

The private Apps Script `API_SECRET` is stored in Netlify Environment Variables and inserted server-side.

Never put that secret in `public/app.js`, GitHub source, or HTML.
