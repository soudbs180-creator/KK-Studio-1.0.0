import { useContext } from 'react';
import { PlatformRuntimeContext } from './PlatformRuntimeProvider.tsx';

/** Returns the injected host adapter and fails early when composition is incomplete. */
export function usePlatformRuntime() {
  const runtime = useContext(PlatformRuntimeContext);
  if (!runtime) {
    throw new Error('usePlatformRuntime must be used within PlatformRuntimeProvider.');
  }
  return runtime;
}
