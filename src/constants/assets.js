export const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80';
export const DEFAULT_COVER = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&h=400&q=80';
export const DEFAULT_THUMBNAIL = 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80';

export const getAvatarUri = (avatarUrl, name = 'User') => {
  if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.trim().length > 0 && !avatarUrl.includes('via.placeholder.com')) {
    return avatarUrl;
  }
  const safeName = encodeURIComponent((name || 'User').trim().slice(0, 15));
  return `https://ui-avatars.com/api/?background=a613c4&color=fff&bold=true&name=${safeName}`;
};

