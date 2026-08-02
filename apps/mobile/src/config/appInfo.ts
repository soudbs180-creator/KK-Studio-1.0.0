import Constants from 'expo-constants';

const configuredVersion = Constants.expoConfig?.version;

export const MOBILE_APP_VERSION = configuredVersion || 'unknown';
export const MOBILE_APP_DISPLAY_VERSION = configuredVersion
  ? `v${configuredVersion}`
  : 'version unknown';
