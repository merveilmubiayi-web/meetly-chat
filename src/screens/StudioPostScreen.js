import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Image, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { requestLiveKitToken } from '../config/api';
import GlassIconBadge from '../components/GlassIconBadge';
import { supabase } from '../lib/supabase';
import { uploadToCloudinary } from '../utils/cloudinaryUpload';

export default function StudioPostScreen({ navigation, route }) {
  const [caption, setCaption] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [contentType, setContentType] = useState(route.params?.type || null);
  const isStory = contentType === 'story';
  const isVideo = contentType === 'video';

  const selectType = async (type) => {
    if (type === 'live') {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        Alert.alert('Connexion requise', 'Tu dois être connecté pour démarrer un live.');
        return;
      }
      try {
        const room = `home_live_${user.id}`;
        const result = await requestLiveKitToken(room, user.id);
        if (!result?.token) throw new Error('Token LiveKit manquant');
        navigation.replace('LiveCallScreen', { room, mode: 'video', token: result.token });
      } catch (error) {
        Alert.alert('Live indisponible', error.message || 'Le service LiveKit n’est pas configuré.');
      }
      return;
    }
    setContentType(type);
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission requise', 'Autorise l’accès à la galerie pour publier une image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: isVideo ? ['videos'] : ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const uploadImageToCloudinary = async (uri) => {
    return uploadToCloudinary(uri, {
      resourceType: isVideo ? 'video' : 'image',
      fileName: `${isStory ? 'story' : isVideo ? 'video' : 'post'}_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
    });
  };

  const handlePublish = async () => {
    if (!contentType || (!isStory && !caption.trim() && !selectedImage) || ((isStory || isVideo) && !selectedImage)) {
      Alert.alert('Contenu manquant', 'Ajoute un texte ou une image/vidéo avant de publier.');
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      Alert.alert('Connexion requise', 'Tu dois être connecté pour publier.');
      return;
    }

    try {
      setUploading(true);
      const { data: profile } = await supabase.from('profiles').select('name, avatar_url').eq('id', user.id).maybeSingle();
      
      const authorName = profile?.name || user.user_metadata?.name || user.email?.split('@')[0] || 'Meetly user';
      const authorAvatar = profile?.avatar_url || user.user_metadata?.avatar_url || null;

      let mediaUrl = '';
      let type = contentType === 'video' ? 'video' : 'text';

      if (selectedImage) {
        mediaUrl = await uploadImageToCloudinary(selectedImage);
        type = isVideo ? 'video' : 'image';
      }

      const payload = {
        author_id: user.id,
        author_name: authorName,
        author_avatar: authorAvatar,
        type: isStory ? (isVideo ? 'video' : 'image') : type,
        media_url: mediaUrl,
      };

      const { error } = isStory
        ? await supabase.from('stories').insert(payload)
        : await supabase.from('posts').insert({ ...payload, caption: caption.trim() });
      if (error) throw error;

      Alert.alert(isStory ? 'Story publiée' : 'Publication publiée', 'Votre contenu a été ajouté avec succès.');
      navigation.goBack();
    } catch (error) {
      console.error('Erreur publication:', error);
      const msg = error?.message || '';
      if (msg.includes('Cloudinary') || msg.includes('signature') || msg.includes('503')) {
        Alert.alert('Erreur d’envoi de média', 'Le service de stockage Cloudinary ou l’Edge Function Supabase n’est pas configuré.');
      } else {
        Alert.alert('Erreur', error.message || 'La publication n’a pas pu être envoyée.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0c" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>◁</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isStory ? 'Créer une story' : contentType ? 'Créer une publication' : 'Nouveau contenu'}</Text>
        <View style={{ width: 24 }} />
      </View>

      {!contentType ? (
        <View style={styles.card}>
          <Text style={styles.label}>Choisir le type</Text>
          {[['image', '▧', 'Image'], ['text', 'T', 'Texte'], ['video', '▶', 'Vidéo'], ['story', '○', 'Story'], ['live', '●', 'Live']].map(([type, icon, label]) => (
            <TouchableOpacity key={type} style={styles.optionButton} onPress={() => selectType(type)}>
              <GlassIconBadge icon={icon} size={34} /><Text style={styles.optionText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : <View style={styles.card}>
        <Text style={styles.label}>{isStory ? 'Image de la story' : isVideo ? 'Vidéo' : 'Légende'}</Text>
        <TextInput
          style={styles.input}
          placeholder={isVideo ? 'Légende de la vidéo...' : 'Exprime ton moment...'}
          placeholderTextColor="#8a8a9a"
          value={caption}
          onChangeText={setCaption}
          multiline
          maxLength={220}
        />
        <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
          <Text style={styles.uploadButtonText}>{selectedImage ? 'Changer l’image' : 'Ajouter une image'}</Text>
        </TouchableOpacity>

        {selectedImage ? <Image source={{ uri: selectedImage }} style={styles.previewImage} /> : null}

        <TouchableOpacity style={styles.publishButton} onPress={handlePublish} disabled={uploading}>
          <Text style={styles.publishButtonText}>{uploading ? 'Publication...' : isStory ? 'Publier la story' : 'Publier'}</Text>
        </TouchableOpacity>
      </View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0c' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  backIcon: { color: '#fff', fontSize: 20 },
  headerTitle: { color: '#fff', fontWeight: '700', fontSize: 16 },
  card: { margin: 16, backgroundColor: '#141418', borderRadius: 16, padding: 16 },
  label: { color: '#f0f0f2', fontWeight: '700', marginBottom: 8 },
  input: { minHeight: 120, backgroundColor: '#0a0a0c', borderRadius: 12, color: '#fff', padding: 12, textAlignVertical: 'top' },
  helper: { color: '#8a8a9a', marginTop: 10, lineHeight: 18 },
  uploadButton: { marginTop: 12, backgroundColor: '#141418', borderWidth: 1, borderColor: '#a613c4', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  uploadButtonText: { color: '#fff', fontWeight: '700' },
  previewImage: { width: '100%', height: 180, borderRadius: 12, marginTop: 12 },
  publishButton: { marginTop: 16, backgroundColor: '#a613c4', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  publishButtonText: { color: '#fff', fontWeight: '700' },
  optionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a0c', borderRadius: 12, padding: 16, marginTop: 10 },
  optionText: { color: '#fff', fontWeight: '700', marginLeft: 12, fontSize: 16 },
});