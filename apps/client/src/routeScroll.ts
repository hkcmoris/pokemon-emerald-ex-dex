import { useLayoutEffect } from 'react';

const positions = new Map<string, number>();

/** The lifecycle is separate from React so navigation and resize ordering can be tested. */
export function trackRouteScroll(key: string): () => void {
    const target = positions.get(key) ?? 0;
    let lastPosition = target;
    let restoring = true;
    let navigating = false;
    let navigationFrame: number | undefined;
    const remember = () => {
        if (!restoring && !navigating) lastPosition = window.scrollY;
    };
    const stop = () => {
        if (navigating) return;
        restoring = false;
        lastPosition = window.scrollY;
        observer.disconnect();
    };
    const restore = () => {
        if (!restoring || navigating) return;
        // Explicitly bypass the document's smooth scrolling for history restoration.
        window.scrollTo({ left: 0, top: target, behavior: 'instant' });
        if (Math.abs(window.scrollY - target) < 2) stop();
    };
    const beforeNavigation = () => {
        remember();
        navigating = true;
        restoring = false;
        observer.disconnect();
        positions.set(key, lastPosition);
        // A shared route key (collection or simulator) keeps this tracker alive.
        // Resume after its new layout is committed; other keys clean up this frame.
        if (navigationFrame !== undefined) cancelAnimationFrame(navigationFrame);
        navigationFrame = requestAnimationFrame(() => {
            navigating = false;
            lastPosition = window.scrollY;
        });
    };
    const observer = new ResizeObserver(restore);
    observer.observe(document.body);
    const frame = requestAnimationFrame(restore);
    const timeout = window.setTimeout(stop, 10_000);
    // Capture runs before the hash listener that renders a potentially shorter page.
    window.addEventListener('hashchange', beforeNavigation, true);
    window.addEventListener('scroll', remember, { passive: true });
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchstart', stop, { passive: true });
    window.addEventListener('keydown', stop);
    window.addEventListener('pointerdown', stop, { passive: true });
    return () => {
        positions.set(key, lastPosition);
        observer.disconnect();
        cancelAnimationFrame(frame);
        if (navigationFrame !== undefined) cancelAnimationFrame(navigationFrame);
        window.clearTimeout(timeout);
        window.removeEventListener('hashchange', beforeNavigation, true);
        window.removeEventListener('scroll', remember);
        window.removeEventListener('wheel', stop);
        window.removeEventListener('touchstart', stop);
        window.removeEventListener('keydown', stop);
        window.removeEventListener('pointerdown', stop);
    };
}

/** Restore after asynchronous content grows, without fighting subsequent user input. */
export function useRouteScroll(key: string): void {
    useLayoutEffect(() => {
        const previous = window.history.scrollRestoration;
        window.history.scrollRestoration = 'manual';
        return () => {
            window.history.scrollRestoration = previous;
        };
    }, []);
    useLayoutEffect(() => trackRouteScroll(key), [key]);
}
