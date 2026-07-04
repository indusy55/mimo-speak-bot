import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const voiceSources = sqliteTable("voice_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  normalizedName: text("normalized_name").notNull().unique(),
  hash: text("hash").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export type VoiceSource = typeof voiceSources.$inferSelect;
export type NewVoiceSource = typeof voiceSources.$inferInsert;
