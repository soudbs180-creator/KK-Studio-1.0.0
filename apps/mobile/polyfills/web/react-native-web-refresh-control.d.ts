declare module 'react-native-web-refresh-control' {
  import type { ComponentType } from 'react';
  import type { RefreshControlProps } from 'react-native';

  // Upstream ships JavaScript only; keep the local polyfill contract aligned with React Native.
  export const RefreshControl: ComponentType<RefreshControlProps>;
}
