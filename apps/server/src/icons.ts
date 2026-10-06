import { fileURLToPath } from 'node:url';
import express, { type Router } from 'express';

export const categoryIconAssetRoot = fileURLToPath(
    new URL('../../../assets/move-categories/', import.meta.url),
);

export function createCategoryIconRouter(): Router {
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
        express.static(categoryIconAssetRoot, {
            dotfiles: 'deny',
            index: false,
            redirect: false,
            maxAge: '1d',
        }),
    );
    return router;
}
