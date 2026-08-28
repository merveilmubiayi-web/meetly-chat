import { createClient } from 'npm:@supabase/supabase-js@2';

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
  const cloudinaryApiSecret = Deno.env.get('CLOUDINARY_API_SECRET');
  const cloudinaryApiKey = Deno.env.get('CLOUDINARY_API_KEY');
  const cloudinaryCloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  const uploadPreset = Deno.env.get('CLOUDINARY_UPLOAD_PRESET');
  if (!supabaseUrl || !supabaseAnonKey || !cloudinaryApiSecret || !cloudinaryApiKey || !cloudinaryCloudName || !uploadPreset) {
    return json({ error: 'service_not_configured' }, 503);
  }

  const authorization = request.headers.get('Authorization');
  const accessToken = authorization?.replace(/^Bearer\s+/i, '');
  if (!accessToken) return json({ error: 'unauthorized' }, 401);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return json({ error: 'unauthorized' }, 401);

  let body: { resourceType?: unknown; folder?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const requestedType = body.resourceType as string;
  const resourceType = requestedType === 'audio' ? 'video' : ['video', 'auto'].includes(requestedType) ? requestedType : 'image';
  const folder = typeof body.folder === 'string' && /^[A-Za-z0-9/_-]{1,80}$/.test(body.folder)
    ? body.folder
    : `meetly/${data.user.id}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const params = `folder=${folder}&timestamp=${timestamp}&upload_preset=${uploadPreset}`;
  const hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(params + cloudinaryApiSecret));
  const signature = Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');

  return json({ cloudName: cloudinaryCloudName, apiKey: cloudinaryApiKey, uploadPreset, resourceType, folder, timestamp, signature });
});
