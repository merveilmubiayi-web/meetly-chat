/**
 * Gestionnaire de présence centralisé — niveau production WhatsApp
 * Un seul canal Supabase Realtime pour TOUTE l'app
 * Évite les N canaux presence redondants qui créent des fuites mémoire
 */

import { supabase } from '../lib/supabase';

class PresenceManager {
  constructor() {
    this._channel = null;
    this._presenceMap = new Map(); // userId → { online, lastSeen }
    this._listeners = new Set(); // callbacks pour mises à jour UI
    this._currentUserId = null;
    this._heartbeatInterval = null;
    this._initialized = false;
  }

  /**
   * Initialise la présence globale — à appeler une seule fois au login
   */
  async initialize(userId) {
    if (this._initialized && this._currentUserId === userId) return;
    this.destroy(); // Nettoyer l'état précédent

    this._currentUserId = userId;
    this._initialized = true;

    this._channel = supabase.channel('global-presence', {
      config: { presence: { key: userId } },
    });

    this._channel
      .on('presence', { event: 'sync' }, () => {
        const state = this._channel.presenceState();
        this._presenceMap.clear();
        for (const [key, presences] of Object.entries(state)) {
          const latest = presences[presences.length - 1];
          this._presenceMap.set(key, {
            online: true,
            lastSeen: latest?.last_seen || new Date().toISOString(),
          });
        }
        this._notify();
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        const latest = newPresences[newPresences.length - 1];
        this._presenceMap.set(key, {
          online: true,
          lastSeen: latest?.last_seen || new Date().toISOString(),
        });
        this._notify();
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        this._presenceMap.set(key, {
          online: false,
          lastSeen: new Date().toISOString(),
        });
        this._notify();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this._channel.track({
            user_id: userId,
            last_seen: new Date().toISOString(),
            online: true,
          });
        }
      });

    // Heartbeat toutes les 30 secondes pour maintenir la présence
    this._heartbeatInterval = setInterval(() => {
      if (this._channel && this._currentUserId) {
        this._channel.track({
          user_id: this._currentUserId,
          last_seen: new Date().toISOString(),
          online: true,
        }).catch(() => {});
      }
    }, 30_000);
  }

  /**
   * Vérifie si un utilisateur est en ligne
   */
  isOnline(userId) {
    return this._presenceMap.get(userId)?.online === true;
  }

  /**
   * Retourne la dernière vue d'un utilisateur
   */
  getLastSeen(userId) {
    return this._presenceMap.get(userId)?.lastSeen || null;
  }

  /**
   * Retourne la map complète (pour les listes)
   */
  getPresenceMap() {
    return new Map(this._presenceMap);
  }

  /**
   * S'abonner aux changements de présence
   */
  subscribe(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  _notify() {
    const snap = new Map(this._presenceMap);
    for (const cb of this._listeners) {
      try { cb(snap); } catch { /* ignore */ }
    }
  }

  /**
   * Marquer l'utilisateur courant comme hors-ligne et nettoyer
   */
  async destroy() {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
    if (this._channel) {
      try {
        await this._channel.untrack();
        await supabase.removeChannel(this._channel);
      } catch { /* ignore */ }
      this._channel = null;
    }
    this._presenceMap.clear();
    this._listeners.clear();
    this._currentUserId = null;
    this._initialized = false;
  }
}

export const presenceManager = new PresenceManager();

/**
 * Hook React pour la présence d'un utilisateur spécifique
 */
import { useEffect, useState } from 'react';

export function usePresence(userId) {
  const [isOnline, setIsOnline] = useState(() => presenceManager.isOnline(userId));
  const [lastSeen, setLastSeen] = useState(() => presenceManager.getLastSeen(userId));

  useEffect(() => {
    if (!userId) return;
    setIsOnline(presenceManager.isOnline(userId));
    setLastSeen(presenceManager.getLastSeen(userId));

    const unsub = presenceManager.subscribe((map) => {
      const entry = map.get(userId);
      setIsOnline(entry?.online === true);
      setLastSeen(entry?.lastSeen || null);
    });
    return unsub;
  }, [userId]);

  return { isOnline, lastSeen };
}

/**
 * Formater la dernière vue en texte lisible
 */
export function formatLastSeen(lastSeen) {
  if (!lastSeen) return '';
  const d = new Date(lastSeen);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'à l\'instant';
  if (diffMins < 60) return `il y a ${diffMins} min`;
  const diffH = Math.floor(diffMins / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

