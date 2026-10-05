import { check, index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const species = sqliteTable(
    'species',
    {
        speciesId: integer('species_id').primaryKey(),
        name: text('name').notNull(),
        searchName: text('search_name').notNull(),
        sameNameCount: integer('same_name_count').notNull(),
        moveCount: integer('move_count').notNull(),
        machineCount: integer('machine_count').notNull(),
    },
    (t) => [index('idx_species_search_name').on(t.searchName)],
);
export const moves = sqliteTable('moves', {
    moveId: integer('move_id').primaryKey(),
    name: text('name').notNull(),
});
export const learnsets = sqliteTable(
    'learnsets',
    {
        speciesId: integer('species_id')
            .notNull()
            .references(() => species.speciesId),
        position: integer('position').notNull(),
        level: integer('level').notNull(),
        moveId: integer('move_id')
            .notNull()
            .references(() => moves.moveId),
    },
    (t) => [primaryKey({ columns: [t.speciesId, t.position] })],
);
export const machines = sqliteTable(
    'machines',
    {
        machine: text('machine').primaryKey(),
        kind: text('kind').notNull(),
        number: integer('number').notNull(),
        moveId: integer('move_id')
            .notNull()
            .references(() => moves.moveId),
    },
    (t) => [check('machine_kind', sql`${t.kind} IN ('TM', 'HM')`)],
);
export const compatibility = sqliteTable(
    'compatibility',
    {
        speciesId: integer('species_id')
            .notNull()
            .references(() => species.speciesId),
        machine: text('machine')
            .notNull()
            .references(() => machines.machine),
    },
    (t) => [primaryKey({ columns: [t.speciesId, t.machine] })],
);
export const evolutions = sqliteTable(
    'evolutions',
    {
        edgeId: integer('edge_id').primaryKey(),
        fromSpeciesId: integer('from_species_id')
            .notNull()
            .references(() => species.speciesId),
        toSpeciesId: integer('to_species_id')
            .notNull()
            .references(() => species.speciesId),
        internalOnly: integer('internal_only').notNull(),
        data: text('data').notNull(),
    },
    (t) => [
        index('idx_evolutions_from').on(t.fromSpeciesId),
        index('idx_evolutions_to').on(t.toSpeciesId),
    ],
);
export const metadata = sqliteTable('metadata', {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
});
