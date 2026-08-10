# Karma Hyundai Google Sheet Request
## Version 1.3 — Vertical Approval Routing

This is an upgrade to the current GitHub + Netlify deployment. You do **not** need a new Netlify site, a new GitHub repository, or a new control Google Sheet.

## Final routing

| Vertical | Approver(s) |
|---|---|
| Sales | imran@karmahyundai.com |
| Service | groupgm.service@karmahyundai.com |
| Backend / Other Departments | kashish@karmahyundai.com OR armaan@karmahyundai.com |

For Backend / Other Departments, both authorised heads receive the request. The **first approval or rejection completes the request**.

`ADMIN` and `SUPERADMIN` remain fallback/oversight approvers and can act on any request.

---

## Roles

- `USER` — submit requests; see own requests.
- `VERTICAL_HEAD` — submit requests; see/approve only requests routed to their email.
- `ADMIN` — see/approve all requests.
- `SUPERADMIN` — see/approve all requests.

A `VERTICAL_HEAD` role is derived automatically from `VERTICAL_MASTER`. You do not need to manually add Imran, Group GM Service, Kashish or Armaan to USER_MASTER just to give them vertical approval rights.

`USER_MASTER` continues as an **admin + exception list**:
- ADMIN / SUPERADMIN
- INACTIVE / blocked emails
- optional name overrides

Ordinary `@karmahyundai.com` users do not need to be listed.

---

# 1. BACK UP THE CONTROL SHEET

Before changing production:

1. Open `KH - Google Sheet Request Control`.
2. File → Make a copy.
3. Keep the copy as rollback backup.

---

# 2. REPLACE APPS SCRIPT CODE

Use:

`google-apps-script/Code.gs`

Replace the current **entire** `Code.gs`.

Use the supplied:

`google-apps-script/appsscript.json`

Important:
- Drive appears only once under `enabledAdvancedServices`.
- `userinfo.email` is included.
- Do not separately create a duplicate Drive service entry.

---

# 3. RUN setupSystem()

From Apps Script run:

`setupSystem()`

This is designed to upgrade the existing workbook.

It will create/verify:

1. `USER_MASTER`
2. `SHEET_REQUESTS`
3. `VERTICAL_MASTER`

It will **not delete existing SHEET_REQUESTS rows**.

It appends these three new columns at the end of `SHEET_REQUESTS` if they are missing:

- `VERTICAL`
- `APPROVER_EMAIL_1`
- `APPROVER_EMAIL_2`

The existing v1.2 columns remain in place.

---

# 4. VERIFY VERTICAL_MASTER

The setup seeds:

| VERTICAL | APPROVER_EMAIL_1 | APPROVER_NAME_1 | APPROVER_EMAIL_2 | APPROVER_NAME_2 | STATUS | SORT_ORDER |
|---|---|---|---|---|---|---|
| Sales | imran@karmahyundai.com | Imran | | | ACTIVE | 10 |
| Service | groupgm.service@karmahyundai.com | Group GM Service | | | ACTIVE | 20 |
| Backend / Other Departments | kashish@karmahyundai.com | Kashish | armaan@karmahyundai.com | Armaan | ACTIVE | 30 |

Check each email carefully before going live.

Future changes to vertical heads are made by editing `VERTICAL_MASTER`. No code change is required.

---

# 5. UPDATE THE EXISTING APPS SCRIPT WEB DEPLOYMENT

Apps Script:

`Deploy → Manage deployments`

Open the existing Web App deployment and click Edit.

Choose **New version**.

Keep:

- Execute as: `Me`
- Who has access: `Anyone`

Deploy.

If you update the existing deployment, its `/exec` URL should remain the same. In that case no Netlify environment variable needs to change.

Google Apps Script web apps deployed as "execute as me" run as the deployment owner, so approved Sheets continue to be created under the central Google owner account.

---

# 6. UPDATE GITHUB

Replace/push:

- `public/index.html`
- `public/styles.css`
- `public/app.js`
- `google-apps-script/Code.gs`
- `google-apps-script/appsscript.json`

The Netlify Function and Netlify environment variables do not need to change.

Because Netlify is already linked to GitHub, the push will trigger a new Netlify deployment automatically.

