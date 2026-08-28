import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function CommentsModal({ visible, post, onClose }) {
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState(null);

  useEffect(() => {
    if (!visible || !post?.id) return undefined;
    let active = true;
    const load = async () => {
      const { data, error } = await supabase.from('comments').select('id, body, created_at, author_id, reply_to_id').eq('post_id', post.id).order('created_at', { ascending: true });
      if (active && !error) setComments(data || []);
    };
    load();
    const channel = supabase.channel(`comments-modal-${post.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${post.id}` }, load).subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, [visible, post?.id]);

  const submit = async () => {
    const text = body.trim();
    if (!text || !post?.id) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      Alert.alert('Connexion requise', 'Connecte-toi pour commenter.');
      return;
    }
    const authorName = replyTo?.authorName || 'utilisateur';
    const { error } = await supabase.from('comments').insert({
      post_id: post.id,
      author_id: userData.user.id,
      body: replyTo ? `@${authorName} ${text}` : text,
      reply_to_id: replyTo?.id || null,
    });
    if (error) Alert.alert('Erreur', error.message);
    else {
      setBody('');
      setReplyTo(null);
    }
  };

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
        <View style={styles.header}><Text style={styles.title}>Commentaires</Text><TouchableOpacity onPress={onClose}><Text style={styles.close}>Fermer</Text></TouchableOpacity></View>
        <ScrollView style={styles.list}>{comments.map((comment) => {
          const isReply = Boolean(comment.reply_to_id);
          return <View key={comment.id} style={[styles.comment, isReply && styles.reply]}>
            <Text style={styles.author}>{comment.author_id}</Text>
            <Text style={styles.body}>{comment.body}</Text>
            <View style={styles.commentFooter}>
              <Text style={styles.date}>{new Date(comment.created_at).toLocaleString()}</Text>
              <TouchableOpacity onPress={() => setReplyTo({ id: comment.id, authorName: comment.author_id })}>
                <Text style={styles.replyAction}>Répondre</Text>
              </TouchableOpacity>
            </View>
          </View>;
        })}</ScrollView>
        {replyTo ? <View style={styles.replyBanner}><Text style={styles.replyBannerText}>Réponse à @{replyTo.authorName}</Text><TouchableOpacity onPress={() => setReplyTo(null)}><Text style={styles.cancelReply}>✕</Text></TouchableOpacity></View> : null}
        <View style={styles.inputRow}><TextInput style={styles.input} value={body} onChangeText={setBody} placeholder={replyTo ? `Répondre à @${replyTo.authorName}` : 'Écrire un commentaire...'} placeholderTextColor="#888" /><TouchableOpacity style={styles.send} onPress={submit}><Text style={styles.sendText}>Envoyer</Text></TouchableOpacity></View>
      </Pressable>
    </Pressable>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.65)' },
  sheet: { maxHeight: '80%', backgroundColor: '#111116', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  close: { color: '#c56be0' },
  list: { minHeight: 160 },
  comment: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#25252e' },
  reply: { marginLeft: 22, borderLeftWidth: 2, borderLeftColor: '#a613c4', paddingLeft: 10 },
  author: { color: '#c56be0', fontWeight: '700', fontSize: 12 },
  body: { color: '#fff', marginTop: 4 },
  date: { color: '#777783', fontSize: 11, marginTop: 4 },
  commentFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  replyAction: { color: '#c56be0', fontSize: 11, fontWeight: '700' },
  replyBanner: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#20202a', padding: 8, borderRadius: 8, marginTop: 8 },
  replyBannerText: { color: '#c56be0', fontSize: 12 },
  cancelReply: { color: '#fff' },
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  input: { flex: 1, backgroundColor: '#20202a', color: '#fff', borderRadius: 10, paddingHorizontal: 12 },
  send: { backgroundColor: '#a613c4', borderRadius: 10, justifyContent: 'center', paddingHorizontal: 14 },
  sendText: { color: '#fff', fontWeight: '700' },
});
