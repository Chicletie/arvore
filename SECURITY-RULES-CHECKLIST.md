# Security Rules Checklist

Use this checklist to audit the Firebase security boundary before making the project public or inviting additional players.

This project currently does not contain Firestore or Storage rules files in the repository. The authoritative rules may therefore be in the Firebase Console. Record the current rules and test results before changing them.

## 1. Firestore Rules

Open Firebase Console -> Firestore Database -> Rules.

- [ ] Rules are not `allow read, write: if true`.
- [ ] Rules do not allow unauthenticated writes to any collection.
- [ ] Rules do not allow unauthenticated reads of private world data.
- [ ] Every collection used by the app has an explicit rule.
- [ ] Unknown or future collections are denied by default.
- [ ] The `world` collection can only be read by authenticated users who should have access.
- [ ] The owner can write the complete world state.
- [ ] A normal player cannot write the owner's world data.
- [ ] A normal player cannot change their own permissions, role, email allow-list, or access level.
- [ ] A normal player cannot change another player's permissions.
- [ ] Public wiki documents expose only intentionally public fields.
- [ ] Secret or restricted content is not readable through a public wiki document.
- [ ] Wiki suggestions can only be created by authenticated users.
- [ ] A user can only read their own suggestions unless the owner explicitly needs broader access.
- [ ] Users cannot edit, approve, delete, or change the status of suggestions unless authorized.
- [ ] User-supplied fields have size limits where practical.
- [ ] Rules validate required field types and allowed values where practical.
- [ ] Rules reject writes with unexpected privileged fields.
- [ ] Deletes are denied unless the caller is explicitly authorized.
- [ ] The default fallback rule denies access.

Recommended final fallback shape:

```text
match /{document=**} {
  allow read, write: if false;
}
```

Do not copy this blindly into production. Place it after the specific collection rules and test every required workflow first.

## 2. Storage Rules

Open Firebase Console -> Storage -> Rules.

- [ ] Unauthenticated users cannot upload files.
- [ ] Unauthenticated users cannot list or delete files.
- [ ] Authenticated users can only upload to paths they are allowed to use.
- [ ] A player cannot overwrite or delete another player's files.
- [ ] Public wiki images are intentionally public and contain no private data.
- [ ] Private images are not downloadable by unauthenticated users.
- [ ] Uploads validate file size.
- [ ] Uploads validate content type.
- [ ] Executable or unexpected file types are rejected.
- [ ] File names and path components cannot be used to escape the intended user/entry path.
- [ ] Delete and update permissions are stricter than read permissions where needed.
- [ ] Storage rules deny access by default.

## 3. Firebase Authentication

Open Firebase Console -> Authentication.

- [ ] Email/password sign-in is enabled only if needed.
- [ ] Public sign-up is disabled if invitations are the only account creation path.
- [ ] Password reset action URLs point to the intended `reset-senha.html` page.
- [ ] Authorized domains contain only domains actually used by the app.
- [ ] The custom domain and GitHub Pages domain are reviewed separately.
- [ ] Test accounts do not use real reusable passwords.
- [ ] The owner account has a strong unique password and MFA where available.
- [ ] Deleted or former player accounts lose access immediately.
- [ ] The app does not treat a client-side email, label, or localStorage value as proof of authorization.

## 4. Cloud Function: `createPlayerAccount`

Review Firebase Console -> Functions and the source in `functions/index.js`.

- [ ] Only the intended owner UID can call the function.
- [ ] The owner UID is verified server-side, not only in the browser.
- [ ] The Brevo API key exists only in Secret Manager.
- [ ] The Brevo API key is not present in frontend files, git history, logs, or error responses.
- [ ] The function validates email format and reasonable input length.
- [ ] The function has rate limiting or abuse protection appropriate for the owner workflow.
- [ ] Error messages do not expose API responses, tokens, or internal details to clients.
- [ ] The function does not allow a caller to choose arbitrary sender addresses.
- [ ] Password-reset links are sent only to the requested address.
- [ ] A failed email does not create an uncontrolled accumulation of accounts.
- [ ] Function logs do not contain reset links, password data, or Brevo credentials.
- [ ] The function is deployed from the intended Firebase project.

