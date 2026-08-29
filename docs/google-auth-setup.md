# Configuration Google OAuth

Le code utilise Supabase OAuth avec deux URLs de retour :

- Web de production : `https://meetly-2.vercel.app/auth/callback`
- Native iOS/Android : `meetlyneuf://auth/callback`

## Supabase

Dans **Authentication > URL Configuration > Redirect URLs**, ajouter :

```text
https://meetly-2.vercel.app/auth/callback
meetlyneuf://auth/callback
```

Pour un autre domaine de production, définir `EXPO_PUBLIC_WEB_URL` avant le build. La valeur doit être l'origine complète, par exemple `https://mon-domaine.example` ; le code ajoute `/auth/callback`.

Dans **Authentication > Providers > Google**, renseigner le Client ID et le Client Secret Google du même projet Google Cloud. Le callback Google à autoriser est celui de Supabase :

```text
https://jjbgsztyjpbcgrhxxsho.supabase.co/auth/v1/callback
```

## Google Cloud

Créer les clients OAuth du même projet :

- **Web application** : ajouter le domaine web dans les origines autorisées si Google le demande.
- **Android** : package `com.meetly.app` et le SHA-1 du certificat réellement utilisé pour le build (debug, preview ou production selon le cas).
- **iOS** : utiliser le bundle ID `com.meetly.app` et la configuration native du build.

Ne jamais mettre de Client Secret, de clé privée ni de secret LiveKit dans l'application.

## Tests obligatoires

1. Web local en HTTPS : la popup Google revient sur la même origine et la session apparaît sans rechargement manuel.
2. Web production : `https://meetly-2.vercel.app/auth/callback` est autorisée dans Supabase.
3. Android : le SHA-1 correspond au certificat du build installé et le retour ouvre `meetlyneuf://auth/callback`.
4. iOS : le scheme `meetlyneuf` est présent dans le build et le retour ferme la session Safari.
5. Annulation Google et refus d'autorisation : un message clair est affiché et le bouton redevient utilisable.
