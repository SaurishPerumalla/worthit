import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.saurishperumalla.dealchaser.app',
  appName: 'DealChaser',
  webDir: 'dist',
  backgroundColor: '#0b071a',
  ios: {
    contentInset: 'automatic',
    scheme: 'DealChaser',
    initialFocus: false
  },
  server: {
    androidScheme: 'https'
  }
};

export default config;
