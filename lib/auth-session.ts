export const AUTH_STORAGE_KEY = 'meet.authUser';
export const AUTH_SESSION_STORAGE_KEY = 'meet.authSession';
export const AUTH_SESSION_START_LOCK_KEY = 'meet.authSessionStartLock';
export const GOOGLE_AUTH_NONCE_STORAGE_KEY = 'meet.googleAuthNonce';

export type UserType = 'admin' | 'user';
export type AuthMethod = 'google' | 'password';

export type AuthUser = {
  username: string;
  userType: UserType;
  first_name?: string;
  last_name?: string;
  email?: string;
  phoneno?: string;
  picture?: string;
  authMethod: AuthMethod;
};

export type AuthSessionState = {
  sessionId: string;
  username: string;
  userType: UserType;
  authMethod: AuthMethod;
  startedAt: string;
};
