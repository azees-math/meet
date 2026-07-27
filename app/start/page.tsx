'use client';

import Link from 'next/link';
import { ChevronDown, LogOut, Shield, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import { DemoMeetingPanel, useMeetingRooms } from '@/components/meeting-forms';
import {
  AUTH_SESSION_STORAGE_KEY,
  AUTH_SESSION_START_LOCK_KEY,
  AUTH_STORAGE_KEY,
  AuthSessionState,
  AuthUser,
  GOOGLE_AUTH_NONCE_STORAGE_KEY,
} from '@/lib/auth-session';
import styles from '../../styles/Home.module.css';

export default function StartPage() {
  const router = useRouter();
  const roomNames = useMeetingRooms({ publicOnly: true });
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authSession, setAuthSession] = useState<AuthSessionState | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const pendingSessionUserRef = useRef<string | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  const getSessionUserKey = React.useCallback((user: AuthUser) => {
    return `${user.username}:${user.authMethod}:${user.userType}`;
  }, []);

  const readSessionStartLock = React.useCallback(() => {
    const raw = window.sessionStorage.getItem(AUTH_SESSION_START_LOCK_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as { userKey: string; createdAt: number };
    } catch {
      window.sessionStorage.removeItem(AUTH_SESSION_START_LOCK_KEY);
      return null;
    }
  }, []);

  const writeSessionStartLock = React.useCallback((userKey: string) => {
    window.sessionStorage.setItem(
      AUTH_SESSION_START_LOCK_KEY,
      JSON.stringify({ userKey, createdAt: Date.now() }),
    );
  }, []);

  const clearSessionStartLock = React.useCallback(() => {
    window.sessionStorage.removeItem(AUTH_SESSION_START_LOCK_KEY);
  }, []);

  const startSession = React.useCallback(
    async (user: AuthUser) => {
      const sessionUserKey = getSessionUserKey(user);
      if (pendingSessionUserRef.current === sessionUserKey) {
        return;
      }

      const existingLock = readSessionStartLock();
      if (
        existingLock &&
        existingLock.userKey === sessionUserKey &&
        Date.now() - existingLock.createdAt < 15000
      ) {
        return;
      }

      pendingSessionUserRef.current = sessionUserKey;
      writeSessionStartLock(sessionUserKey);
      try {
        const response = await fetch('/api/auth/session/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: user.username,
            userType: user.userType,
            authMethod: user.authMethod,
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error ?? 'Unable to start session.');
        }
        window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(result));
        setAuthSession(result);
      } catch (sessionError) {
        pendingSessionUserRef.current = null;
        clearSessionStartLock();
        throw sessionError;
      }
    },
    [clearSessionStartLock, getSessionUserKey, readSessionStartLock, writeSessionStartLock],
  );

  const endSession = React.useCallback(
    async (reason: string, useBeacon = false) => {
      const storedSession = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
      if (!storedSession) {
        return;
      }

      let session: AuthSessionState | null = null;
      try {
        session = JSON.parse(storedSession) as AuthSessionState;
      } catch {
        window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
        return;
      }

      const body = JSON.stringify({ sessionId: session.sessionId, reason });
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon('/api/auth/session/end', new Blob([body], { type: 'application/json' }));
      } else {
        await fetch('/api/auth/session/end', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body,
          keepalive: true,
        });
      }

      window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      setAuthSession(null);
      pendingSessionUserRef.current = null;
      clearSessionStartLock();
    },
    [clearSessionStartLock],
  );

  const heartbeatSession = React.useCallback(async (useBeacon = false) => {
    const storedSession = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!storedSession) {
      return;
    }

    let session: AuthSessionState | null = null;
    try {
      session = JSON.parse(storedSession) as AuthSessionState;
    } catch {
      window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      setAuthSession(null);
      return;
    }

    const body = JSON.stringify({
      sessionId: session.sessionId,
    });

    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon('/api/auth/session/heartbeat', new Blob([body], { type: 'application/json' }));
      return;
    }

    await fetch('/api/auth/session/heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
      keepalive: true,
    });
  }, []);

  useEffect(() => {
    const storedUser = window.localStorage.getItem(AUTH_STORAGE_KEY);
    const storedSession = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);

    if (!storedUser) {
      router.replace('/login');
      return;
    }

    try {
      setAuthUser(JSON.parse(storedUser));
    } catch {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      router.replace('/login');
      return;
    }

    if (storedSession) {
      try {
        setAuthSession(JSON.parse(storedSession));
        clearSessionStartLock();
      } catch {
        window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      }
    }

    setIsReady(true);
  }, [clearSessionStartLock, router]);

  useEffect(() => {
    if (!authUser || !isReady) {
      return;
    }
    const authUserKey = getSessionUserKey(authUser);
    const sessionMatchesUser =
      !!authSession &&
      authSession.username === authUser.username &&
      authSession.userType === authUser.userType &&
      authSession.authMethod === authUser.authMethod;

    if (sessionMatchesUser) {
      pendingSessionUserRef.current = null;
      clearSessionStartLock();
      void heartbeatSession();
      return;
    }

    if (pendingSessionUserRef.current === authUserKey) {
      return;
    }

    if (!authSession) {
      void startSession(authUser).catch(() => {
        pendingSessionUserRef.current = null;
        clearSessionStartLock();
        setError('Unable to start the user session.');
      });
    }
  }, [
    authUser,
    authSession,
    clearSessionStartLock,
    getSessionUserKey,
    heartbeatSession,
    isReady,
    startSession,
  ]);

  useEffect(() => {
    if (!authSession) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void heartbeatSession();
    }, 60000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void heartbeatSession();
      }
      if (document.visibilityState === 'hidden') {
        void heartbeatSession(true);
      }
    };

    const handleBeforeUnload = () => {
      void endSession('browser_unload', true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [authSession, endSession, heartbeatSession]);

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isAccountMenuOpen]);

  async function signOut() {
    await endSession('manual_logout');
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.removeItem(GOOGLE_AUTH_NONCE_STORAGE_KEY);
    router.replace('/');
  }

  if (!isReady) {
    return (
      <main className={styles.main} data-lk-theme="default">
        <p>Loading</p>
      </main>
    );
  }

  if (!authUser) {
    return null;
  }

  const displayName =
    [authUser.first_name, authUser.last_name].filter(Boolean).join(' ').trim() || authUser.username;
  const avatarLabel = (authUser.first_name?.[0] ?? authUser.username[0] ?? 'U').toUpperCase();

  return (
    <>
      <div className={styles.accountBar} data-lk-theme="default">
        <div className={styles.accountMenu} ref={accountMenuRef}>
          <button
            type="button"
            className={styles.accountTrigger}
            onClick={() => setIsAccountMenuOpen((current) => !current)}
          >
            {authUser.picture ? (
              <img src={authUser.picture} alt={displayName} width="36" height="36" />
            ) : (
              <div className={styles.accountAvatarFallback}>{avatarLabel}</div>
            )}
            <div className={styles.accountIdentityText}>
              <span>{displayName}</span>
              <span className={styles.accountSubtle}>{authUser.username}</span>
            </div>
            <ChevronDown className={styles.accountChevron} size={16} />
          </button>
          {isAccountMenuOpen ? (
            <div className={styles.accountDropdown}>
              <Link
                href="/profile"
                className={styles.accountDropdownItem}
                onClick={() => setIsAccountMenuOpen(false)}
              >
                <User size={16} />
                <span>Profile</span>
              </Link>
              {authUser.userType === 'admin' ? (
                <Link
                  href="/admin"
                  className={styles.accountDropdownItem}
                  onClick={() => setIsAccountMenuOpen(false)}
                >
                  <Shield size={16} />
                  <span>Admin</span>
                </Link>
              ) : null}
              <button
                type="button"
                className={styles.accountDropdownDanger}
                onClick={() => {
                  setIsAccountMenuOpen(false);
                  void signOut();
                }}
              >
                <LogOut size={16} />
                <span>Sign out</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {error ? (
        <div className={styles.accountNotice} data-lk-theme="default">
          <p className={styles.authError}>{error}</p>
        </div>
      ) : null}
      <main className={styles.main} data-lk-theme="default">
        <section className={styles.loginPanel}>
          <img src="/images/livekit-meet-home.svg" alt="LiveKit Meet" width="320" height="40" />
          <div>
            <h1>Start a meeting</h1>
            <p>Pick a meeting room and start a session.</p>
          </div>
          <DemoMeetingPanel roomNames={roomNames} />
        </section>
      </main>
      <footer data-lk-theme="default">@azeesmath</footer>
    </>
  );
}
