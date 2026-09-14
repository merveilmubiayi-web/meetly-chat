import { supabase } from '../lib/supabase';

export async function uploadToCloudinary(uri, { resourceType = 'image', fileName = 'upload' } = {}) {
  if (!uri) return '';

  try {
    const { data: signature, error: signatureError } = await supabase.functions.invoke('cloudinary-signature', {
      body: { resourceType },
    });

    if (!signatureError && signature?.cloudName && signature?.signature) {
      const formData = new FormData();
      if (uri.startsWith('blob:') || uri.startsWith('data:')) {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('file', blob, fileName);
      } else {
        formData.append('file', {
          uri,
          name: fileName,
          type: resourceType === 'audio' ? 'audio/m4a' : resourceType === 'video' ? 'video/mp4' : 'image/jpeg',
        });
      }
      formData.append('api_key', signature.apiKey);
      formData.append('timestamp', String(signature.timestamp));
      formData.append('signature', signature.signature);
      if (signature.uploadPreset) formData.append('upload_preset', signature.uploadPreset);
      if (signature.folder) formData.append('folder', signature.folder);

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${signature.cloudName}/${signature.resourceType || resourceType}/upload`,
        { method: 'POST', body: formData }
      );
      const result = await uploadResponse.json().catch(() => ({}));
      if (uploadResponse.ok && (result.secure_url || result.url)) {
        return result.secure_url || result.url;
      }
    }
  } catch (cloudinaryErr) {
    console.warn('Cloudinary upload fallback to Supabase Storage / Local URI:', cloudinaryErr?.message || cloudinaryErr);
  }

  // Fallback 1: Try Supabase Storage bucket 'media'
  try {
    let fileBody = uri;
    if (uri.startsWith('blob:') || uri.startsWith('data:') || typeof window !== 'undefined') {
      const resp = await fetch(uri);
      fileBody = await resp.blob();
    }
    const cleanFileName = `${resourceType}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const { data: storageData, error: storageErr } = await supabase.storage
      .from('media')
      .upload(`public/${cleanFileName}`, fileBody, {
        upsert: true,
        contentType: resourceType === 'audio' ? 'audio/m4a' : resourceType === 'video' ? 'video/mp4' : 'image/jpeg',
      });

    if (!storageErr && storageData?.path) {
      const { data: publicUrlData } = supabase.storage.from('media').getPublicUrl(storageData.path);
      if (publicUrlData?.publicUrl) {
        return publicUrlData.publicUrl;
      }
    }
  } catch (storageException) {
    console.warn('Supabase storage fallback failed, retaining local URI:', storageException?.message || storageException);
  }

  // Fallback 2: Return local URI so that media preview/playback works immediately offline/in dev
  return uri;
}
