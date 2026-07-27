import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { getMongoDb } from '@/lib/mongodb';

const COLLECTION_NAME = 'meetusers';
const KEY_LENGTH = 64;
const SAMPLE_MEET_USERS = [
  {
    username: 'admin',
    password: 'admin123',
    userType: 'admin',
    first_name: 'Admin',
    last_name: 'User',
    email: 'admin@example.com',
    phoneno: '081111111111',
  },
  {
    username: 'demo',
    password: 'demo123',
    userType: 'user',
    first_name: 'Demo',
    last_name: 'User',
    email: 'demo@example.com',
    phoneno: '082222222222',
  },
  {
    username: 'host',
    password: 'host123',
    userType: 'user',
    first_name: 'Host',
    last_name: 'User',
    email: 'host@example.com',
    phoneno: '083333333333',
  },
] as const;

export type MeetUserType = 'admin' | 'user';

export type MeetUserDocument = {
  username: string;
  passwordHash: string;
  userType: MeetUserType;
  first_name: string;
  last_name: string;
  email: string;
  phoneno: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MeetUserProfile = {
  first_name?: string;
  last_name?: string;
  email?: string;
  phoneno?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+\-() ]{8,20}$/;

export function validateMeetUserProfile(profile: MeetUserProfile) {
  const email = profile.email?.trim() ?? '';
  const phoneno = profile.phoneno?.trim() ?? '';

  if (email && !EMAIL_PATTERN.test(email)) {
    return 'Invalid email format.';
  }

  if (phoneno && !PHONE_PATTERN.test(phoneno)) {
    return 'Invalid phone number format.';
  }

  return null;
}

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
    SAMPLE_MEET_USERS.map(({ username, password, userType, first_name, last_name, email, phoneno }) =>
      collection.updateOne(
        { username },
        {
          $set: {
            userType,
            first_name,
            last_name,
            email,
            phoneno,
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
  return {
    status: 'authenticated' as const,
    userType: existingUser.userType ?? 'user',
    first_name: existingUser.first_name ?? '',
    last_name: existingUser.last_name ?? '',
    email: existingUser.email ?? '',
    phoneno: existingUser.phoneno ?? '',
  };
}

export async function getMeetUser(username: string) {
  const collection = await getMeetUsersCollection();
  const normalizedUsername = normalizeUsername(username);
  const user = await collection.findOne(
    { username: normalizedUsername },
    {
      projection: {
        _id: 0,
        username: 1,
        userType: 1,
        first_name: 1,
        last_name: 1,
        email: 1,
        phoneno: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  );

  if (!user) {
    return null;
  }

  return {
    username: user.username,
    userType: user.userType,
    first_name: user.first_name ?? '',
    last_name: user.last_name ?? '',
    email: user.email ?? '',
    phoneno: user.phoneno ?? '',
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function createMeetUser(params: {
  username: string;
  password: string;
  userType: MeetUserType;
  first_name?: string;
  last_name?: string;
  email?: string;
  phoneno?: string;
}) {
  const collection = await getMeetUsersCollection();
  const now = new Date();
  const username = normalizeUsername(params.username);

  await collection.insertOne({
    username,
    passwordHash: hashPassword(params.password),
    userType: params.userType,
    first_name: params.first_name?.trim() ?? '',
    last_name: params.last_name?.trim() ?? '',
    email: params.email?.trim() ?? '',
    phoneno: params.phoneno?.trim() ?? '',
    createdAt: now,
    updatedAt: now,
  });

  return {
    username,
    userType: params.userType,
    first_name: params.first_name?.trim() ?? '',
    last_name: params.last_name?.trim() ?? '',
    email: params.email?.trim() ?? '',
    phoneno: params.phoneno?.trim() ?? '',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
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
          first_name: 1,
          last_name: 1,
          email: 1,
          phoneno: 1,
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
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? '',
      email: user.email ?? '',
      phoneno: user.phoneno ?? '',
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
  first_name?: string;
  last_name?: string;
  email?: string;
  phoneno?: string;
}) {
  const collection = await getMeetUsersCollection();
  const username = normalizeUsername(params.username);
  const update: {
    userType?: MeetUserType;
    passwordHash?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phoneno?: string;
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

  if (params.first_name !== undefined) {
    update.first_name = params.first_name.trim();
  }

  if (params.last_name !== undefined) {
    update.last_name = params.last_name.trim();
  }

  if (params.email !== undefined) {
    update.email = params.email.trim();
  }

  if (params.phoneno !== undefined) {
    update.phoneno = params.phoneno.trim();
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
    first_name: result.first_name ?? '',
    last_name: result.last_name ?? '',
    email: result.email ?? '',
    phoneno: result.phoneno ?? '',
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
