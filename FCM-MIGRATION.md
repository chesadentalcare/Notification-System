# FCM consolidation & recovery — migration plan

Goal: move all push (web + mobile, employees + dealers) onto **one** Firebase project
owned by **`notifications@ashvahealthtech.com`** (company account, add 2+ owners + company
billing so no single departure can break it again), and send everything through the
notification hub.

## Diagnosis — 2026-09-27 (from prod logs + notification_logs)

**Root cause: the backend Firebase service account is invalid.** Every send fails with
`app/invalid-credential` → `invalid_grant: Invalid grant: account not found`. The service
account (tied to the deleted ex-employee Google account / old `chesa-mobile-app` project) no
longer exists, so `firebase-admin` cannot fetch an OAuth token — **not** a per-token issue.

- `production_dashboard.notification_logs`: **0 successes, 100% failures for ≥21 days**
  (employee push fully down). Gateway logs: 3582× `invalid_grant` / `account not found`,
  1728× `app/invalid-credential`.
- Active tokens still registered (unreachable, old projects): employees **android 41 / ios 2
  / web 21** (64); dealers **android 1**.
- Firebase projects in play (client configs): `chesa-mobile-app` (senderId 744385357298 — the
  backend's dead project), `chesa-service-pwa` (467806267194), `chesa-dashboards` (442787713847),
  + dealer project. The backend only ever held `chesa-mobile-app`'s service account, so tokens on
  the other web projects were never reachable server-side anyway → consolidating to one project fixes that too.

## Hard constraints
- **FCM tokens are project-scoped and cannot be migrated.** A new project ⇒ every app reconfigured
  ⇒ clients re-register ⇒ old tokens die. No way around it.
- Backend sending is **already 100% down**, so there's nothing to "keep alive" during transition —
  this is a clean move to the new project, not a dual-run (the hub supports dual-run, but no old SA works today).

## Target end-state
One project (`notifications@ashvahealthtech.com`) → all web apps + both mobile apps registered under it
→ backend + hub send via its single service account → the hub's `FCM_PROJECTS` holds one entry.

## Steps
1. **New project setup (you, Firebase console):** add every app — a Web app per dashboard (or one shared
   web app), Android app, iOS app; enable Cloud Messaging; collect: web config
   (`apiKey`/`projectId`/`messagingSenderId`/`appId`), **Web Push cert = VAPID key**,
   `google-services.json` (Android) + `GoogleService-Info.plist` (iOS), and a **service-account private key** JSON.
2. **Hub:** set `FCM_PROJECTS=[{projectId,clientEmail,privateKey,label:"Chesa (ashva)"}]` from the new SA
   (+ `FCM_EMPLOYEE_DB`/`FCM_DEALER_DB` already set), deploy → hub authenticates + can send.
3. **chesa backend** (`PushNotificationService.js`, currently dead): DECISION —
   (a) repoint its `FIREBASE_*` env at the new SA, or (b) retire its direct sends and route push through the hub.
4. **Reconfigure the apps to the new project** (code — I can do the web repos + mobile config references once
   you share the new config): each web repo's `src/**/firebase.js` + `public/firebase-messaging-sw.js` + VAPID;
   mobile app's `google-services.json` / `GoogleService-Info.plist` + config.
5. **Redeploy apps** → on next open/login each client re-registers a NEW token (new project) into
   `fcm_tokens` / `dealer_fcm_tokens`. Optionally mark `is_active=0` for tokens created before cutover.
6. **Verify:** hub → Send Push → `success_count > 0`; `notification_logs` successes climb from zero.
7. **Retire** the old projects once traffic has moved.

## Per-repo reconfiguration surface
| Old project | Repos to repoint to the new project |
|---|---|
| `chesa-service-pwa` | sales-final, technician-dashboard (+ `firebase-messaging-sw.js`) |
| `chesa-mobile-app` | production, main_store, QC_Dashboard, chesa_api_gateway backend env |
| `chesa-dashboards` | accounts-final, Ashva-superapp, service_dashboard, sales-app |
| dealer | Chesa-Dealer-App (`google-services.json`/`GoogleService-Info.plist`) |

Each web repo change = swap `firebaseConfig` (apiKey/projectId/messagingSenderId/appId) in `firebase.js`
**and** `public/firebase-messaging-sw.js`, plus the VAPID key. Config-only; revert per repo to roll back.

## What I need from you to start step 4
The new project's **web config values** (apiKey/projectId/messagingSenderId/appId), the **VAPID key**,
and the **service-account JSON** (path on the server — I wire it, never print it). Then I fan out the
per-repo reconfiguration + point the hub at the new project.
