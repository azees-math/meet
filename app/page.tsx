'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import React, { Suspense, useEffect, useState } from 'react';
import { encodePassphrase, generateRoomId, randomString } from '@/lib/client-utils';
import styles from '../styles/Home.module.css';

const GOOGLE_AUTH_STORAGE_KEY = 'meet.googleUser';
const GOOGLE_AUTH_NONCE_STORAGE_KEY = 'meet.googleAuthNonce';

type GoogleUser = {
  name: string;
  email: string;
  picture?: string;
};

function decodeGoogleCredential(credential: string): GoogleUser {
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
    name: profile.name ?? profile.email ?? 'Google user',
    email: profile.email ?? '',
    picture: profile.picture,
  };
}

function createGoogleAuthUrl(clientId: string) {
  const nonce = randomString(32);
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

function Tabs(props: React.PropsWithChildren<{}>) {
  const searchParams = useSearchParams();
  const tabIndex = searchParams?.get('tab') === 'custom' ? 1 : 0;

  const router = useRouter();
  function onTabSelected(index: number) {
    const tab = index === 1 ? 'custom' : 'demo';
    router.push(`/?tab=${tab}`);
  }

  let tabs = React.Children.map(props.children, (child, index) => {
    return (
      <button
        className="lk-button"
        onClick={() => {
          if (onTabSelected) {
            onTabSelected(index);
          }
        }}
        aria-pressed={tabIndex === index}
      >
        {/* @ts-ignore */}
        {child?.props.label}
      </button>
    );
  });

  return (
    <div className={styles.tabContainer}>
      <div className={styles.tabSelect}>{tabs}</div>
      {/* @ts-ignore */}
      {props.children[tabIndex]}
    </div>
  );
}

function DemoMeetingTab(props: { label: string }) {
  const router = useRouter();
  const [roomName, setRoomName] = useState('');
  const [e2ee, setE2ee] = useState(false);
  const [sharedPassphrase, setSharedPassphrase] = useState(randomString(64));
  const startMeeting = () => {
    const selectedRoomName = roomName.trim() || generateRoomId();
    const encodedRoomName = encodeURIComponent(selectedRoomName);
    if (e2ee) {
      router.push(`/rooms/${encodedRoomName}#${encodePassphrase(sharedPassphrase)}`);
    } else {
      router.push(`/rooms/${encodedRoomName}`);
    }
  };
  return (
    <div className={styles.tabContent}>
      <p style={{ margin: 0 }}>
        Click Below to start your meeting using your private app meeting tools
      </p>
      <label htmlFor="roomName">Meeting room name</label>
      <input
        id="roomName"
        name="roomName"
        type="text"
        value={roomName}
        placeholder="team-standup"
        onChange={(ev) => setRoomName(ev.target.value)}
      />
      <button style={{ marginTop: '1rem' }} className="lk-button" onClick={startMeeting}>
        Start Meeting
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem' }}>
          <input
            id="use-e2ee"
            type="checkbox"
            checked={e2ee}
            onChange={(ev) => setE2ee(ev.target.checked)}
          ></input>
          <label htmlFor="use-e2ee">Enable end-to-end encryption</label>
        </div>
        {e2ee && (
          <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem' }}>
            <label htmlFor="passphrase">Passphrase</label>
            <input
              id="passphrase"
              type="password"
              value={sharedPassphrase}
              onChange={(ev) => setSharedPassphrase(ev.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CustomConnectionTab(props: { label: string }) {
  const router = useRouter();

  const [e2ee, setE2ee] = useState(false);
  const [sharedPassphrase, setSharedPassphrase] = useState(randomString(64));

  const onSubmit: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    const serverUrl = formData.get('serverUrl');
    const token = formData.get('token');
    if (e2ee) {
      router.push(
        `/custom/?liveKitUrl=${serverUrl}&token=${token}#${encodePassphrase(sharedPassphrase)}`,
      );
    } else {
      router.push(`/custom/?liveKitUrl=${serverUrl}&token=${token}`);
    }
  };
  return (
    <form className={styles.tabContent} onSubmit={onSubmit}>
      <p style={{ marginTop: 0 }}>Video Conferencing Tools</p>
      <input
        id="serverUrl"
        name="serverUrl"
        type="url"
        placeholder="LiveKit Server URL: wss://*.livekit.cloud"
        required
      />
      <textarea
        id="token"
        name="token"
        placeholder="Token"
        required
        rows={5}
        style={{ padding: '1px 2px', fontSize: 'inherit', lineHeight: 'inherit' }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem' }}>
          <input
            id="use-e2ee"
            type="checkbox"
            checked={e2ee}
            onChange={(ev) => setE2ee(ev.target.checked)}
          ></input>
          <label htmlFor="use-e2ee">Enable end-to-end encryption</label>
        </div>
        {e2ee && (
          <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem' }}>
            <label htmlFor="passphrase">Passphrase</label>
            <input
              id="passphrase"
              type="password"
              value={sharedPassphrase}
              onChange={(ev) => setSharedPassphrase(ev.target.value)}
            />
          </div>
        )}
      </div>

      <hr
        style={{ width: '100%', borderColor: 'rgba(255, 255, 255, 0.15)', marginBlock: '1rem' }}
      />
      <button
        style={{ paddingInline: '1.25rem', width: '100%' }}
        className="lk-button"
        type="submit"
      >
        Connect
      </button>
    </form>
  );
}

function GoogleLoginGate(props: React.PropsWithChildren<{}>) {
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const idToken = hashParams.get('id_token');
    if (idToken) {
      try {
        const user = decodeGoogleCredential(idToken);
        window.localStorage.setItem(GOOGLE_AUTH_STORAGE_KEY, JSON.stringify(user));
        window.localStorage.removeItem(GOOGLE_AUTH_NONCE_STORAGE_KEY);
        setGoogleUser(user);
        window.history.replaceState(null, '', window.location.pathname);
      } catch {
        setError('Unable to read the Google account profile. Please try again.');
      }
      setIsReady(true);
      return;
    }

    const authError = hashParams.get('error');
    if (authError) {
      setError(`Google sign-in failed: ${authError}`);
      window.history.replaceState(null, '', window.location.pathname);
    }

    const storedUser = window.localStorage.getItem(GOOGLE_AUTH_STORAGE_KEY);
    if (storedUser) {
      try {
        setGoogleUser(JSON.parse(storedUser));
      } catch {
        window.localStorage.removeItem(GOOGLE_AUTH_STORAGE_KEY);
      }
    }
    setIsReady(true);
  }, []);

  function signInWithGoogle() {
    if (!googleClientId) {
      setError('Google sign-in is not configured.');
      return;
    }

    window.location.assign(createGoogleAuthUrl(googleClientId));
  }

  function signOut() {
    window.localStorage.removeItem(GOOGLE_AUTH_STORAGE_KEY);
    window.localStorage.removeItem(GOOGLE_AUTH_NONCE_STORAGE_KEY);
    setGoogleUser(null);
  }

  if (!isReady) {
    return (
      <main className={styles.main} data-lk-theme="default">
        <p>Loading</p>
      </main>
    );
  }

  if (!googleUser) {
    return (
      <>
        <main className={styles.main} data-lk-theme="default">
          <section className={styles.loginPanel}>
            <img src="/images/livekit-meet-home.svg" alt="LiveKit Meet" width="320" height="40" />
            <div>
              <h1>Sign in to start a meeting</h1>
              <p>Use your Google account before opening the meeting dashboard.</p>
            </div>
            {googleClientId ? (
              <button
                className={`lk-button ${styles.googleSignInButton}`}
                onClick={signInWithGoogle}
              >
                Continue with Google
              </button>
            ) : (
              <p className={styles.authNotice}>
                Add <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> to <code>.env.local</code> to enable
                Google sign-in.
              </p>
            )}
            {error && <p className={styles.authError}>{error}</p>}
          </section>
        </main>
        <footer data-lk-theme="default">@azeesmath</footer>
      </>
    );
  }

  return (
    <>
      <div className={styles.accountBar} data-lk-theme="default">
        <div className={styles.accountIdentity}>
          {googleUser.picture && <img src={googleUser.picture} alt="" width="32" height="32" />}
          <span>{googleUser.email}</span>
        </div>
        <button className="lk-button" onClick={signOut}>
          Sign out
        </button>
      </div>
      {props.children}
    </>
  );
}

export default function Page() {
  return (
    <GoogleLoginGate>
      <main className={styles.main} data-lk-theme="default">
        <div className="header">
          <img src="/images/livekit-meet-home.svg" alt="LiveKit Meet" width="360" height="45" />
          <h2>Online Meeting App</h2>
        </div>
        <Suspense fallback="Loading">
          <Tabs>
            <DemoMeetingTab label="Demo" />
            <CustomConnectionTab label="Custom" />
          </Tabs>
        </Suspense>
      </main>
      <footer data-lk-theme="default">@azeesmath</footer>
    </GoogleLoginGate>
  );
}
