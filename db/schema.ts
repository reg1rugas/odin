import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const records = sqliteTable(
  "records",
  {
    id: text("id").notNull(),
    owner: text("owner").notNull(),
    kind: text("kind").notNull(),
    data: text("data").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("records_owner_kind").on(t.owner, t.kind),
    uniqueIndex("records_identity").on(t.owner, t.kind, t.id),
  ],
);