## 5. App Check and Abuse Protection

Open Firebase Console -> App Check.

- [ ] App Check is configured for the web app where supported.
- [ ] Enforcement is enabled for Firestore after testing.
- [ ] Enforcement is enabled for Storage after testing.
- [ ] Enforcement is enabled for callable Functions after testing.
- [ ] Debug tokens are not left enabled for production users.
- [ ] Failed App Check requests are monitored.
- [ ] Firebase Authentication quotas and abuse protections are reviewed.
- [ ] Brevo sending limits and account alerts are configured.

## 6. Public Wiki Privacy Check

Use a signed-out private browser window and inspect the network requests.

- [ ] Only deliberately public wiki entries are readable.
- [ ] Secret entries cannot be fetched by changing a URL, slug, or document ID.
- [ ] Restricted fields cannot be fetched by guessing a nested document path.
- [ ] Images marked private cannot be downloaded by their direct Storage URL.
- [ ] Firestore responses do not contain hidden fields that the frontend merely chooses not to display.
- [ ] Search, index, backlinks, relationships, and daily widgets do not reveal secret titles or metadata.
- [ ] Error states do not reveal private document names or internal IDs.

## 7. Client-Side Security Review

The Firebase web configuration is expected to be visible in browser code. It is not a secret. Security must come from Firebase rules and server-side checks.

- [ ] No Brevo key, Firebase Admin credential, service-account JSON, or private token exists in frontend files.
- [ ] No secrets exist in git history.
- [ ] No unsafe `eval`, `new Function`, or `document.write` is used.
- [ ] User content is rendered as text or sanitized HTML.
- [ ] Any use of `innerHTML` is limited to trusted static markup.
- [ ] Any `iframe.srcdoc` content is built from trusted or safely escaped data.
- [ ] External links use `rel="noopener noreferrer"` when opened in a new tab.
- [ ] External scripts are pinned to known versions and loaded only from trusted origins.
- [ ] The service worker does not cache credentials, reset links, or private API responses.
- [ ] Logout clears the intended Firebase session and does not leave private content visible from cached UI state.

## 8. Manual Test Matrix

Run each test in a normal browser and a private/incognito window. Use separate owner, player, and signed-out accounts.

| Test | Expected result | Result / date |
|---|---|---|
| Signed-out user reads public wiki page | Allowed only for public content | |
| Signed-out user reads private entry by guessed ID | Denied | |
| Signed-out user writes to `world` | Denied | |
| Signed-out user uploads to Storage | Denied | |
| Player reads permitted content | Allowed | |
| Player reads another player's restricted content | Denied | |
| Player edits owner-only data | Denied | |
| Player changes their own permission record | Denied | |
| Player calls `createPlayerAccount` | Denied | |
| Owner calls `createPlayerAccount` | Allowed | |
| Non-owner calls function with forged client data | Denied | |
| Deleted account accesses Firestore | Denied | |
| Direct private image URL without auth | Denied | |
| Oversized or invalid file upload | Denied | |
| Old service-worker cache after logout | No private content appears | |

## 9. Evidence to Save

- [ ] Copy the deployed Firestore rules into a dated private note.
- [ ] Copy the deployed Storage rules into a dated private note.
- [ ] Record Firebase Authentication providers and authorized domains.
- [ ] Record App Check enforcement status.
- [ ] Record the Cloud Function region, runtime, and deployed version.
- [ ] Save screenshots or exported results from the manual test matrix.
- [ ] Check git history for accidental secrets before publishing changes.

## 10. Stop Conditions

Pause deployment and fix the issue before continuing if any of these are true:

- A signed-out user can read or write private data.
- A normal player can change permissions or owner data.
- A guessed document ID reveals secret content.
- A private Storage file is publicly downloadable.
- A frontend file contains a Brevo key or service-account credential.
- The callable function accepts requests from non-owner accounts.
- Production rules contain a broad wildcard allow.
