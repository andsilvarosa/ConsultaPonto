import { pgTable, text, integer, timestamp, primaryKey, boolean } from "drizzle-orm/pg-core";

export const holidays = pgTable("holidays", {
  date: text("date").primaryKey(),
  name: text("name").notNull(),
  type: text("type").default("national"),
});

export const timeEntries = pgTable("time_entries", {
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
  is_manual: boolean("is_manual").default(false),
  is_extra: boolean("is_extra").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.matricula, table.date] }),
  };
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
