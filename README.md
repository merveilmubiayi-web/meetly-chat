# Meetly

Meetly est une application mobile sociale pensée pour connecter des utilisateurs autour de contenus visuels, de discussions, de stories et de live vidéo. Le produit combine une expérience de feed social, des notifications, des messages privés, des groupes, des profils personnalisables et des sessions live en temps réel.

## Ce que l’application propose

- Feed social avec publications, réactions et commentaires
- Stories à durée limitée
- Messagerie directe et groupes
- Profil utilisateur et gestion de visibilité
- Live vidéo et salle de diffusion
- Authentification bancaire / moderne via Supabase
- Intégration Cloudinary pour le stockage des médias

## Stack technique

- React Native + Expo
- Supabase pour l’authentification, la base de données et les edge functions
- LiveKit pour les appels et le streaming en direct
- Cloudinary pour le stockage des médias
- Expo AV, Image Picker et Web Browser pour l’expérience mobile

## Prérequis

- Node.js 18 ou supérieur
- npm ou yarn
- Expo CLI
- Un projet Supabase configuré
- Une configuration LiveKit active
- Un compte Cloudinary pour les médias

## Installation

```bash
npm install
```

## Démarrage local

```bash
npx expo start
```

Pour Android :

```bash
npx expo run:android
```

## Vérifications avant publication

```bash
npm run lint
```

Pour la publication via EAS :

```bash
npx eas build --platform android --profile preview
```

## Checklist de publication

- Vérifier les permissions demandées
- Valider le design sur plusieurs tailles d’écran
- Tester le parcours d’inscription et de connexion
- Vérifier les flux de messagerie et de live
- Ajouter une politique de confidentialité accessible
- Préparer les screenshots, icône et description
- Vérifier la stabilité de l’application sur les tests manuels

## Documentation associée

- [docs/google-play-prep.md](docs/google-play-prep.md)
- [PRIVACY_POLICY.md](PRIVACY_POLICY.md)

## À savoir

Ce dépôt est prêt pour un environnement de développement et de build mobile, avec une base solide pour une mise en production plus méthodique et un passage vers la publication app store.
