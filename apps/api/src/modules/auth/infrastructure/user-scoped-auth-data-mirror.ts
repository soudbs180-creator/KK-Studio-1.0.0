export interface UserScopedAuthDataMirror {
  loadUserApisPayload(accessToken: string, userId: string): Promise<unknown | null>;
  saveUserApisPayload(
    accessToken: string,
    userId: string,
    email: string | undefined,
    payload: unknown,
  ): Promise<void>;
}
