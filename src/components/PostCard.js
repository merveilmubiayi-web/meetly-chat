import { useEffect, useState } from 'react';
import { Alert, Image, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function PostCard({ post, onComment, onOpenProfile }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likes, setLikes] = useState(post.likes_count || 0);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      const id = data.user?.id;
      if (!id) return;
      const [{ data: like }, { data: bookmark }] = await Promise.all([
        supabase.from('post_likes').select('post_id').eq('post_id', post.id).eq('user_id', id).maybeSingle(),
        supabase.from('saved_posts').select('post_id').eq('post_id', post.id).eq('user_id', id).maybeSingle(),
      ]);
      setLiked(Boolean(like));
      setSaved(Boolean(bookmark));
    });
  }, [post.id]);

  const requireUser = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      Alert.alert('Connexion requise', 'Connecte-toi pour interagir avec cette publication.');
      return null;
    }
    return data.user;
  };

  const toggleLike = async () => {
    const user = await requireUser();
    if (!user) return;
    if (liked) {
      await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
      const newLikes = Math.max(0, likes - 1);
      setLiked(false);
      setLikes(newLikes);
      await supabase.from('posts').update({ likes_count: newLikes }).eq('id', post.id);
    } else {
      const { error } = await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id });
      if (error && error.code !== '23505') return;
      const newLikes = likes + 1;
      setLiked(true);
      setLikes(newLikes);
      await supabase.from('posts').update({ likes_count: newLikes }).eq('id', post.id);
    }
  };

  const toggleSaved = async () => {
    const user = await requireUser();
    if (!user) return;
    if (saved) {
      await supabase.from('saved_posts').delete().eq('post_id', post.id).eq('user_id', user.id);
      setSaved(false);
    } else {
      await supabase.from('saved_posts').insert({ post_id: post.id, user_id: user.id });
      setSaved(true);
    }
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.authorRow} onPress={() => onOpenProfile?.(post.author_id)}>
        <Image source={{ uri: post.author_avatar || 'https://via.placeholder.com/150' }} style={styles.avatar} />
        <View><Text style={styles.author}>{post.author_name || 'Utilisateur'}</Text><Text style={styles.date}>{new Date(post.created_at).toLocaleDateString()}</Text></View>
      </TouchableOpacity>
      {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
      {post.media_url ? <Image source={{ uri: post.media_url }} style={styles.media} resizeMode="cover" /> : null}
      <View style={styles.actions}>
        <TouchableOpacity onPress={toggleLike}><Text style={[styles.action, liked && styles.liked]}>{liked ? '♥' : '♡'} {likes}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => onComment?.(post)}><Text style={styles.action}>💬 Commenter</Text></TouchableOpacity>
        <TouchableOpacity onPress={toggleSaved}><Text style={[styles.action, saved && styles.saved]}>{saved ? '🔖' : '☆'}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => Share.share({ message: post.caption || 'Publication Meetly' })}><Text style={styles.action}>↗</Text></TouchableOpacity>
      </View>
      <View style={styles.reactions}><Text>🔥</Text><Text>👏</Text><Text>😂</Text></View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#141418', marginHorizontal: 12, marginBottom: 12, borderRadius: 14, padding: 14 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#252530' },
  author: { color: '#fff', fontWeight: '700' },
  date: { color: '#8a8a9a', fontSize: 11, marginTop: 2 },
  caption: { color: '#f0f0f2', marginVertical: 12, lineHeight: 20 },
  media: { width: '100%', height: 220, borderRadius: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  action: { color: '#d8d8df', fontSize: 14 },
  liked: { color: '#e53952' },
  saved: { color: '#f2c14e' },
  reactions: { flexDirection: 'row', gap: 14, marginTop: 10 },
});
