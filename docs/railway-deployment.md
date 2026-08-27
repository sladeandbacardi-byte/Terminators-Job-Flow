# Railway deployment variables

The JobFlow app requires a database connection and at least one signing secret
for authenticated sessions. Add these variables to the Railway **App Service**
under **Variables**:

```text
DATABASE_URL=${{Postgres.DATABASE_URL}}
NODE_ENV=production
SESSION_SECRET=<long random secret>
JWT_SECRET=<long random secret>
```

`SESSION_SECRET` and `JWT_SECRET` are interchangeable. The app accepts either
one, but at least one must be configured. If both are present, `JWT_SECRET` is
used. Keep the values long, random, and stored only in Railway Variables; do
not commit them to the repository or print them in logs.

If neither secret is configured, the app intentionally stops during startup
instead of creating insecure authenticated sessions. The startup error is:

> Missing SESSION_SECRET or JWT_SECRET in Railway Variables. Add one under
> Railway > App Service > Variables.

## Optional email configuration

Missing `SENDGRID_API_KEY` does not prevent the app from starting. Email
delivery can remain disabled until a provider is configured.

For Brevo, use:

```text
EMAIL_PROVIDER=brevo
BREVO_API_KEY=<Brevo API key, optional when using SMTP>
BACKUP_EMAIL_TO=info@terminators.co.za
BACKUP_EMAIL_FROM=info@terminators.co.za
```

Brevo can use either `BREVO_API_KEY` for HTTP delivery or the existing SMTP
variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS`). SendGrid
delivery uses `SENDGRID_API_KEY` and remains optional.