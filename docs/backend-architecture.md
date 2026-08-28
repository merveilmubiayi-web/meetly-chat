# Meetly backend architecture

## Ownership boundaries

- Supabase Auth owns accounts, sessions, OAuth, and JWTs.
- Supabase Postgres owns relational metadata and ownership: profiles, posts, comments, follows, likes, favorites, notifications, conversations, messages, and call history.
- Supabase Realtime broadcasts changes to Postgres tables; it does not store media.
- Cloudinary owns image, video, and audio bytes. Postgres stores only validated Cloudinary URLs and metadata.
- LiveKit owns audio/video transport. Supabase stores call history and authorizes token issuance.
- Edge Functions are the only trusted boundary for LiveKit tokens, Cloudinary signatures, and server-generated notifications.

## Current implementation

- `src/lib/supabase.js` creates the mobile/web Supabase client with SSR-safe storage.
- `src/config/api.js` calls the `livekit-token` Supabase Edge Function.
- `supabase/functions/livekit-token` validates the Supabase bearer token and derives the LiveKit identity from `auth.uid()`; the client cannot impersonate another user.
- `supabase/functions/cloudinary-signature` returns a short-lived signed upload payload after validating the Supabase bearer token.
- `supabase_schema.sql` defines the core content, social, messaging, notification, and call-history tables and RLS policies.

## Production rules

1. Never put a Supabase service-role key, LiveKit secret, or Cloudinary API secret in the Expo bundle.
2. Do not allow client-created notifications. Generate them in database triggers or Edge Functions.
3. Do not trust `author_id`, `sender_id`, `user_id`, or LiveKit identity from a request body. RLS and Edge Functions derive ownership from the JWT.
4. Keep unsigned Cloudinary uploads disabled once the signed-upload function is deployed. Restrict allowed resource types, folders, MIME types, and maximum sizes in the Cloudinary upload preset.
5. Enable Realtime only for tables that need it: posts, stories, notifications, conversation members, messages, and call sessions.
6. Use cursor pagination on `created_at, id`; never load an entire feed or conversation.
7. Run the SQL schema through migrations in CI/CD. Do not edit production schema manually after the initial migration.

## Required secrets

Set these in Supabase Edge Function secrets, never in `.env` committed to the app:

- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_UPLOAD_PRESET`

Supabase provides `SUPABASE_URL` and `SUPABASE_ANON_KEY` to Edge Functions. Deploy with the Supabase CLI after linking the project.

## Migration status

The core feed, post creation, profile metadata, story creation, and LiveKit authorization are aligned with Supabase. Remaining frontend migration work is the legacy Firebase-backed messaging/settings/likes/comments code. It must be migrated table-by-table to `messages`, `conversation_members`, `comments`, `post_likes`, `notifications`, and `saved_posts` before removing the `firebase` dependency and `src/config/firebase.js`.
