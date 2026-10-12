import { randomUUID } from 'node:crypto';

import {
    emptyCollection,
    validateCollectionDocument,
    type CollectionDocument,
} from '@pokemon-emerald-ex-dex/shared';
import type { Pool } from 'mariadb';

import type { GoogleIdentity } from './googleIdentity.js';

export interface CollectionUser {
    id: string;
    name: string;
    email: string;
}
export interface CollectionSession {
    user: CollectionUser;
    csrfToken: string;
}
export interface CollectionSnapshot {
    revision: number;
    document: CollectionDocument;
}
export interface CollectionStore {
    signIn(
        identity: GoogleIdentity,
        tokenHash: string,
        csrfToken: string,
        expiresAt: Date,
    ): Promise<CollectionUser>;
    session(tokenHash: string): Promise<CollectionSession | null>;
    signOut(tokenHash: string): Promise<void>;
    read(userId: string): Promise<CollectionSnapshot>;
    write(userId: string, revision: number, document: CollectionDocument): Promise<boolean>;
}

export class CollectionRepository implements CollectionStore {
    constructor(private readonly pool: Pool) {}

    async signIn(
        identity: GoogleIdentity,
        tokenHash: string,
        csrfToken: string,
        expiresAt: Date,
    ): Promise<CollectionUser> {
        const connection = await this.pool.getConnection();
        try {
            await connection.beginTransaction();
            await connection.execute(
                `INSERT INTO emerald_ex_collection_users (user_id, google_subject, display_name, email)
                 VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), email = VALUES(email)`,
                [randomUUID(), identity.subject, identity.name, identity.email],
            );
            const users = await connection.execute<CollectionUser[]>(
                'SELECT user_id AS id, display_name AS name, email FROM emerald_ex_collection_users WHERE google_subject = ?',
                [identity.subject],
            );
            const user = users[0];
            await connection.execute(
                'INSERT INTO emerald_ex_collection_sessions (token_hash, user_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)',
                [
                    tokenHash,
                    user.id,
                    csrfToken,
                    expiresAt.toISOString().slice(0, 19).replace('T', ' '),
                ],
            );
            await connection.execute(
                'INSERT IGNORE INTO emerald_ex_collections (user_id, revision, document) VALUES (?, 0, ?)',
                [user.id, JSON.stringify(emptyCollection())],
            );
            await connection.execute(
                'DELETE FROM emerald_ex_collection_sessions WHERE expires_at <= UTC_TIMESTAMP()',
            );
            await connection.commit();
            return user;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            await connection.release();
        }
    }

    async session(tokenHash: string): Promise<CollectionSession | null> {
        const rows = await this.pool.execute<(CollectionUser & { csrfToken: string })[]>(
            `SELECT u.user_id AS id, u.display_name AS name, u.email, s.csrf_token AS csrfToken
             FROM emerald_ex_collection_sessions s JOIN emerald_ex_collection_users u ON u.user_id = s.user_id
             WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP()`,
            [tokenHash],
        );
        const row = rows[0];
        return row
            ? { user: { id: row.id, name: row.name, email: row.email }, csrfToken: row.csrfToken }
            : null;
    }

    async signOut(tokenHash: string): Promise<void> {
        await this.pool.execute('DELETE FROM emerald_ex_collection_sessions WHERE token_hash = ?', [
            tokenHash,
        ]);
    }

    async read(userId: string): Promise<CollectionSnapshot> {
        const rows = await this.pool.execute<
            { revision: number; document: string | CollectionDocument }[]
        >('SELECT revision, document FROM emerald_ex_collections WHERE user_id = ?', [userId]);
        const row = rows[0];
        if (!row) throw new Error('Collection is missing for authenticated user');
        const document: unknown =
            typeof row.document === 'string' ? JSON.parse(row.document) : row.document;
        if (!validateCollectionDocument(document)) throw new Error('Stored collection is invalid');
        return { revision: row.revision, document };
    }

    async write(userId: string, revision: number, document: CollectionDocument): Promise<boolean> {
        // One conditional UPDATE is the compare-and-swap: no read/write race across devices.
        const result = await this.pool.execute<{ affectedRows: number }>(
            'UPDATE emerald_ex_collections SET document = ?, revision = revision + 1 WHERE user_id = ? AND revision = ?',
            [JSON.stringify(document), userId, revision],
        );
        return result.affectedRows === 1;
    }
}
