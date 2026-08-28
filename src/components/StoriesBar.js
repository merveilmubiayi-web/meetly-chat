import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function StoriesBar({ navigation }) {
  const [stories, setStories] = useState([]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase.from('stories').select('*').gte('created_at', since).order('created_at', { ascending: false });
      if (active) setStories(data || []);
    };
    load();
    const channel = supabase.channel('stories-bar').on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, load).subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, []);

  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.content}>
    <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('StudioPostScreen', { type: 'story' })}><View style={styles.add}><Text style={styles.plus}>+</Text></View><Text style={styles.label}>Ajouter</Text></TouchableOpacity>
    {stories.map((story, index) => <TouchableOpacity key={story.id} style={styles.item} onPress={() => navigation.navigate('StoryViewer', { startIndex: index })}><Image source={{ uri: story.author_avatar || story.media_url }} style={styles.avatar} /><Text style={styles.label} numberOfLines={1}>{story.author_name || 'Story'}</Text></TouchableOpacity>)}
  </ScrollView>;
}

const styles = StyleSheet.create({ content: { paddingHorizontal: 16, gap: 14 }, item: { width: 64, alignItems: 'center' }, avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#a613c4' }, add: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#20202a', borderWidth: 2, borderColor: '#a613c4', alignItems: 'center', justifyContent: 'center' }, plus: { color: '#fff', fontSize: 26 }, label: { color: '#cfcfd8', fontSize: 11, marginTop: 5 }, });
