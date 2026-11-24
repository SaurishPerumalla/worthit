import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.saurishperumalla.dealchaser',
  appName: 'DealChaser',
  webDir: 'dist',
  backgroundColor: '#020617',
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
