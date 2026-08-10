# Karma Hyundai Google Sheet Request v1.3

## New in this version
Vertical-based approval routing.

- Sales → imran@karmahyundai.com
- Service → groupgm.service@karmahyundai.com
- Backend / Other Departments → kashish@karmahyundai.com OR armaan@karmahyundai.com

The requester selects the vertical. The backend selects the approver.

## Approval roles
- USER
- VERTICAL_HEAD
- ADMIN
- SUPERADMIN

`VERTICAL_HEAD` is derived automatically from `VERTICAL_MASTER`.

## Data tabs
- USER_MASTER
- SHEET_REQUESTS
- VERTICAL_MASTER

`setupSystem()` upgrades v1.2 by appending vertical-routing columns without deleting existing requests.

## Hosting
- GitHub → Netlify frontend
- Netlify Function → Apps Script backend
- Apps Script runs as the central Google deployment owner
- Approved Sheet remains Restricted
- Requester receives Editor access
