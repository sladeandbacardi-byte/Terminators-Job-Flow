# Threat Model

## Project Overview

The Terminators Field Service Management System is a Node.js 20 / Express / TypeScript application with a React 18/Vite client, PostgreSQL/Neon storage through Drizzle ORM, and integrations for email, Sage Accounting, WhatsApp, Stripe-related client code, and Google Cloud/object-storage tooling. It manages clients, jobs, field workers, inventory, contracts, invoices, leads/quotes, fleet records, treatment reports, overtime, and backups. The server exposes a large REST API from `server/routes.ts` and serves the built client in production.

Authentication has two distinct paths: password-based administrator sessions backed by signed JWTs plus `user_sessions`, and worker/mobile JWTs. The application also currently exposes profile-picker and mobile-login flows intended for staff-facing use.

## Assets

- **Administrator and worker identities** -- passwords, hashed worker PINs, JWT bearer tokens, session records, roles, and employee identifiers. Compromise permits impersonation and operational changes.
- **Client and worker personal data** -- names, contact details, addresses, schedules, employment/time records, signatures, photos, and treatment information.
- **Operational and financial records** -- jobs, invoices, payments, quotes, contracts, inventory, purchase orders, payroll-related overtime, and fleet records.
- **Application and integration secrets** -- `JWT_SECRET`/`SESSION_SECRET`, database credentials, SMTP/SendGrid/Brevo, Sage, WhatsApp, Stripe, and cloud-storage credentials. Leakage can enable account takeover, data access, or third-party charges/messages.
- **Backups and exports** -- bulk copies of business and personal data sent by download or email and spreadsheets opened by staff.

## Trust Boundaries

- **Browser/mobile client to Express API** -- request bodies, query/path identifiers, headers, uploaded files, and local-storage bearer tokens are attacker-controlled. Every sensitive endpoint needs server-side authentication and object/role authorization.
- **Public internet to authenticated staff boundary** -- public quote submission and login/chooser endpoints must not issue staff identity or trigger unbounded privileged side effects without strong controls.
- **API to PostgreSQL/Neon** -- request-controlled values must remain parameterized and all reads/writes must be scoped to the authorized subject and object.
- **API to email and messaging providers** -- user content must not become executable HTML or untrusted links in trusted notifications; recipients and provider credentials must be protected from abuse.
- **API to Sage/WhatsApp/cloud services** -- destinations, credentials, amounts, and records must be server-controlled and authorized.
- **Server to filesystem/static assets and parsers** -- uploads, exports, backups, and spreadsheet parsing must have bounded size, safe formats, and no arbitrary file access.
- **Administrator/manager/office worker/mobile technician boundaries** -- profile-picker and mobile identities must not be treated as proof of identity; privileged actions and records must enforce role and ownership server-side.

## Scan Anchors

- Production server entry points: `server/index.ts`, `server/routes.ts`, `server/auth-service.ts`; production starts the bundled `dist/index.js` and serves built static assets.
- Highest-risk surfaces: public auth routes around `server/routes.ts:613-746` and `1500-1570`, global API middleware around `315-331`, mobile routes around `1045-1465`, time/overtime around `1633-2387`, imports/exports/backups around `2992-3155` and `5360-5860`, and external integrations around `server/email-service.ts`, `server/time-notifications.ts`, `server/sage-integration.ts`, and messaging routes.
- Public surfaces: `POST /api/auth/login`, `POST /api/auth/admin-login`, `POST /api/auth/mobile-login`, `GET /api/auth/staff`, and `POST /api/public/quote-request`; other `/api` routes are intended to pass the default authentication middleware, with mobile routes using a separate signed-token middleware.
- Dev-only unless proven reachable: `server/seed.ts`, `server/reset-db.ts`, `server/create-admin.ts`, `server/create-mobile-test-data.ts`, mock/demo client profiles, and Vite development middleware.

## Threat Categories

### Spoofing

Public profile-picker login must not mint a worker identity from a caller-supplied worker ID, and mobile login must require the worker's PIN or another strong credential. Public staff listings should not disclose identifiers that are sufficient to authenticate. Admin JWTs must be signature-verified, session-backed, expiring, and revocable; worker/mobile tokens need equivalent revocation expectations. Logout and inactive-worker checks must invalidate access promptly.

### Tampering

All privileged changes to jobs, treatment reports, field diaries, invoices, payments, inventory, quotes, purchase orders, contracts, roles, and time records MUST require the correct role and object relationship server-side. Client-supplied totals, statuses, employee IDs, tenant/scope identifiers, and ownership fields MUST NOT override server-derived authorization or financial state.

### Repudiation

Sensitive authentication, payroll/time, financial, inventory, and administrative changes should record the authenticated actor, object, timestamp, and outcome in an integrity-protected audit trail. Logs must not expose credentials, PINs, tokens, or unnecessary personal data.

### Information Disclosure

Client, worker, schedule, treatment, financial, backup, and integration data MUST be returned only to an authenticated subject with the required role and permitted scope. Public routes must return only intentionally public fields. Error responses and logs must not disclose secrets or bulk personal data. CSV/XLSX exports must treat external strings as data, not spreadsheet formulas, and email templates must escape untrusted values.

### Denial of Service

Public endpoints and authenticated import/export/report operations need rate limits, bounded request/file/row sizes, bounded parser expansion, and bounded database/email work. Public quote forms must not permit unlimited outbound email or unbounded database growth. Multipart uploads need explicit limits in addition to JSON limits.

### Elevation of Privilege

Profile-picker and mobile technician sessions MUST remain confined to the authenticated worker's permitted self-service and assigned-work scope. Administrator-only routes (backups, restore, data-integrity operations, payments, role/security settings, approvals, and external financial operations) MUST enforce administrator roles, not merely the presence of a bearer token or client-side role state. All object-ID paths, nested resources, exports, and alternate/legacy routes require the same policy.
