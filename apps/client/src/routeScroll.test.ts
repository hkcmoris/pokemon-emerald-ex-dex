import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { test, type TestContext } from 'node:test';

import { trackRouteScroll } from './routeScroll.js';

function browser(t: TestContext) {
    const frames = new Map<number, () => void>();
    const timers = new Map<number, () => void>();
    const resizes = new Set<() => void>();
    const calls: ScrollToOptions[] = [];
    let nextId = 0;
    let maximumScroll = 10_000;
    const view = Object.assign(new EventTarget(), {
        scrollY: 0,
        scrollTo(options: ScrollToOptions) {
            calls.push(options);
            view.scrollY = Math.min(options.top ?? 0, maximumScroll);
        },
        setTimeout(callback: () => void) {
            timers.set(++nextId, callback);
            return nextId;
        },
        clearTimeout(id: number) {
            timers.delete(id);
        },
    });
    class Observer {
        constructor(private callback: () => void) {}
        observe() {
            resizes.add(this.callback);
        }
        disconnect() {
            resizes.delete(this.callback);
        }
    }
    for (const [name, value] of Object.entries({
        window: view,
        document: { body: {} },
        ResizeObserver: Observer,
        requestAnimationFrame(callback: () => void) {
            frames.set(++nextId, callback);
            return nextId;
        },
        cancelAnimationFrame(id: number) {
            frames.delete(id);
        },
    })) {
        const previous = Object.getOwnPropertyDescriptor(globalThis, name);
        Object.defineProperty(globalThis, name, { configurable: true, value });
        t.after(() => {
            if (previous) Object.defineProperty(globalThis, name, previous);
            else Reflect.deleteProperty(globalThis, name);
        });
    }
    return {
        view,
        calls,
        frames,
        timers,
        resizes,
        frame() {
            const scheduled = [...frames.values()];
            frames.clear();
            scheduled.forEach((callback) => callback());
        },
        resize(maximum: number) {
            maximumScroll = maximum;
            [...resizes].forEach((callback) => callback());
        },
        scroll(top: number) {
            view.scrollY = top;
            view.dispatchEvent(new Event('scroll'));
        },
    };
}

void test('navigation captures list position before the detail layout clamps window scroll', (t) => {
    const page = browser(t);
    const leaveList = trackRouteScroll('list-before-collapse');
    page.frame();
    page.scroll(640);
    page.view.dispatchEvent(new Event('hashchange'));
    page.scroll(0);
    leaveList();

    const leaveRestoredList = trackRouteScroll('list-before-collapse');
    page.frame();
    strictEqual(page.view.scrollY, 640);
    deepStrictEqual(page.calls.at(-1), { left: 0, top: 640, behavior: 'instant' });
    leaveRestoredList();
    strictEqual(page.frames.size, 0);
    strictEqual(page.resizes.size, 0);
    strictEqual(page.timers.size, 0);
});

void test('restoration waits for asynchronous content to grow to the saved position', (t) => {
    const page = browser(t);
    const leaveList = trackRouteScroll('growing-content');
    page.frame();
    page.scroll(900);
    leaveList();
    page.resize(200);

    const leaveRestoredList = trackRouteScroll('growing-content');
    page.frame();
    strictEqual(page.view.scrollY, 200);
    page.resize(500);
    strictEqual(page.view.scrollY, 500);
    page.resize(1_000);
    strictEqual(page.view.scrollY, 900);
    strictEqual(page.resizes.size, 0);
    leaveRestoredList();
});

void test('user input cancels pending restoration instead of scrolling back after more data loads', (t) => {
    const page = browser(t);
    const leaveList = trackRouteScroll('interrupted-content');
    page.frame();
    page.scroll(900);
    leaveList();
    page.resize(200);

    const leaveRestoredList = trackRouteScroll('interrupted-content');
    page.frame();
    page.view.dispatchEvent(new Event('wheel'));
    page.scroll(80);
    page.resize(1_000);
    strictEqual(page.view.scrollY, 80);
    leaveRestoredList();

    const leaveLatestPosition = trackRouteScroll('interrupted-content');
    page.frame();
    strictEqual(page.view.scrollY, 80);
    leaveLatestPosition();
});

void test('a shared collection or simulator route key resumes tracking after hash navigation', (t) => {
    const page = browser(t);
    const leaveWorkspace = trackRouteScroll('shared-workspace');
    page.frame();
    page.scroll(320);
    page.view.dispatchEvent(new Event('hashchange'));
    page.frame();
    page.scroll(500);
    leaveWorkspace();

    const leaveRestoredWorkspace = trackRouteScroll('shared-workspace');
    page.frame();
    strictEqual(page.view.scrollY, 500);
    leaveRestoredWorkspace();
});
