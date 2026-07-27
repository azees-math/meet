import { randomUUID } from 'crypto';
import { ObjectId } from 'mongodb';
import { getMongoDb } from '@/lib/mongodb';
import { AuthMethod, UserType } from '@/lib/auth-session';

const SESSIONS_COLLECTION = 'meetuser_sessions';
const ACTIVITY_COLLECTION = 'meetuser_activity_logs';

export type UserSessionDocument = {
  sessionId: string;
  sessionKey: string | null;
  username: string;
  userType: UserType;
  authMethod: AuthMethod;
  status: 'online' | 'offline';
  startedAt: Date;
  lastSeenAt: Date;
  endedAt: Date | null;
};

export type UserActivityDocument = {
  sessionId: string;
  username: string;
  userType: UserType;
  activityType: string;
  details?: Record<string, unknown>;
  createdAt: Date;
};

async function getSessionCollections() {
  const db = await getMongoDb();
  const sessions = db.collection<UserSessionDocument>(SESSIONS_COLLECTION);
  const activity = db.collection<UserActivityDocument>(ACTIVITY_COLLECTION);

  await Promise.all([
    sessions.createIndex({ sessionId: 1 }, { unique: true }),
    sessions.createIndex({ status: 1, lastSeenAt: -1 }),
    sessions.createIndex({ username: 1, startedAt: -1 }),
    activity.createIndex({ sessionId: 1, createdAt: -1 }),
    activity.createIndex({ username: 1, createdAt: -1 }),
  ]);

  return { sessions, activity };
}

function getSessionKey(params: {
  username: string;
  userType: UserType;
  authMethod: AuthMethod;
}) {
  return `${params.username}:${params.authMethod}:${params.userType}`;
}

async function insertActivityLog(params: {
  sessionId: string;
  username: string;
  userType: UserType;
  activityType: string;
  details?: Record<string, unknown>;
}) {
  const { activity } = await getSessionCollections();
  await activity.insertOne({
    sessionId: params.sessionId,
    username: params.username,
    userType: params.userType,
    activityType: params.activityType,
    details: params.details,
    createdAt: new Date(),
  });
}

export async function createUserSession(params: {
  username: string;
  userType: UserType;
  authMethod: AuthMethod;
}) {
  const { sessions } = await getSessionCollections();
  const now = new Date();
  const sessionId = randomUUID();
  const sessionKey = getSessionKey(params);

  const result = await sessions.findOneAndUpdate(
    {
      sessionKey,
      status: 'online',
    },
    {
      $set: {
        lastSeenAt: now,
      },
      $setOnInsert: {
        sessionId,
        sessionKey,
        username: params.username,
        userType: params.userType,
        authMethod: params.authMethod,
        status: 'online',
        startedAt: now,
        endedAt: null,
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
      includeResultMetadata: true,
    },
  );

  const session = result.value;
  if (!session) {
    throw new Error('Unable to create or load user session.');
  }

  if (!result.lastErrorObject?.updatedExisting) {
    await insertActivityLog({
      sessionId: session.sessionId,
      username: session.username,
      userType: session.userType,
      activityType: 'login',
      details: {
        authMethod: session.authMethod,
      },
    });
  }

  return {
    sessionId: session.sessionId,
    username: session.username,
    userType: session.userType,
    authMethod: session.authMethod,
    startedAt: session.startedAt.toISOString(),
  };
}

export async function touchUserSession(params: {
  sessionId: string;
}) {
  const { sessions } = await getSessionCollections();
  const now = new Date();
  const existingSession = await sessions.findOneAndUpdate(
    { sessionId: params.sessionId },
    {
      $set: {
        lastSeenAt: now,
        status: 'online',
      },
    },
    { returnDocument: 'after' },
  );

  if (!existingSession) {
    return null;
  }

  return existingSession;
}

export async function endUserSession(params: {
  sessionId: string;
  reason?: string;
}) {
  const { sessions } = await getSessionCollections();
  const now = new Date();
  const existingSession = await sessions.findOneAndUpdate(
    { sessionId: params.sessionId, status: 'online' },
    {
      $set: {
        status: 'offline',
        sessionKey: null,
        lastSeenAt: now,
        endedAt: now,
      },
    },
    { returnDocument: 'after' },
  );

  if (!existingSession) {
    return null;
  }

  await insertActivityLog({
    sessionId: existingSession.sessionId,
    username: existingSession.username,
    userType: existingSession.userType,
    activityType: 'logout',
    details: params.reason ? { reason: params.reason } : undefined,
  });

  return existingSession;
}

export async function getActiveUserSession(sessionId: string) {
  const { sessions } = await getSessionCollections();
  return sessions.findOne({
    sessionId,
    status: 'online',
  });
}

export async function listOnlineUserSessions() {
  return listOnlineUserSessionsPage({ page: 1, pageSize: 500 });
}

export async function listOnlineUserSessionsPage(params: {
  page: number;
  pageSize: number;
}) {
  const { sessions } = await getSessionCollections();
  const page = Math.max(1, params.page);
  const pageSize = Math.max(1, Math.min(params.pageSize, 100));
  const skip = (page - 1) * pageSize;
  const query = { status: 'online' as const };

  const [onlineSessions, total] = await Promise.all([
    sessions.find(query).sort({ lastSeenAt: -1 }).skip(skip).limit(pageSize).toArray(),
    sessions.countDocuments(query),
  ]);

  return {
    onlineUsers: onlineSessions.map((session) => ({
      sessionId: session.sessionId,
      username: session.username,
      userType: session.userType,
      authMethod: session.authMethod,
      startedAt: session.startedAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listUserActivityLogs(limit = 100) {
  const result = await listUserActivityLogsPage({ page: 1, pageSize: limit });
  return result.logs;
}

export async function listUserActivityLogsPage(params: {
  page: number;
  pageSize: number;
}) {
  const { activity } = await getSessionCollections();
  const page = Math.max(1, params.page);
  const pageSize = Math.max(1, Math.min(params.pageSize, 100));
  const skip = (page - 1) * pageSize;

  const [logs, total] = await Promise.all([
    activity.find({}).sort({ createdAt: -1 }).skip(skip).limit(pageSize).toArray(),
    activity.countDocuments({}),
  ]);

  return {
    logs: logs.map((log) => ({
      id: String((log as UserActivityDocument & { _id: ObjectId })._id),
      sessionId: log.sessionId,
      username: log.username,
      userType: log.userType,
      activityType: log.activityType,
      details: log.details ?? null,
      createdAt: log.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function deleteUserActivityLog(id: string) {
  const { activity } = await getSessionCollections();
  if (!ObjectId.isValid(id)) {
    return null;
  }

  return activity.findOneAndDelete({ _id: new ObjectId(id) });
}

export async function clearUserActivityLogs() {
  const { activity } = await getSessionCollections();
  const result = await activity.deleteMany({});
  return result.deletedCount;
}
