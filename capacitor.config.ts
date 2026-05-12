import type { CapacitorConfig } from '@capacitor/cli';

const DEFAULT_SERVER_URL = 'https://ani-flex.vercel.app';
const serverUrl = process.env.CAPACITOR_SERVER_URL || DEFAULT_SERVER_URL;
const serverHost = new URL(serverUrl).hostname;

const config: CapacitorConfig = {
  appId: 'com.aniflex.app',
  appName: 'AniFlex',
  webDir: 'public',
  backgroundColor: '#070413',
  loggingBehavior: 'debug',
  zoomEnabled: false,
  initialFocus: true,
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
    allowNavigation: [serverHost],
    errorPath: 'capacitor-error.html',
  },
  android: {
    backgroundColor: '#070413',
    allowMixedContent: false,
    webContentsDebuggingEnabled: true,
    minWebViewVersion: 80,
  },
};

export default config;