---

# 7. USER REQUEST FLOW

The requester now sees:

1. Google Sheet Name
2. Purpose
3. Vertical / Approving Head

When they select a vertical, the portal displays who will approve it.

The requester never types or chooses an approver email. The backend resolves it from `VERTICAL_MASTER`.

On Submit, `SHEET_REQUESTS` captures the vertical and the approver email(s) that applied **at the time of submission**. This preserves the audit trail even if the vertical head changes later.

---

# 8. SALES TEST

Use any normal `@karmahyundai.com` user.

Submit:
- Sheet Name: `TEST - Sales Routing`
- Purpose: `Routing test`
- Vertical: `Sales`

Expected:
1. Request = PENDING.
2. `VERTICAL` = Sales.
3. `APPROVER_EMAIL_1` = imran@karmahyundai.com.
4. Imran receives the approval email.
5. Imran logs into the same Netlify portal by OTP.
6. His role displays `Vertical Head`.
7. His Approval Queue contains the Sales request.
8. He does not see Service or Backend requests unless separately mapped there.
9. On approval, the central Google account creates the Sheet.
10. General access remains Restricted.
11. Requester is added as Editor.
12. `ACTION_BY` = imran@karmahyundai.com.

---

# 9. SERVICE TEST

Submit:
- Vertical: `Service`

Expected approver:
`groupgm.service@karmahyundai.com`

Imran should not see the request in his vertical queue.

The Service head should see it.

---

# 10. BACKEND / OTHER TEST

Submit:
- Vertical: `Backend / Other Departments`

Expected:
- Kashish gets the request.
- Armaan gets the request.
- Both see it in their queues.

First-decision rule:
- If Kashish approves first → request becomes APPROVED; Armaan cannot reject it later.
- If Armaan rejects first → request becomes REJECTED; Kashish cannot approve it later.

The backend uses a script lock around the decision, so two simultaneous actions are serialized.

---

# 11. ADMIN / SUPERADMIN TEST

Login as an active ADMIN or SUPERADMIN.

The Approval Queue should show:

`Showing all requests — Admin/SuperAdmin oversight`

They can see and act on all verticals as fallback authority.

---

# 12. EXISTING OLD REQUESTS

Requests submitted before v1.3 will have blank:
- VERTICAL
- APPROVER_EMAIL_1
- APPROVER_EMAIL_2

They remain visible to ADMIN/SUPERADMIN.

They do **not** automatically appear in a Vertical Head's assigned queue.

For any old pending request that must be routed, manually fill those three fields in its row.

---

# 13. ADDING A NEW VERTICAL LATER

Just add a row in `VERTICAL_MASTER`.

Example:

`Finance | financehead@karmahyundai.com | Finance Head | | | ACTIVE | 40`

It will automatically:
- appear in the request dropdown,
- route new requests to the configured head,
- give that configured email Vertical Head approval access.

No code deployment is required.

---

# Security and governance

1. Requester selects only a vertical, never an approver email.
2. Routing is revalidated server-side.
3. Vertical Heads see only requests assigned to their captured approver email.
4. ADMIN/SUPERADMIN see all requests.
5. Vertical Heads do not become Google Sheet owners.
6. The Google deployment owner remains the creator/owner.
7. Generated Sheets are forced to Restricted.
8. Only the requester email is added as Editor.
9. Backend/Other is first-decision-wins between Kashish and Armaan.
10. Ordinary users do not need to be added to USER_MASTER.
11. An email explicitly listed as non-ACTIVE in USER_MASTER is blocked.
12. Existing Netlify URL remains the user-facing portal.

---

# Recommended deployment order

1. Back up the control Sheet.
2. Replace `Code.gs`.
3. Replace/verify `appsscript.json`.
4. Run `setupSystem()`.
5. Verify `VERTICAL_MASTER`.
6. Update the existing Apps Script deployment to a new version.
7. Push the revised frontend files to GitHub.
8. Wait for Netlify deployment.
9. Hard refresh the Netlify portal.
10. Test Sales.
11. Test Service.
12. Test Backend / Other.
13. Test Admin/SuperAdmin oversight.
