import { createContext, type ReactNode } from 'react';
import type { PlatformRuntimePort } from './PlatformRuntimePort.ts';

/** Internal context lets the dedicated hook enforce composition-root injection. */
export const PlatformRuntimeContext = createContext<PlatformRuntimePort | undefined>(undefined);

type PlatformRuntimeProviderProps = Readonly<{
  runtime: PlatformRuntimePort;
  children: ReactNode;
}>;

/** Injects the selected host adapter at the application composition root. */
export function PlatformRuntimeProvider({
  runtime,
  children,
}: PlatformRuntimeProviderProps) {
  return (
    <PlatformRuntimeContext.Provider value={runtime}>
      {children}
    </PlatformRuntimeContext.Provider>
  );
}
