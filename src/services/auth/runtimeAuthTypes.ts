export interface RuntimeAuthUserIdentityLike {
  provider?: string | null;
}

export interface RuntimeAuthUser {
  id: string;
  aud: string;
  role: string;
  email: string;
  phone: string;
  created_at: string;
  updated_at: string;
  confirmed_at: string;
  last_sign_in_at: string;
  app_metadata: {
    provider?: string | null;
    providers?: string[];
    isTempUser?: boolean;
  };
  user_metadata: {
    provider?: string | null;
    auth_provider?: string | null;
    providers?: string[];
    name?: string;
    full_name?: string;
    display_name?: string;
    avatar_url?: string;
    isTempUser?: boolean;
  };
  identities?: RuntimeAuthUserIdentityLike[];
}

export interface RuntimeAuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: "bearer";
  user: RuntimeAuthUser;
}
