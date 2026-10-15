import {
    isTypeEffectivenessChart,
    type TypeEffectivenessChart,
} from '@pokemon-emerald-ex-dex/shared';

import { fetchTypeEffectiveness } from './api.js';
import { readCollectionRecord, writeCollectionRecord } from './collectionDatabase.js';

const memory = new Map<string, TypeEffectivenessChart>();
const pending = new Map<string, Promise<TypeEffectivenessChart>>();

export async function loadCollectionTypeEffectiveness(
    datasetId: string,
): Promise<TypeEffectivenessChart> {
    const existing = memory.get(datasetId);
    if (existing) return existing;
    let request = pending.get(datasetId);
    if (!request) {
        request = (async () => {
            const key = `type-effectiveness:${datasetId}`;
            // Storage can be disabled; online reference data should still remain usable.
            const cached = await readCollectionRecord<unknown>(key).catch(() => undefined);
            if (isTypeEffectivenessChart(cached)) {
                memory.set(datasetId, cached);
                return cached;
            }
            const chart = await fetchTypeEffectiveness();
            if (!isTypeEffectivenessChart(chart))
                throw new Error('Type effectiveness data is unavailable.');
            await writeCollectionRecord(key, chart).catch(() => undefined);
            memory.set(datasetId, chart);
            return chart;
        })().finally(() => pending.delete(datasetId));
        pending.set(datasetId, request);
    }
    return request;
}
