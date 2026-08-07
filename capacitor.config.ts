import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.ragavellur.globalradio',
  appName: 'Global Radio',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
  },
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    Chromecast: {
      appId: 'CC1AD845',
    },
  },
};

export default config;
