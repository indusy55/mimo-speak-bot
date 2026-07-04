import { eq, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { voiceSources } from "../db/schema.js";

export type VoiceSourceRecord = {
  createdAt: number;
  fileSize: number;
  hash: string;
  id: number;
  mimeType: string;
  name: string;
  normalizedName: string;
  updatedAt: number;
};

type InsertRecord = Omit<VoiceSourceRecord, "id">;

export type VoiceSourceRepository = {
  countByHash: (hash: string) => number;
  delete: (normalizedName: string) => boolean;
  findByName: (name: string) => VoiceSourceRecord | undefined;
  insert: (record: InsertRecord) => { id: number };
  list: () => VoiceSourceRecord[];
  update: (normalizedName: string, record: Partial<InsertRecord>) => boolean;
};

export function createVoiceSourceRepository({ db }: { db: Db }): VoiceSourceRepository {
  return {
    countByHash: (hash) => {
      const result = db
        .select({ count: sql<number>`count(*)` })
        .from(voiceSources)
        .where(eq(voiceSources.hash, hash))
        .get();
      return result?.count ?? 0;
    },

    delete: (normalizedName) => {
      const result = db
        .delete(voiceSources)
        .where(eq(voiceSources.normalizedName, normalizedName.toLowerCase()))
        .run();
      return result.changes > 0;
    },

    findByName: (name) => {
      const row = db
        .select()
        .from(voiceSources)
        .where(eq(voiceSources.normalizedName, name.toLowerCase()))
        .get();

      return row ? toRecord(row) : undefined;
    },

    insert: (record) => {
      const result = db
        .insert(voiceSources)
        .values({
          createdAt: record.createdAt,
          fileSize: record.fileSize,
          hash: record.hash,
          mimeType: record.mimeType,
          name: record.name,
          normalizedName: record.normalizedName,
          updatedAt: record.updatedAt,
        })
        .returning({ id: voiceSources.id })
        .get();

      if (!result) {
        throw new Error("Failed to insert voice source record.");
      }

      return result;
    },

    list: () =>
      db
        .select()
        .from(voiceSources)
        .all()
        .map(toRecord)
        .sort((left, right) =>
          left.name.localeCompare(right.name, undefined, {
            numeric: true,
            sensitivity: "base",
          }),
        ),

    update: (normalizedName, record) => {
      const result = db
        .update(voiceSources)
        .set(record)
        .where(eq(voiceSources.normalizedName, normalizedName.toLowerCase()))
        .run();
      return result.changes > 0;
    },
  };
}

function toRecord(row: typeof voiceSources.$inferSelect): VoiceSourceRecord {
  return {
    createdAt: row.createdAt,
    fileSize: row.fileSize,
    hash: row.hash,
    id: row.id,
    mimeType: row.mimeType,
    name: row.name,
    normalizedName: row.normalizedName,
    updatedAt: row.updatedAt,
  };
}
