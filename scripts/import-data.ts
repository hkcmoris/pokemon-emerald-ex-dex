import { resolve } from 'node:path';
import { openDatabase, projectRoot } from '../apps/server/src/db/database.js';
import { importDatabase } from '../apps/server/src/db/import.js';
const database = openDatabase();
importDatabase(database, resolve(projectRoot, 'docs'));
console.log(
    'SQLite Pokédex ready:',
    database.prepare('SELECT COUNT(*) AS species FROM species').get(),
);
database.close();
