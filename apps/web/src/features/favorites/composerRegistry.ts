import type { ComposerKind, ComposerRegistration, MentionReferencePayload } from './types';

export interface ComposerRegistrySnapshot {
  activeComposerId: ComposerKind | null;
  registeredComposerIds: ComposerKind[];
}

export class ComposerRegistry {
  private registrations = new Map<ComposerKind, ComposerRegistration>();
  private activeComposerId: ComposerKind | null = null;
  private fallbackComposerId: ComposerKind = 'promptbar';

  register(registration: ComposerRegistration): () => void {
    this.registrations.set(registration.id, registration);

    return () => {
      this.registrations.delete(registration.id);
      if (this.activeComposerId === registration.id) {
        this.activeComposerId = null;
      }
    };
  }

  markFocused(id: ComposerKind): void {
    if (this.registrations.has(id) || id === this.fallbackComposerId) {
      this.activeComposerId = id;
    }
  }

  setFallbackComposer(id: ComposerKind): void {
    this.fallbackComposerId = id;
  }

  getActiveComposer(): ComposerRegistration | null {
    return this.registrations.get(this.activeComposerId || this.fallbackComposerId)
      || this.registrations.get(this.fallbackComposerId)
      || this.registrations.values().next().value
      || null;
  }

  insert(payload: MentionReferencePayload): boolean {
    const composer = this.getActiveComposer();
    if (!composer) return false;
    void composer.insert(payload);
    composer.focus?.();
    return true;
  }

  snapshot(): ComposerRegistrySnapshot {
    return {
      activeComposerId: this.activeComposerId,
      registeredComposerIds: Array.from(this.registrations.keys()),
    };
  }

  clear(): void {
    this.registrations.clear();
    this.activeComposerId = null;
  }
}

export const favoriteComposerRegistry = new ComposerRegistry();

export function insertIntoFocusedComposer(payload: MentionReferencePayload): boolean {
  return favoriteComposerRegistry.insert(payload);
}
