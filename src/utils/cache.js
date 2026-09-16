/**
 * Cache LRU en mémoire avec TTL — niveau production TikTok
 * Évite les requêtes Supabase redondantes sur les données chaudes
 */

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_SIZE = 200; // max entrées

class LRUCache {
  constructor(maxSize = MAX_SIZE) {
    this._map = new Map();
    this._maxSize = maxSize;
  }

  get(key) {
    const entry = this._map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._map.delete(key);
      return null;
    }
    // LRU: réinsérer en tête
    this._map.delete(key);
    this._map.set(key, entry);
    return entry.data;
  }

  set(key, data, ttl = DEFAULT_TTL) {
    if (this._map.has(key)) this._map.delete(key);
    if (this._map.size >= this._maxSize) {
      // Supprimer le plus ancien (premier de la Map)
      const oldestKey = this._map.keys().next().value;
      this._map.delete(oldestKey);
    }
    this._map.set(key, { data, expiresAt: Date.now() + ttl });
  }

  invalidate(keyOrPattern) {
    if (typeof keyOrPattern === 'string') {
      this._map.delete(keyOrPattern);
    } else if (keyOrPattern instanceof RegExp) {
      for (const key of this._map.keys()) {
        if (keyOrPattern.test(key)) this._map.delete(key);
      }
    }
  }

  clear() {
    this._map.clear();
  }

  get size() {
    return this._map.size;
  }
}

// Singleton partagé dans toute l'app
export const appCache = new LRUCache(200);

// Clés de cache standardisées
export const CACHE_KEYS = {
  profile: (userId) => `profile:${userId}`,
  posts: (userId) => `posts:${userId}`,
  feed: (page) => `feed:${page}`,
  chatList: (userId) => `chatlist:${userId}`,
  notifications: (userId) => `notifs:${userId}`,
  presence: (userId) => `presence:${userId}`,
};

// TTL par type de donnée
export const CACHE_TTL = {
  profile: 3 * 60 * 1000,     // 3 min — profils changent peu
  posts: 2 * 60 * 1000,       // 2 min — posts semi-dynamiques
  feed: 30 * 1000,            // 30 sec — feed très dynamique
  chatList: 20 * 1000,        // 20 sec — chats temps réel
  notifications: 15 * 1000,   // 15 sec
};

