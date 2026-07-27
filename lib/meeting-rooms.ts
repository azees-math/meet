import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import { ObjectId } from 'mongodb';
import { getMongoDb } from '@/lib/mongodb';

const ROOMS_COLLECTION = 'meetrooms';
const ROOM_ACCESS_COLLECTION = 'meetroom_access_tokens';
const ROOM_AUDIT_COLLECTION = 'meetroom_access_logs';
const KEY_LENGTH = 64;

const SAMPLE_MEETING_ROOMS = [
  { roomName: 'meeting-room-01', password: 'meeting-room-01', meetType: 'public' },
  { roomName: 'meeting-room-02', password: 'meeting-room-02', meetType: 'public' },
  { roomName: 'meeting-room-03', password: 'meeting-room-03', meetType: 'public' },
  { roomName: 'meeting-room-04', password: 'meeting-room-04', meetType: 'public' },
  { roomName: 'meeting-room-05', password: 'meeting-room-05', meetType: 'public' },
  { roomName: 'meeting-room-06', password: 'meeting-room-06', meetType: 'private' },
  { roomName: 'meeting-room-07', password: 'meeting-room-07', meetType: 'private' },
  { roomName: 'meeting-room-08', password: 'meeting-room-08', meetType: 'private' },
  { roomName: 'meeting-room-09', password: 'meeting-room-09', meetType: 'private' },
  { roomName: 'meeting-room-10', password: 'meeting-room-10', meetType: 'private' },
] as const;

export type MeetingType = 'public' | 'private';

type MeetingRoomDocument = {
  roomName: string;
  passwordHash: string;
  meetType: MeetingType;
  createdAt: Date;
  updatedAt: Date;
};

type MeetingRoomAccessTokenDocument = {
  token: string;
  roomName: string;
  createdAt: Date;
  expiresAt: Date;
};

type MeetingRoomAccessLogDocument = {
  roomName: string;
  participantName: string;
  accessType: 'guest' | 'authenticated';
  username: string | null;
  userType: 'admin' | 'user' | null;
  createdAt: Date;
};

function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password: string, passwordHash: string) {
  const [salt, storedHash] = passwordHash.split(':');
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);
  const storedKey = Buffer.from(storedHash, 'hex');
  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}

export function normalizeMeetingRoomName(roomName: string) {
  return roomName.trim().toLowerCase();
}

async function getMeetingRoomCollections() {
  const db = await getMongoDb();
  const rooms = db.collection<MeetingRoomDocument>(ROOMS_COLLECTION);
  const accessTokens = db.collection<MeetingRoomAccessTokenDocument>(ROOM_ACCESS_COLLECTION);
  const accessLogs = db.collection<MeetingRoomAccessLogDocument>(ROOM_AUDIT_COLLECTION);

  await Promise.all([
    rooms.createIndex({ roomName: 1 }, { unique: true }),
    accessTokens.createIndex({ token: 1 }, { unique: true }),
    accessTokens.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    accessTokens.createIndex({ roomName: 1, expiresAt: -1 }),
    accessLogs.createIndex({ roomName: 1, createdAt: -1 }),
    accessLogs.createIndex({ createdAt: -1 }),
  ]);

  return { rooms, accessTokens, accessLogs };
}

export async function ensureSampleMeetingRooms() {
  const { rooms } = await getMeetingRoomCollections();
  const existingCount = await rooms.countDocuments({});
  if (existingCount > 0) {
    return;
  }

  const now = new Date();

  await Promise.all(
    SAMPLE_MEETING_ROOMS.map(({ roomName, password, meetType }) =>
      rooms.updateOne(
        { roomName },
        {
          $set: {
            meetType,
            updatedAt: now,
          },
          $setOnInsert: {
            roomName,
            passwordHash: hashPassword(password),
            createdAt: now,
          },
        },
        { upsert: true },
      ),
    ),
  );
}

export async function listMeetingRooms() {
  const result = await listMeetingRoomsPage({ page: 1, pageSize: 500 });
  return result.rooms;
}

