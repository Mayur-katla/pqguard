import { MongoClient } from "mongodb";
import { config } from "./config.js";

let client: MongoClient | null = null;

async function resetClient() {
  const staleClient = client;
  client = null;
  await staleClient?.close(true).catch(() => undefined);
}

export async function getDb() {
  if (!config.mongodbUri) return null;
  try {
    if (!client) {
      client = new MongoClient(config.mongodbUri, {
        connectTimeoutMS: 3000,
        serverSelectionTimeoutMS: 3000
      });
      await client.connect();
    }
    return client.db();
  } catch (error) {
    await resetClient();
    throw error;
  }
}

export async function saveScan(scan: object) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.collection("scans").insertOne({ ...scan, createdAt: new Date() });
  } catch (error) {
    await resetClient();
    throw error;
  }
}

export async function checkDb() {
  try {
    const db = await getDb();
    if (!db) return { connected: false, reason: "MONGODB_URI is not configured." };
    const collection = db.collection("healthchecks");
    const inserted = await collection.insertOne({ source: "prguard", createdAt: new Date() });
    const found = await collection.findOne({ _id: inserted.insertedId });
    return {
      connected: true,
      database: db.databaseName,
      collection: collection.collectionName,
      insertedId: String(inserted.insertedId),
      readBack: Boolean(found)
    };
  } catch (error) {
    await resetClient();
    const reason = error instanceof Error ? error.message : "MongoDB health check failed.";
    return { connected: false, reason };
  }
}
