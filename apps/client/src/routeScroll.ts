import { useEffect } from 'react';

const positions = new Map<string, number>();

/** Restore after asynchronous content grows, without fighting subsequent user input. */
export function useRouteScroll(key: string): void {
    useEffect(() => {
        const target = positions.get(key) ?? 0;
        let lastPosition = target;
        let restoring = true;
        const remember = () => {
            if (!restoring) lastPosition = window.scrollY;
        };
        const stop = () => {
            restoring = false;
            lastPosition = window.scrollY;
            observer.disconnect();
        };
        const restore = () => {
            if (!restoring) return;
            window.scrollTo(0, target);
            if (Math.abs(window.scrollY - target) < 2) stop();
        };
        const observer = new ResizeObserver(restore);
        observer.observe(document.body);
        const frame = requestAnimationFrame(restore);
        const timeout = window.setTimeout(stop, 10_000);
        window.addEventListener('scroll', remember, { passive: true });
        window.addEventListener('wheel', stop, { passive: true });
        window.addEventListener('touchstart', stop, { passive: true });
        window.addEventListener('keydown', stop);
        window.addEventListener('pointerdown', stop, { passive: true });
        return () => {
            positions.set(key, lastPosition);
            stop();
            cancelAnimationFrame(frame);
            clearTimeout(timeout);
            window.removeEventListener('scroll', remember);
            window.removeEventListener('wheel', stop);
            window.removeEventListener('touchstart', stop);
            window.removeEventListener('keydown', stop);
            window.removeEventListener('pointerdown', stop);
        };
    }, [key]);
}
