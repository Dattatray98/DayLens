import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'tech.github.dattatray.wellnessvoice',
  appName: 'Daylens',
  webDir: 'dist',
  zoomEnabled: false,
  android: { path: '../android' }
};

export default config;
