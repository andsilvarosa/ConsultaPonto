import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

export const holidays = sqliteTable("holidays", {
  date: text("date").primaryKey(),
  name: text("name").notNull(),
  type: text("type").default("national"),
});

export const timeEntries = sqliteTable("time_entries", {
  matricula: text("matricula").notNull(),
  date: text("date").notNull(),
  entry_1: text("entry_1"),
  exit_1: text("exit_1"),
  entry_2: text("entry_2"),
  exit_2: text("exit_2"),
  entry_3: text("entry_3"),
  exit_3: text("exit_3"),
  entry_4: text("entry_4"),
  exit_4: text("exit_4"),
  entry_5: text("entry_5"),
  exit_5: text("exit_5"),
  is_manual: integer("is_manual", { mode: "boolean" }).default(false),
  is_extra: integer("is_extra", { mode: "boolean" }).default(false),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.matricula, table.date] }),
  };
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
