import type { DexSort } from '@pokemon-emerald-ex-dex/shared';
import { Router } from 'express';

import type { DexRepository } from '../dexRepository.js';
import { HttpError } from '../httpError.js';

function stringQuery(value: unknown, name: string, maxLength: number, fallback = ''): string {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || value.length > maxLength) {
        throw new HttpError(
            400,
            'invalid_query',
            `${name} must be a string of at most ${maxLength} characters`,
        );
    }
    return value.trim();
}

function integer(value: unknown, name: string, min: number, max: number): number {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) {
        throw new HttpError(
            400,
            'invalid_parameter',
            `${name} must be an integer between ${min} and ${max}`,
        );
    }
    const result = Number(value);
    if (!Number.isSafeInteger(result) || result < min || result > max) {
        throw new HttpError(
            400,
            'invalid_parameter',
            `${name} must be an integer between ${min} and ${max}`,
        );
    }
    return result;
}

function pagination(query: Record<string, unknown>): { page: number; pageSize: number } {
    return {
        page: query.page === undefined ? 1 : integer(query.page, 'page', 1, 65535),
        pageSize: query.pageSize === undefined ? 40 : integer(query.pageSize, 'pageSize', 1, 250),
    };
}

function sortQuery(value: unknown): DexSort {
    switch (value) {
        case undefined:
        case 'id':
            return 'id';
        case 'name':
        case 'total':
        case 'speed':
            return value;
        default:
            throw new HttpError(400, 'invalid_query', 'sort must be id, name, total, or speed');
    }
}

function checkQueryKeys(query: Record<string, unknown>, allowed: readonly string[]): void {
    if (Object.keys(query).some((key) => !allowed.includes(key))) {
        throw new HttpError(400, 'invalid_query', 'Unknown query parameter');
    }
}

export function createDexRouter(repository: DexRepository): Router {
    const router = Router();

    router.get('/dataset', async (_req, res) => {
        const dataset = await repository.getDataset();
        if (!dataset)
            throw new HttpError(
                503,
                'dataset_unavailable',
                'The configured dex dataset is unavailable',
            );
        res.json({ data: dataset });
    });

    router.get('/types', async (_req, res) => {
        res.json({ data: await repository.getTypes() });
    });

    router.get('/species', async (req, res) => {
        checkQueryKeys(req.query, ['q', 'type', 'sort', 'page', 'pageSize']);
        res.json(
            await repository.listSpecies({
                q: stringQuery(req.query.q, 'q', 100),
                type: stringQuery(req.query.type, 'type', 32),
                sort: sortQuery(req.query.sort),
                ...pagination(req.query),
            }),
        );
    });

    router.get(['/species/:id', '/species/:id/:resource'], async (req, res) => {
        const id = integer(req.params.id, 'species ID', 1, 65535);
        const resource = req.params.resource;
        if (
            resource &&
            (typeof resource !== 'string' ||
                ![
                    'name',
                    'stats',
                    'types',
                    'learnset',
                    'evolution',
                    'machines',
                    'details',
                    'sprites',
                    'forms',
                ].includes(resource))
        ) {
            throw new HttpError(404, 'not_found', 'Endpoint not found');
        }
        if (resource === 'details') {
            const details = await repository.getSpeciesDetails(id);
            if (!details) throw new HttpError(404, 'not_found', 'Species not found');
            res.json({ data: details });
            return;
        }
        const species = await repository.getSpecies(id);
        if (!species) throw new HttpError(404, 'not_found', 'Species not found');
        if (resource === 'sprites') {
            res.json({ data: species.sprites });
            return;
        }

        switch (resource) {
            case 'name':
                res.json({ data: { name: species.name } });
                break;
            case 'stats':
                res.json({ data: { ...species.stats, baseStatTotal: species.baseStatTotal } });
                break;
            case 'types':
                res.json({ data: await repository.getSpeciesTypes(id) });
                break;
            case 'learnset':
                res.json({ data: await repository.getLearnset(id) });
                break;
            case 'evolution':
                res.json({ data: await repository.getEvolutions(id) });
                break;
            case 'forms':
                res.json({ data: await repository.getSpeciesForms(id) });
                break;
            case 'machines':
                res.json({ data: await repository.getMachines(id) });
                break;
            default:
                res.json({ data: species });
        }
    });

    router.get('/moves', async (req, res) => {
        checkQueryKeys(req.query, ['q', 'page', 'pageSize']);
        const { page, pageSize } = pagination(req.query);
        res.json(await repository.listMoves(stringQuery(req.query.q, 'q', 100), page, pageSize));
    });

    router.get('/item-pockets', async (_req, res) => {
        res.json({ data: await repository.getItemPockets() });
    });

    router.get('/items', async (req, res) => {
        checkQueryKeys(req.query, ['q', 'pocket', 'page', 'pageSize']);
        const { page, pageSize } = pagination(req.query);
        res.json(
            await repository.listItems(
                stringQuery(req.query.q, 'q', 100),
                stringQuery(req.query.pocket, 'pocket', 32),
                page,
                pageSize,
            ),
        );
    });

    router.get('/items/:id', async (req, res) => {
        const id = integer(req.params.id, 'item ID', 0, 65535);
        const item = await repository.getItem(id);
        if (!item) throw new HttpError(404, 'not_found', 'Item not found');
        res.json({ data: item });
    });

    router.get(['/moves/:id', '/moves/:id/:resource'], async (req, res) => {
        const id = integer(req.params.id, 'move ID', 0, 65535);
        const resource = req.params.resource;
        if (
            resource &&
            (typeof resource !== 'string' ||
                !['name', 'category', 'pp', 'damage', 'power', 'type'].includes(resource))
        ) {
            throw new HttpError(404, 'not_found', 'Endpoint not found');
        }
        const move = await repository.getMove(id);
        if (!move) throw new HttpError(404, 'not_found', 'Move not found');

        switch (resource) {
            case 'name':
                res.json({ data: { name: move.name } });
                break;
            case 'category':
                res.json({
                    data: {
                        categoryId: move.categoryId,
                        name: move.category,
                        iconFile: move.categoryIconFile,
                    },
                });
                break;
            case 'pp':
                res.json({ data: { pp: move.pp } });
                break;
            case 'damage':
            case 'power':
                res.json({ data: { power: move.power, effectId: move.effectId } });
                break;
            case 'type':
                res.json({
                    data: { typeId: move.typeId, name: move.type, iconFile: move.typeIconFile },
                });
                break;
            default:
                res.json({ data: move });
        }
    });

    return router;
}
