import * as ImagePicker from 'expo-image-picker';
import { addDoc, collection } from 'firebase/firestore';
import { useState } from 'react';
import { Alert, Image, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { auth, db } from '../config/firebase';

export default function StudioPostScreen({ navigation }) {
  const [caption, setCaption] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission requise', 'Autorise l’accès à la galerie pour publier une image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const uploadImageToCloudinary = async (uri) => {
    try {
      const cloudName = 'dr69cqxz6'; 
      const uploadPreset = 'MEETLY';

      const data = new FormData();
      
      if (uri.startsWith('blob:')) {
        const responseBlob = await fetch(uri);
        const blob = await responseBlob.blob();
        data.append('file', blob, `post_${Date.now()}.jpg`);
      } else if (uri.startsWith('data:')) {
        data.append('file', uri);
      } else {
        data.append('file', {
          uri,
          name: `post_${Date.now()}.jpg`,
          type: 'image/jpeg',
        });
      }
      
      data.append('upload_preset', uploadPreset);

      const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
      const response = await fetch(url, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || 'Échec du téléversement');
      return json.secure_url || json.url;
    } catch (err) {
      console.error('uploadImageToCloudinary error:', err);
      throw err;
    }
  };

  const handlePublish = async () => {
    if (!caption.trim()) {
      Alert.alert('Contenu manquant', 'Ajoute un texte ou une légende avant de publier.');
      return;
    }

    if (!auth.currentUser) {
      Alert.alert('Connexion requise', 'Tu dois être connecté pour publier.');
      return;
    }

    try {
      setUploading(true);
      let mediaUrl = '';
      let type = 'text';

      if (selectedImage) {
        mediaUrl = await uploadImageToCloudinary(selectedImage);
        type = 'image';
      }

      await addDoc(collection(db, 'posts'), {
        authorId: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Meetly user',
        authorAvatar: auth.currentUser.photoURL || 'https://via.placeholder.com/150',
        caption: caption.trim(),
        type,
        mediaUrl,
        likesCount: 0,
        likedBy: [],
        createdAt: new Date()
      });

      Alert.alert('Publication publiée', 'Votre contenu a été ajouté au flux Meetly.');
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert('Erreur', 'La publication n’a pas pu être envoyée.');
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
        <Text style={styles.headerTitle}>Créer une publication</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Légende</Text>
        <TextInput
          style={styles.input}
          placeholder="Exprime ton moment..."
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
          <Text style={styles.publishButtonText}>{uploading ? 'Publication...' : 'Publier'}</Text>
        </TouchableOpacity>
      </View>
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
});