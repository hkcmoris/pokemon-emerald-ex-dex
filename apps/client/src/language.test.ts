import { doesNotThrow, match, strictEqual } from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { LanguageProvider, readLanguage, saveLanguage, useLanguage } from './language.js';
import { DexHeader } from './DexHeader.js';
import { DexNavigation } from './DexNavigation.js';

function mockBrowserGlobal(
    context: TestContext,
    name: 'localStorage' | 'navigator',
    descriptor: PropertyDescriptor,
): void {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    context.after(() => {
        if (original) Object.defineProperty(globalThis, name, original);
        else Reflect.deleteProperty(globalThis, name);
    });
    Object.defineProperty(globalThis, name, { configurable: true, ...descriptor });
}

void test('saved language takes priority over the device and persists Czech and English', (context) => {
    const values = new Map<string, string>();
    const device = { languages: ['cs-CZ', 'en-US'], language: 'cs-CZ' };
    mockBrowserGlobal(context, 'localStorage', {
        value: {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => values.set(key, value),
        },
    });
    mockBrowserGlobal(context, 'navigator', {
        value: device,
    });
    strictEqual(readLanguage(), 'cs');
    strictEqual(values.size, 0);
    saveLanguage('en');
    strictEqual(readLanguage(), 'en');
    strictEqual(values.get('emerald-ex-language'), 'en');
    device.languages = ['en-US'];
    device.language = 'en-US';
    saveLanguage('cs');
    strictEqual(readLanguage(), 'cs');
    strictEqual(values.get('emerald-ex-language'), 'cs');
});

for (const { name, device, expected } of [
    {
        name: 'selects Czech after an unsupported device preference',
        device: { languages: ['de-DE', 'cs-CZ', 'en-US'], language: 'en-US' },
        expected: 'cs',
    },
    {
        name: 'selects English when it is preferred over Czech, ignoring case',
        device: { languages: ['EN-us', 'cs-CZ'], language: 'cs-CZ' },
        expected: 'en',
    },
    {
        name: 'recognizes uppercase Czech language tags',
        device: { languages: ['CS-cz', 'en-US'], language: 'en-US' },
        expected: 'cs',
    },
    {
        name: 'uses the primary device language when the preference list is empty',
        device: { languages: [], language: 'en-GB' },
        expected: 'en',
    },
    {
        name: 'uses the primary device language when the preference list is missing',
        device: { language: 'en' },
        expected: 'en',
    },
    {
        name: 'uses the primary device language when the preference list is unsupported',
        device: { languages: ['de-DE', 'fr-FR'], language: 'en-US' },
        expected: 'en',
    },
    {
        name: 'defaults to Czech when no device language is supported',
        device: { languages: ['de-DE'], language: 'fr-FR' },
        expected: 'cs',
    },
    {
        name: 'defaults to Czech when the device provides no language',
        device: {},
        expected: 'cs',
    },
    {
        name: 'defaults to Czech when navigator is unavailable',
        device: undefined,
        expected: 'cs',
    },
]) {
    void test(name, (context) => {
        mockBrowserGlobal(context, 'localStorage', { value: undefined });
        mockBrowserGlobal(context, 'navigator', { value: device });
        strictEqual(readLanguage(), expected);
    });
}

void test('invalid saved language falls back to the device preference', (context) => {
    mockBrowserGlobal(context, 'localStorage', {
        value: { getItem: () => 'invalid' },
    });
    mockBrowserGlobal(context, 'navigator', {
        value: { languages: ['cs-CZ'], language: 'cs-CZ' },
    });
    strictEqual(readLanguage(), 'cs');
});

void test('unavailable browser storage does not prevent device language detection', (context) => {
    mockBrowserGlobal(context, 'localStorage', {
        get: () => {
            throw new Error('Storage blocked');
        },
    });
    mockBrowserGlobal(context, 'navigator', {
        value: { languages: ['en-US'], language: 'en-US' },
    });
    strictEqual(readLanguage(), 'en');
    doesNotThrow(() => saveLanguage('cs'));
    const markup = renderToStaticMarkup(
        createElement(LanguageProvider, { initialLanguage: 'cs' }, createElement(LanguageSample)),
    );
    match(markup, /Načítání/);
});

function LanguageSample() {
    const { t, locale } = useLanguage();
    return createElement('span', { lang: locale }, t('Loading', 'Načítání'));
}

void test('language provider translates controls and exposes both language choices', () => {
    const markup = renderToStaticMarkup(
        createElement(
            LanguageProvider,
            { initialLanguage: 'cs' },
            createElement(DexHeader, { version: '1.0.4' }),
            createElement(DexNavigation, { active: 'items' }),
            createElement(LanguageSample),
        ),
    );
    match(markup, /Jazyk rozhraní/);
    match(markup, /<option value="en" lang="en">English<\/option>/);
    match(markup, /<option value="cs" lang="cs" selected="">Čeština<\/option>/);
    match(markup, /Předměty/);
    match(markup, /Schopnosti/);
    match(markup, /lang="cs-CZ">Načítání/);
    match(markup, /Emerald/);
    match(markup, /Pokémon/);

    match(renderToStaticMarkup(createElement(LanguageSample)), /lang="en-US">Loading/);
});