export async function listMeetingRoomsPage(params: {
  page: number;
  pageSize: number;
  meetType?: MeetingType;
}) {
  const { rooms } = await getMeetingRoomCollections();
  const page = Math.max(1, params.page);
  const pageSize = Math.max(1, Math.min(params.pageSize, 100));
  const skip = (page - 1) * pageSize;
  const query = params.meetType ? { meetType: params.meetType } : {};

  const [result, total] = await Promise.all([
    rooms
      .find(
        query,
        {
          projection: {
            _id: 0,
            roomName: 1,
            meetType: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      )
      .sort({ roomName: 1 })
      .skip(skip)
      .limit(pageSize)
      .toArray(),
    rooms.countDocuments(query),
  ]);

  return {
    rooms: result.map((room) => ({
      roomName: room.roomName,
      meetType: room.meetType ?? 'private',
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getMeetingRoom(roomName: string) {
  const { rooms } = await getMeetingRoomCollections();
  const normalizedRoomName = normalizeMeetingRoomName(roomName);
  return rooms.findOne({ roomName: normalizedRoomName });
}

export async function verifyMeetingRoomPassword(roomName: string, password: string) {
  const room = await getMeetingRoom(roomName);
  if (!room) {
    return { status: 'not-found' as const };
  }

  if (!verifyPassword(password, room.passwordHash)) {
    return { status: 'invalid-password' as const };
  }

  return { status: 'authorized' as const, roomName: room.roomName };
}

export async function issueMeetingRoomAccessToken(roomName: string, ttlMinutes = 30) {
  const { accessTokens } = await getMeetingRoomCollections();
  const token = randomUUID();
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + ttlMinutes * 60 * 1000);
  const normalizedRoomName = normalizeMeetingRoomName(roomName);

  await accessTokens.insertOne({
    token,
    roomName: normalizedRoomName,
    createdAt,
    expiresAt,
  });

  return {
    accessToken: token,
    roomName: normalizedRoomName,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function verifyMeetingRoomAccessToken(roomName: string, token: string) {
  const { accessTokens } = await getMeetingRoomCollections();
  const normalizedRoomName = normalizeMeetingRoomName(roomName);
  const accessToken = await accessTokens.findOne({
    token,
    roomName: normalizedRoomName,
    expiresAt: { $gt: new Date() },
  });

  return !!accessToken;
}

export async function createMeetingRoom(params: {
  roomName: string;
  password: string;
  meetType: MeetingType;
}) {
  const { rooms } = await getMeetingRoomCollections();
  const roomName = normalizeMeetingRoomName(params.roomName);
  const now = new Date();

  await rooms.insertOne({
    roomName,
    passwordHash: hashPassword(params.password),
    meetType: params.meetType,
    createdAt: now,
    updatedAt: now,
  });

  return {
    roomName,
    meetType: params.meetType,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export async function updateMeetingRoom(params: {
  roomName: string;
  password?: string;
  meetType?: MeetingType;
}) {
  const { rooms } = await getMeetingRoomCollections();
  const roomName = normalizeMeetingRoomName(params.roomName);
  const update: {
    updatedAt: Date;
    passwordHash?: string;
    meetType?: MeetingType;
  } = {
    updatedAt: new Date(),
  };

  if (params.password) {
    update.passwordHash = hashPassword(params.password);
  }

  if (params.meetType) {
    update.meetType = params.meetType;
  }

  const result = await rooms.findOneAndUpdate(
    { roomName },
    { $set: update },
    { returnDocument: 'after' },
  );

  if (!result) {
    return null;
  }

  return {
    roomName: result.roomName,
    meetType: result.meetType ?? 'private',
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  };
}

export async function deleteMeetingRoom(roomName: string) {
  const { rooms, accessTokens, accessLogs } = await getMeetingRoomCollections();
  const normalizedRoomName = normalizeMeetingRoomName(roomName);
  const result = await rooms.findOneAndDelete({ roomName: normalizedRoomName });

  if (result) {
    await Promise.all([
      accessTokens.deleteMany({ roomName: normalizedRoomName }),
      accessLogs.deleteMany({ roomName: normalizedRoomName }),
    ]);
  }

  return result;
}

export async function insertMeetingRoomAccessLog(params: {
  roomName: string;
  participantName: string;
  accessType: 'guest' | 'authenticated';
  username?: string | null;
  userType?: 'admin' | 'user' | null;
}) {
  const { accessLogs } = await getMeetingRoomCollections();
  await accessLogs.insertOne({
    roomName: normalizeMeetingRoomName(params.roomName),
    participantName: params.participantName.trim(),
    accessType: params.accessType,
    username: params.username ?? null,
    userType: params.userType ?? null,
    createdAt: new Date(),
  });
}

export async function listMeetingRoomAccessLogsPage(params: {
  page: number;
  pageSize: number;
  roomName?: string;
}) {
  const { accessLogs } = await getMeetingRoomCollections();
  const page = Math.max(1, params.page);
  const pageSize = Math.max(1, Math.min(params.pageSize, 100));
  const skip = (page - 1) * pageSize;
  const query = params.roomName
    ? { roomName: normalizeMeetingRoomName(params.roomName) }
    : {};

  const [logs, total] = await Promise.all([
    accessLogs.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize).toArray(),
    accessLogs.countDocuments(query),
  ]);

  return {
    logs: logs.map((log) => ({
      id: String((log as MeetingRoomAccessLogDocument & { _id: ObjectId })._id),
      roomName: log.roomName,
      participantName: log.participantName,
      accessType: log.accessType,
      username: log.username,
      userType: log.userType,
      createdAt: log.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
