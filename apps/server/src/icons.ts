import { fileURLToPath } from 'node:url';
import express, { type Router } from 'express';

export const categoryIconAssetRoot = fileURLToPath(
    new URL('../../../assets/move-categories/', import.meta.url),
);

export const typeIconAssetRoot = fileURLToPath(new URL('../../../assets/types/', import.meta.url));
export const itemIconAssetRoot = fileURLToPath(new URL('../../../assets/items/', import.meta.url));

function createPngIconRouter(assetRoot: string): Router {
    const router = express.Router();
    router.use((req, _res, next) => {
        let path: string;
        try {
            path = decodeURIComponent(req.path);
        } catch {
            next('router');
            return;
        }
        if (!/^\/[^/\\]+\.png$/.test(path)) {
            next('router');
            return;
        }
        next();
    });
    router.use(
        express.static(assetRoot, {
            dotfiles: 'deny',
            index: false,
            redirect: false,
            maxAge: '1d',
        }),
    );
    return router;
}

export function createCategoryIconRouter(): Router {
    return createPngIconRouter(categoryIconAssetRoot);
}

export function createTypeIconRouter(): Router {
    return createPngIconRouter(typeIconAssetRoot);
}

export function createItemIconRouter(): Router {
    return createPngIconRouter(itemIconAssetRoot);
}
