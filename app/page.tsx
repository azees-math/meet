'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { JoinMeetingPanel, useMeetingRooms } from '@/components/meeting-forms';
import { AUTH_STORAGE_KEY, GOOGLE_AUTH_NONCE_STORAGE_KEY } from '@/lib/auth-session';
import { decodeGoogleCredential } from '@/lib/google-auth';
import styles from '../styles/Home.module.css';

export default function Page() {
  const router = useRouter();
  const roomNames = useMeetingRooms();
  const [error, setError] = React.useState<string | null>(null);
  const [isReady, setIsReady] = React.useState(false);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const idToken = hashParams.get('id_token');
    if (idToken) {
      try {
        const user = decodeGoogleCredential(idToken);
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
        window.localStorage.removeItem(GOOGLE_AUTH_NONCE_STORAGE_KEY);
        window.history.replaceState(null, '', window.location.pathname);
        router.replace('/start');
        return;
      } catch {
        setError('Unable to read the Google account profile. Please try again.');
      }
    }

    const authError = hashParams.get('error');
    if (authError) {
      setError(`Google sign-in failed: ${authError}`);
      window.history.replaceState(null, '', window.location.pathname);
    }

    const storedUser = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (storedUser) {
      try {
        JSON.parse(storedUser);
        router.replace('/start');
        return;
      } catch {
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }

    setIsReady(true);
  }, [router]);

  if (!isReady) {
    return (
      <main className={styles.main} data-lk-theme="default">
        <p>Loading</p>
      </main>
    );
  }

  return (
    <>
      <main className={styles.main} data-lk-theme="default">
        <section className={styles.loginPanel}>
          <img src="/images/livekit-meet-home.svg" alt="LiveKit Meet" width="320" height="40" />
          <div>
            <h1>Join a meeting</h1>
            <p>Enter meeting ID and password to join directly. Sign in is available on a separate page.</p>
          </div>
          <JoinMeetingPanel roomNames={roomNames} />
          <Link href="/login" className={`lk-button ${styles.secondaryActionButton}`}>
            Sign in
          </Link>
          {error ? <p className={styles.authError}>{error}</p> : null}
        </section>
      </main>
      <footer data-lk-theme="default">@azeesmath</footer>
    </>
  );
}
