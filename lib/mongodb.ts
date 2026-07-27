import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI ?? 'mongodb://root:gampang@localhost:27017/';
const dbName = process.env.MONGODB_DB_NAME ?? 'meet';

if (!uri) {
  throw new Error('MONGODB_URI is not defined');
}

const options = {};

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;

export async function getMongoDb() {
  const client = await clientPromise;
  return client.db(dbName);
}
