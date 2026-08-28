import { supabase } from '../lib/supabase';

export async function uploadToCloudinary(uri, { resourceType = 'image', fileName = 'upload' } = {}) {
  const { data: signature, error: signatureError } = await supabase.functions.invoke('cloudinary-signature', {
    body: { resourceType },
  });
  if (signatureError) throw signatureError;
  if (!signature?.cloudName || !signature?.signature) {
    throw new Error('Cloudinary signature unavailable');
  }

  const formData = new FormData();
  if (uri.startsWith('blob:') || uri.startsWith('data:')) {
    const response = await fetch(uri);
    const blob = await response.blob();
    formData.append('file', blob, fileName);
  } else {
      formData.append('file', { uri, name: fileName, type: resourceType === 'video' || resourceType === 'audio' ? 'video/mp4' : 'application/octet-stream' });
  }
  formData.append('api_key', signature.apiKey);
  formData.append('timestamp', String(signature.timestamp));
  formData.append('signature', signature.signature);
  formData.append('upload_preset', signature.uploadPreset);
  formData.append('folder', signature.folder);

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${signature.cloudName}/${signature.resourceType}/upload`,
    { method: 'POST', body: formData },
  );
  const result = await uploadResponse.json().catch(() => ({}));
  if (!uploadResponse.ok) {
    throw new Error(result?.error?.message || 'Cloudinary upload failed');
  }
  return result.secure_url || result.url;
}
