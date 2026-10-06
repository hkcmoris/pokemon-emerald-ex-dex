import { fileURLToPath } from 'node:url';
import express, { type Router } from 'express';

export const spriteAssetRoot = fileURLToPath(
    new URL('../../../docs/pokemon_emerald_ex_1.0.4_battle_sprites/', import.meta.url),
);

export function createSpriteRouter(): Router {
    const router = express.Router();
    router.use((req, _res, next) => {
        if (
            !/^\/(front|shiny_front|front_frame2|shiny_front_frame2|back|shiny_back)\/[^/\\]+\.png$/.test(
                req.path,
            )
        ) {
            next('router');
            return;
        }
        next();
    });
    router.use(
        express.static(spriteAssetRoot, {
            dotfiles: 'deny',
            index: false,
            redirect: false,
            maxAge: '1d',
        }),
    );
    return router;
}
