import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.vanta.fitness',
  appName: 'VANTA',
  webDir: 'dist',
  backgroundColor: '#0A0A0A',
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#0A0A0A',
      showSpinner: false,
    },
    FirebaseAuthentication: {
      // The JS SDK holds the session (Firestore/Functions use it); the native
      // layer only obtains the Google/Apple credential.
      skipNativeAuth: true,
      providers: ['google.com', 'apple.com'],
    },
    LocalNotifications: {
      iconColor: '#FF6B1A',
    },
  },
};

export default config;
