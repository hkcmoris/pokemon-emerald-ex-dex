const databaseName = 'emerald-ex-my-pokemon';
const storeName = 'records';
let connection: Promise<IDBDatabase> | undefined;

function database(): Promise<IDBDatabase> {
    connection ??= new Promise<IDBDatabase>((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(
                new Error('Browser storage is unavailable. Enable site storage to save Pokémon.'),
            );
            return;
        }
        const request = indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(storeName);
        request.onerror = () =>
            reject(request.error ?? new Error('Could not open browser storage.'));
        request.onblocked = () =>
            reject(new Error('Close other app tabs to update browser storage.'));
        request.onsuccess = () => {
            request.result.onversionchange = () => {
                request.result.close();
                connection = undefined;
            };
            resolve(request.result);
        };
    }).catch((error: unknown) => {
        connection = undefined;
        throw error;
    });
    return connection;
}

export async function readCollectionRecord<T>(key: string): Promise<T | undefined> {
    const db = await database();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const request = transaction.objectStore(storeName).get(key);
        transaction.oncomplete = () => resolve(request.result as T | undefined);
        transaction.onabort = () =>
            reject(transaction.error ?? new Error('Could not read saved data.'));
        transaction.onerror = () =>
            reject(transaction.error ?? new Error('Could not read saved data.'));
    });
}

/** Read and change the same record in one transaction, including across browser tabs. */
export async function changeCollectionRecord<T>(
    key: string,
    update: (previous: T | undefined) => T,
): Promise<T> {
    const db = await database();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        let result: T;
        request.onsuccess = () => {
            try {
                result = update(request.result as T | undefined);
                store.put(result, key);
            } catch (error) {
                transaction.abort();
                reject(error instanceof Error ? error : new Error('Changes could not be saved.'));
            }
        };
        transaction.oncomplete = () => resolve(result);
        transaction.onabort = () =>
            reject(transaction.error ?? new Error('Changes could not be saved.'));
        transaction.onerror = () =>
            reject(transaction.error ?? new Error('Changes could not be saved.'));
    });
}

export async function writeCollectionRecord<T>(key: string, value: T): Promise<void> {
    await changeCollectionRecord<T>(key, () => value);
}
