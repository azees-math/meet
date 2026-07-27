'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import {
  AUTH_SESSION_STORAGE_KEY,
  AUTH_STORAGE_KEY,
  AuthSessionState,
  AuthUser,
} from '@/lib/auth-session';
import styles from '../../styles/Home.module.css';

type ProfileForm = {
  first_name: string;
  last_name: string;
  email: string;
  phoneno: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authSession, setAuthSession] = useState<AuthSessionState | null>(null);
  const [form, setForm] = useState<ProfileForm>({
    first_name: '',
    last_name: '',
    email: '',
    phoneno: '',
  });
  const [isReady, setIsReady] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = window.localStorage.getItem(AUTH_STORAGE_KEY);
    const storedSession = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);

    if (!storedUser) {
      router.replace('/login');
      return;
    }

    try {
      const user = JSON.parse(storedUser) as AuthUser;
      setAuthUser(user);
      setForm({
        first_name: user.first_name ?? '',
        last_name: user.last_name ?? '',
        email: user.email ?? '',
        phoneno: user.phoneno ?? '',
      });
    } catch {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      router.replace('/login');
      return;
    }

    if (storedSession) {
      try {
        setAuthSession(JSON.parse(storedSession) as AuthSessionState);
      } catch {
        window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      }
    }

    setIsReady(true);
  }, [router]);

  useEffect(() => {
    if (!authSession) {
      return;
    }

    const loadProfile = async () => {
      try {
        const response = await fetch('/api/auth/profile', {
          headers: {
            'x-session-id': authSession.sessionId,
          },
        });
        const result = (await response.json()) as {
          error?: string;
          user?: ProfileForm;
        };

        if (!response.ok) {
          throw new Error(result.error ?? 'Unable to load profile.');
        }

        if (result.user) {
          setForm(result.user);
          setAuthUser((currentUser) => {
            if (!currentUser) {
              return currentUser;
            }

            const nextUser: AuthUser = {
              ...currentUser,
              ...result.user,
            };
            window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser));
            return nextUser;
          });
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Unable to load profile.');
      }
    };

    if (authUser?.authMethod === 'password') {
      void loadProfile();
    }
  }, [authSession, authUser?.authMethod]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authUser || !authSession || authUser.authMethod !== 'password') {
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': authSession.sessionId,
        },
        body: JSON.stringify(form),
      });
      const result = (await response.json()) as {
        error?: string;
        user?: ProfileForm;
      };

      if (!response.ok) {
        throw new Error(result.error ?? 'Unable to update profile.');
      }

      const nextUser: AuthUser = {
        ...authUser,
        first_name: result.user?.first_name ?? '',
        last_name: result.user?.last_name ?? '',
        email: result.user?.email ?? '',
        phoneno: result.user?.phoneno ?? '',
      };
      setAuthUser(nextUser);
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser));
      setIsEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update profile.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isReady || !authUser) {
    return (
      <main className={styles.main} data-lk-theme="default">
        <p>Loading</p>
      </main>
    );
  }

  const displayName =
    [authUser.first_name, authUser.last_name].filter(Boolean).join(' ').trim() || authUser.username;
  const isReadOnly = authUser.authMethod !== 'password';

  return (
    <>
      <main className={styles.main} data-lk-theme="default">
        <section className={styles.profilePanel}>
          <div className={styles.profileHeader}>
            <div>
              <h1>{displayName}</h1>
              <p>{authUser.username}</p>
            </div>
            <div className={styles.profileActions}>
              <Link href="/start" className="lk-button">
                Back
              </Link>
              {!isReadOnly ? (
                <button
                  type="button"
                  className="lk-button"
                  onClick={() => setIsEditing((value) => !value)}
                >
                  {isEditing ? 'Cancel' : 'Edit'}
                </button>
              ) : null}
            </div>
          </div>

          {isReadOnly ? (
            <div className={styles.authNotice}>Google account profile is read-only here.</div>
          ) : null}
          {error ? <div className={styles.authError}>{error}</div> : null}

          <form className={styles.profileForm} onSubmit={handleSave}>
            <label className={styles.profileField}>
              <span>First name</span>
              <input
                type="text"
                value={form.first_name}
                onChange={(event) => setForm((value) => ({ ...value, first_name: event.target.value }))}
                disabled={!isEditing || isReadOnly}
              />
            </label>
            <label className={styles.profileField}>
              <span>Last name</span>
              <input
                type="text"
                value={form.last_name}
                onChange={(event) => setForm((value) => ({ ...value, last_name: event.target.value }))}
                disabled={!isEditing || isReadOnly}
              />
            </label>
            <label className={styles.profileField}>
              <span>Email</span>
              <input
                type="email"
                pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
                value={form.email}
                onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))}
                disabled={!isEditing || isReadOnly}
              />
            </label>
            <label className={styles.profileField}>
              <span>Phone number</span>
              <input
                type="text"
                pattern="[0-9+\-() ]{8,20}"
                value={form.phoneno}
                onChange={(event) => setForm((value) => ({ ...value, phoneno: event.target.value }))}
                disabled={!isEditing || isReadOnly}
              />
            </label>
            <label className={styles.profileField}>
              <span>Username</span>
              <input type="text" value={authUser.username} disabled />
            </label>
            <label className={styles.profileField}>
              <span>Auth method</span>
              <input type="text" value={authUser.authMethod} disabled />
            </label>
            {!isReadOnly && isEditing ? (
              <button
                type="submit"
                className={`lk-button ${styles.primaryAuthButton}`}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save Profile'}
              </button>
            ) : null}
          </form>
        </section>
      </main>
      <footer data-lk-theme="default">@azeesmath</footer>
    </>
  );
}
