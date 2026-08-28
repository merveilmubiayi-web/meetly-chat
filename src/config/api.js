import { supabase } from '../lib/supabase';

async function requestLiveKitToken(room, identity) {
  const { data, error } = await supabase.functions.invoke('livekit-token', {
    body: { room, identity },
  });
  if (error) throw error;
  return data;
}

export { requestLiveKitToken };

