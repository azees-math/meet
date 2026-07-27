import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { getMongoDb } from '@/lib/mongodb';

const COLLECTION_NAME = 'meetusers';
const KEY_LENGTH = 64;
const SAMPLE_MEET_USERS = [
  { username: 'admin', password: 'admin123', userType: 'admin' },
  { username: 'demo', password: 'demo123', userType: 'user' },
  { username: 'host', password: 'host123', userType: 'user' },
] as const;

export type MeetUserType = 'admin' | 'user';

export type MeetUserDocument = {
  username: string;
  passwordHash: string;
  userType: MeetUserType;
  createdAt: Date;
  updatedAt: Date;
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

async function getMeetUsersCollection() {
  const db = await getMongoDb();
  const collection = db.collection<MeetUserDocument>(COLLECTION_NAME);
  await collection.createIndex({ username: 1 }, { unique: true });
  return collection;
}

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export async function ensureSampleMeetUsers() {
  const collection = await getMeetUsersCollection();
  const now = new Date();

  await Promise.all(
    SAMPLE_MEET_USERS.map(({ username, password, userType }) =>
      collection.updateOne(
        { username },
        {
          $set: {
            userType,
            updatedAt: now,
          },
          $setOnInsert: {
            username,
            passwordHash: hashPassword(password),
            createdAt: now,
          },
        },
        { upsert: true },
      ),
    ),
  );
}

export async function verifyMeetUser(username: string, password: string) {
  const collection = await getMeetUsersCollection();

  const existingUser = await collection.findOne({ username });
  if (!existingUser) {
    return { status: 'not-found' as const };
  }

  if (!verifyPassword(password, existingUser.passwordHash)) {
    return { status: 'invalid-password' as const };
  }

  await collection.updateOne({ username }, { $set: { updatedAt: new Date() } });
  return { status: 'authenticated' as const, userType: existingUser.userType ?? 'user' };
}

export async function createMeetUser(params: {
  username: string;
  password: string;
  userType: MeetUserType;
}) {
  const collection = await getMeetUsersCollection();
  const now = new Date();
  const username = normalizeUsername(params.username);

  await collection.insertOne({
    username,
    passwordHash: hashPassword(params.password),
    userType: params.userType,
    createdAt: now,
    updatedAt: now,
  });

  return {
    username,
    userType: params.userType,
    createdAt: now.toISOString(),
  };
}

export async function listMeetUsers() {
  return listMeetUsersPage({ page: 1, pageSize: 500 });
}

export async function listMeetUsersPage(params: {
  page: number;
  pageSize: number;
}) {
  const collection = await getMeetUsersCollection();
  const page = Math.max(1, params.page);
  const pageSize = Math.max(1, Math.min(params.pageSize, 100));
  const skip = (page - 1) * pageSize;

  const [users, total] = await Promise.all([
    collection
      .find(
        {},
        {
          projection: {
            _id: 0,
            username: 1,
            userType: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      )
      .sort({ username: 1 })
      .skip(skip)
      .limit(pageSize)
      .toArray(),
    collection.countDocuments({}),
  ]);

  return {
    users: users.map((user) => ({
      username: user.username,
      userType: user.userType,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function updateMeetUser(params: {
  username: string;
  userType?: MeetUserType;
  password?: string;
}) {
  const collection = await getMeetUsersCollection();
  const username = normalizeUsername(params.username);
  const update: {
    userType?: MeetUserType;
    passwordHash?: string;
    updatedAt: Date;
  } = {
    updatedAt: new Date(),
  };

  if (params.userType) {
    update.userType = params.userType;
  }

  if (params.password) {
    update.passwordHash = hashPassword(params.password);
  }

  const result = await collection.findOneAndUpdate(
    { username },
    { $set: update },
    { returnDocument: 'after' },
  );

  if (!result) {
    return null;
  }

  return {
    username: result.username,
    userType: result.userType,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  };
}

export async function deleteMeetUser(username: string) {
  const collection = await getMeetUsersCollection();
  const normalizedUsername = normalizeUsername(username);
  const result = await collection.findOneAndDelete({ username: normalizedUsername });
  return result;
}
