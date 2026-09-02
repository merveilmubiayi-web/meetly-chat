# Supabase Edge Functions

## Secrets

Set secrets in the Supabase project, never in the Expo app:

```bash
supabase secrets set LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=...
supabase secrets set CLOUDINARY_CLOUD_NAME=... CLOUDINARY_API_KEY=... CLOUDINARY_API_SECRET=... CLOUDINARY_UPLOAD_PRESET=...
```

## Deploy

From the repository root after installing and authenticating the Supabase CLI:

```bash
supabase link --project-ref jjbgsztyjpbcgrhxxsho
supabase functions deploy livekit-token
supabase functions deploy cloudinary-signature
```

The LiveKit function validates the Supabase bearer token and always uses the authenticated Supabase user ID as the LiveKit identity. The Cloudinary function returns a signed upload payload and scopes the default folder to `meetly/{user_id}`.

Deploy only these Supabase Edge Functions. Keep provider secrets in Supabase and never in the Expo bundle.

