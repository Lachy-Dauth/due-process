import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const caseFiles = sqliteTable(
  "case_files",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    data: text("data").notNull(),
    version: integer("version").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("idx_case_files_owner_created").on(table.ownerId, table.createdAt),
  ],
);
export const aiBudget = sqliteTable("ai_budget", {
  id: text("id").primaryKey(),
  reservedCents: integer("reserved_cents").notNull().default(0),
  actualMicros: integer("actual_micros").notNull().default(0),
});
export const aiRequests = sqliteTable(
  "ai_requests",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    createdAt: integer("created_at").notNull(),
    accounted: integer("accounted").notNull().default(0),
    status: text("status").notNull().default("reserved"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
  },
  (table) => [
    index("idx_ai_requests_owner_created").on(table.ownerId, table.createdAt),
  ],
);
