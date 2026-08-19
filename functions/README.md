Cloud Functions for Meetly

Endpoints provided:

- `POST /requestRegistrationCode` : accepts JSON { name, username, email, phoneNumber, password }
  - Generates a 6-digit code, stores a hashed code and encrypted password in Firestore `registrationRequests` collection, sends the code by email.

- `POST /confirmRegistrationCode` : accepts JSON { email, code }
  - Validates code, creates Firebase Auth user, writes the `users/{uid}` document in Firestore, and deletes the temporary request.

Environment variables required:

- `ENCRYPTION_KEY` : 32-byte key in hex (64 hex chars) used to encrypt temporary password storage.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` : SMTP configuration for sending emails (or configure a SendGrid SMTP relay).
- `EMAIL_FROM` : optional from address for sent emails.

Deploy with Firebase CLI:

1. cd functions
2. npm install
3. Set environment variables using Firebase env or system env when running locally.
4. firebase deploy --only functions:api

Notes:
- This example stores the password temporarily encrypted in Firestore for the duration of the verification window. In production, prefer using a secure KMS or a short-lived token flow where the client re-sends the password during confirmation.
- Add rate-limiting and abuse protections as needed.
