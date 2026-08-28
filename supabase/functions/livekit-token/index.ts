import { createClient } from 'npm:@supabase/supabase-js@2';
import { AccessToken, VideoGrant } from 'npm:livekit-server-sdk@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const livekitApiKey = Deno.env.get('LIVEKIT_API_KEY');
  const livekitApiSecret = Deno.env.get('LIVEKIT_API_SECRET');

  if (!supabaseUrl || !supabaseAnonKey || !livekitApiKey || !livekitApiSecret) {
    console.error('Missing required Edge Function secrets');
    return json({ error: 'service_not_configured' }, 503);
  }

  const authorization = request.headers.get('Authorization');
  const accessToken = authorization?.replace(/^Bearer\s+/i, '');
  if (!accessToken) return json({ error: 'unauthorized' }, 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401);

  let payload: { room?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const room = typeof payload.room === 'string' ? payload.room.trim() : '';
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(room)) return json({ error: 'invalid_room' }, 400);

  const identity = userData.user.id;
  const token = new AccessToken(livekitApiKey, livekitApiSecret, {
    identity,
    name: userData.user.user_metadata?.name || userData.user.email || identity,
    ttl: '1h',
  });
  token.addGrant(new VideoGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true }));

  return json({ token: await token.toJwt(), identity, room });
});
