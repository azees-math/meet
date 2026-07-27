import { AuthUser, GOOGLE_AUTH_NONCE_STORAGE_KEY } from '@/lib/auth-session';

export function decodeGoogleCredential(credential: string): AuthUser {
  const payload = credential.split('.')[1];
  const normalizedPayload = payload
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(payload.length / 4) * 4, '=');
  const decodedPayload = decodeURIComponent(
    atob(normalizedPayload)
      .split('')
      .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
      .join(''),
  );
  const profile = JSON.parse(decodedPayload);

  return {
    username: profile.email ?? profile.name ?? 'google-user',
    userType: 'user',
    picture: profile.picture,
    authMethod: 'google',
  };
}

export function createGoogleAuthUrl(clientId: string) {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  window.localStorage.setItem(GOOGLE_AUTH_NONCE_STORAGE_KEY, nonce);

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', window.location.origin);
  authUrl.searchParams.set('response_type', 'id_token');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('nonce', nonce);
  authUrl.searchParams.set('prompt', 'select_account');
  return authUrl.toString();
}
