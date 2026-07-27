'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import {
  AUTH_STORAGE_KEY,
  AuthUser,
} from '@/lib/auth-session';
import { createGoogleAuthUrl } from '@/lib/google-auth';
import styles from '../../styles/Home.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    const storedUser = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!storedUser) {
      return;
    }

    try {
      JSON.parse(storedUser);
      router.replace('/start');
    } catch {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [router]);

  async function signInWithPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const username = String(formData.get('username') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? 'Unable to sign in.');
        return;
      }

      const user: AuthUser = {
        username: result.username as string,
        userType: result.userType as 'admin' | 'user',
        first_name: result.first_name as string,
        last_name: result.last_name as string,
        email: result.email as string,
        phoneno: result.phoneno as string,
        authMethod: 'password',
      };
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
      router.replace('/start');
    } catch {
      setError('Unable to reach the login service.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function signInWithGoogle() {
    if (!googleClientId) {
      setError('Google sign-in is not configured.');
      return;
    }

    setError(null);
    window.location.assign(createGoogleAuthUrl(googleClientId));
  }

  return (
    <>
      <main className={styles.main} data-lk-theme="default">
        <section className={styles.loginPanel}>
          <img src="/images/livekit-meet-home.svg" alt="LiveKit Meet" width="320" height="40" />
          <div>
            <h1>Sign in</h1>
            <p>Use Google or sign in with a meeting username and password.</p>
          </div>
          {googleClientId ? (
            <>
              <button className={`lk-button ${styles.primaryAuthButton}`} onClick={signInWithGoogle}>
                Continue with Google
              </button>
              <div className={styles.authDivider}>
                <span>or</span>
              </div>
            </>
          ) : null}
          <form className={styles.loginForm} onSubmit={signInWithPassword}>
            <input
              name="username"
              type="text"
              placeholder="Username"
              autoComplete="username"
              required
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              required
            />
            <button
              className={`lk-button ${styles.primaryAuthButton}`}
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <Link href="/" className={`lk-button ${styles.secondaryActionButton}`}>
            Back to Join Meeting
          </Link>
          {error ? <p className={styles.authError}>{error}</p> : null}
        </section>
      </main>
      <footer data-lk-theme="default">@azeesmath</footer>
    </>
  );
}
