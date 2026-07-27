'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { encodePassphrase, randomString } from '@/lib/client-utils';
import styles from '@/styles/Home.module.css';

export type MeetingRoomSummary = {
  roomName: string;
  meetType: 'public' | 'private';
  createdAt: string;
  updatedAt: string;
};

export function useMeetingRooms(options?: { publicOnly?: boolean }) {
  const [roomNames, setRoomNames] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadMeetingRooms = async () => {
      try {
        const params = new URLSearchParams();
        if (options?.publicOnly) {
          params.set('publicOnly', 'true');
        }
        const response = await fetch(`/api/meeting-rooms${params.toString() ? `?${params.toString()}` : ''}`);
        const result = (await response.json()) as { rooms?: MeetingRoomSummary[] };
        if (!response.ok || !result.rooms) {
          return;
        }

        if (isMounted) {
          setRoomNames(result.rooms.map((room) => room.roomName));
        }
      } catch {
        if (isMounted) {
          setRoomNames([]);
        }
      }
    };

    void loadMeetingRooms();

    return () => {
      isMounted = false;
    };
  }, [options?.publicOnly]);

  return roomNames;
}

export function DemoMeetingPanel(props: { roomNames: string[] }) {
  const router = useRouter();
  const [roomName, setRoomName] = useState(props.roomNames[0] ?? '');
  const [e2ee, setE2ee] = useState(false);
  const [sharedPassphrase, setSharedPassphrase] = useState(randomString(64));

  useEffect(() => {
    if (!roomName && props.roomNames[0]) {
      setRoomName(props.roomNames[0]);
    }
  }, [props.roomNames, roomName]);

  const startMeeting = () => {
    if (!roomName) {
      return;
    }

    const encodedRoomName = encodeURIComponent(roomName);
    if (e2ee) {
      router.push(`/rooms/${encodedRoomName}#${encodePassphrase(sharedPassphrase)}`);
    } else {
      router.push(`/rooms/${encodedRoomName}`);
    }
  };

  return (
    <div className={styles.tabContent}>
      <div className={styles.roomField}>
        <div className={styles.roomFieldHeader}>
          <label htmlFor="roomName">Meeting room</label>
          <span>{props.roomNames.length} rooms available</span>
        </div>
        <select
          id="roomName"
          name="roomName"
          value={roomName}
          onChange={(ev) => setRoomName(ev.target.value)}
          disabled={props.roomNames.length === 0}
        >
          {props.roomNames.map((room, index) => (
            <option key={room} value={room}>
              Room {index + 1}: {room}
            </option>
          ))}
        </select>
        <p></p>
      </div>
      <button
        className={`lk-button ${styles.startMeetingButton}`}
        onClick={startMeeting}
        disabled={!roomName}
      >
        Start Meeting
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className={styles.inlineCheckboxRow}>
          <input
            className={styles.inlineCheckbox}
            id="use-e2ee"
            type="checkbox"
            checked={e2ee}
            onChange={(ev) => setE2ee(ev.target.checked)}
          />
          <label htmlFor="use-e2ee">Enable end-to-end encryption</label>
        </div>
        {e2ee ? (
          <div style={{ display: 'flex', flexDirection: 'row', gap: '1rem' }}>
            <label htmlFor="passphrase">Passphrase</label>
            <input
              id="passphrase"
              type="password"
              value={sharedPassphrase}
              onChange={(ev) => setSharedPassphrase(ev.target.value)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function JoinMeetingPanel(props: { roomNames: string[] }) {
  const router = useRouter();
  const [roomName, setRoomName] = useState(props.roomNames[0] ?? '');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomName && props.roomNames[0]) {
      setRoomName(props.roomNames[0]);
    }
  }, [props.roomNames, roomName]);

  async function joinMeeting(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/meeting-rooms/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomName, password }),
      });
      const result = (await response.json()) as {
        accessToken?: string;
        roomName?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? 'Unable to join meeting.');
      }

      router.push(
        `/rooms/${encodeURIComponent(result.roomName ?? roomName)}?accessToken=${encodeURIComponent(
          result.accessToken ?? '',
        )}`,
      );
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Unable to join meeting.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.tabContent} onSubmit={joinMeeting}>
      <div className={styles.roomField}>
        <div className={styles.roomFieldHeader}>
          <label htmlFor="joinRoomName">Meeting ID / room</label>
          <span>Password required</span>
        </div>
        <input
          id="joinRoomName"
          name="roomName"
          list="meeting-room-list"
          value={roomName}
          onChange={(event) => setRoomName(event.target.value)}
          placeholder="meeting-room-01"
          required
        />
        <datalist id="meeting-room-list">
          {props.roomNames.map((room) => (
            <option key={room} value={room} />
          ))}
        </datalist>
      </div>
      <input
        name="password"
        type="password"
        placeholder="Meeting password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      <button
        className={`lk-button ${styles.primaryAuthButton}`}
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Joining...' : 'Join Meeting'}
      </button>
      {error ? <p className={styles.authError}>{error}</p> : null}
    </form>
  );
}
