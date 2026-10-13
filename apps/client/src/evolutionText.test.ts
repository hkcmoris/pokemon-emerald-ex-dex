import { notStrictEqual, strictEqual } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { evolutionConditionLabel, evolutionSummary } from './evolutionText.js';

const summaryCases: readonly (readonly [string, string])[] = [
    ['Reach level 16.', 'Dosáhnout úrovně 16.'],
    ['Use Thunder Stone.', 'Použít Thunder Stone.'],
    ["Use King's Rock.", "Použít King's Rock."],
    ['Use Up-Grade.', 'Použít Up-Grade.'],
    ['Use Scroll of Waters.', 'Použít Scroll of Waters.'],
    ['Level up with high friendship.', 'Zvýšit úroveň při vysokém přátelství.'],
    [
        'Level up with high friendship during the day.',
        'Zvýšit úroveň při vysokém přátelství ve dne.',
    ],
    ['Level up with high friendship at night.', 'Zvýšit úroveň při vysokém přátelství v noci.'],
    [
        'Use Rage Fist at least 20 times, then level up.',
        'Použít útok Rage Fist alespoň 20krát, poté zvýšit úroveň.',
    ],
    [
        'Use PsyshieldBsh at least 20 times, then level up.',
        'Použít útok PsyshieldBsh alespoň 20krát, poté zvýšit úroveň.',
    ],
    ["Trade while holding King's Rock.", "Vyměnit Pokémona, který drží King's Rock."],
    ['Trade the Pokémon.', 'Vyměnit Pokémona.'],
    ['Level up in New Mauville.', 'Zvýšit úroveň v New Mauville.'],
    ['Level up while knowing AncientPower.', 'Zvýšit úroveň se znalostí útoku AncientPower.'],
    [
        'Level up in Moss Rock evolution area (Leafeon).',
        'Zvýšit úroveň v oblasti vývoje Moss Rock (Leafeon).',
    ],
    [
        'Level up in Ice Rock / icy evolution area (Glaceon, Crabominable).',
        'Zvýšit úroveň v oblasti vývoje Ice Rock / ledové oblasti (Glaceon, Crabominable).',
    ],
    [
        'Level up with high friendship while knowing a Fairy move.',
        'Zvýšit úroveň při vysokém přátelství se znalostí útoku typu Vílí.',
    ],
    [
        'Level up while knowing Hyper Drill (99% personality branch; two-segment result).',
        'Zvýšit úroveň se znalostí útoku Hyper Drill (99% větev podle osobnosti; dvousegmentový výsledek).',
    ],
    [
        'Level up while knowing Hyper Drill (1% personality branch; three-segment result).',
        'Zvýšit úroveň se znalostí útoku Hyper Drill (1% větev podle osobnosti; třísegmentový výsledek).',
    ],
    ['Level up while holding Razor Fang at night.', 'Zvýšit úroveň při držení Razor Fang v noci.'],
    [
        'Level up while holding Oval Stone during the day.',
        'Zvýšit úroveň při držení Oval Stone ve dne.',
    ],
    ['Use Razor Fang during the night.', 'Použít Razor Fang v noci.'],
    ['Use Razor Claw during the day.', 'Použít Razor Claw ve dne.'],
    [
        'Reach level 20 with Attack < Defense.',
        'Dosáhnout úrovně 20 při splnění podmínky Útok < Obrana.',
    ],
    [
        'Reach level 20 with Attack > Defense.',
        'Dosáhnout úrovně 20 při splnění podmínky Útok > Obrana.',
    ],
    [
        'Reach level 20 with Attack = Defense.',
        'Dosáhnout úrovně 20 při splnění podmínky Útok = Obrana.',
    ],
    [
        "Reach level 7; result depends on the Pokémon's internal personality branch.",
        'Dosáhnout úrovně 7; výsledek závisí na větvi dané interní osobností Pokémona.',
    ],
    ['Use Dawn Stone on a male Pokémon.', 'Použít Dawn Stone na samce Pokémona.'],
    ['Use Dawn Stone on a female Pokémon.', 'Použít Dawn Stone na samici Pokémona.'],
    [
        'Reach level 20 (Ninjask special evolution branch).',
        'Dosáhnout úrovně 20 (zvláštní větev vývoje na Ninjask).',
    ],
    [
        'At level 20, Shedinja is created alongside Ninjask via the special Nincada evolution logic (requires an available party slot; Poké Ball handling is controlled by the engine configuration).',
        'Na úrovni 20 vznikne Shedinja spolu s Ninjask podle zvláštních pravidel vývoje Nincada (vyžaduje volné místo v týmu; pravidla pro předmět Poké Ball určuje konfigurace hry).',
    ],
    ['Level up with Beauty at least 170.', 'Zvýšit úroveň při kráse alespoň 170.'],
    ['Reach level 20 while female.', 'Dosáhnout úrovně 20 jako samice.'],
    ['Reach level 20 while male.', 'Dosáhnout úrovně 20 jako samec.'],
    ['Level up with Remoraid in the party.', 'Zvýšit úroveň s Remoraid v týmu.'],
    ['Trade specifically for Shelmet.', 'Vyměnit Pokémona konkrétně za Shelmet.'],
    [
        'Reach level 32 with a Dark-type Pokémon in the party.',
        'Dosáhnout úrovně 32 s Pokémonem typu Temný v týmu.',
    ],
    ['Reach level 39 during day.', 'Dosáhnout úrovně 39 ve dne.'],
    ['Reach level 39 during night.', 'Dosáhnout úrovně 39 v noci.'],
    ['Reach level 25 during dusk.', 'Dosáhnout úrovně 25 za soumraku.'],
    ['Reach level 50 while it is raining.', 'Dosáhnout úrovně 50 za deště.'],
    ['Reach level 50 while it is foggy.', 'Dosáhnout úrovně 50 za mlhy.'],
    ['Reach level 30 with an Amped nature.', 'Dosáhnout úrovně 30 s povahou ze skupiny Amped.'],
    ['Reach level 30 with an Low Key nature.', 'Dosáhnout úrovně 30 s povahou ze skupiny Low Key.'],
    [
        'Interact with the Scroll of Darkness evolution trigger.',
        'Aktivovat spouštěč vývoje Scroll of Darkness.',
    ],
    [
        'Interact with the Scroll of Waters evolution trigger.',
        'Aktivovat spouštěč vývoje Scroll of Waters.',
    ],
    [
        'Land at least 3 critical hits in one battle.',
        'Zasadit alespoň 3 kritické zásahy v jednom souboji.',
    ],
    [
        "Have at least 49 HP missing, then activate the ROM's special overworld evolution trigger.",
        'Mít ztraceno alespoň 49 HP, poté aktivovat zvláštní spouštěč vývoje mimo souboj v této ROM.',
    ],
    [
        'Reach level 25 in battle (99% personality branch; Family of Four).',
        'Dosáhnout úrovně 25 v souboji (99% větev podle osobnosti; Family of Four).',
    ],
    [
        'Reach level 25 in battle (1% personality branch; Family of Three).',
        'Dosáhnout úrovně 25 v souboji (1% větev podle osobnosti; Family of Three).',
    ],
    [
        'Internal alternate-form routing marker; not a normal player-triggered evolution method.',
        'Interní značka pro směrování alternativních forem; nejde o běžný způsob vývoje vyvolaný hráčem.',
    ],
];

void test('Czech evolution summaries preserve every condition and game name', () => {
    for (const [english, czech] of summaryCases)
        strictEqual(evolutionSummary(english, 'cs'), czech, english);
});

void test('English evolution summaries remain byte-for-byte unchanged', () => {
    for (const [english] of summaryCases) strictEqual(evolutionSummary(english, 'en'), english);
});

void test('all current ROM evolution rules have a Czech summary', () => {
    const dataset = JSON.parse(
        readFileSync(
            new URL('../../../docs/pokemon_emerald_ex_1.0.4_evolutions.json', import.meta.url),
            'utf8',
        ),
    ) as { edges: { method: string; summary: string }[] };
    strictEqual(dataset.edges.length, 644);
    for (const edge of dataset.edges)
        notStrictEqual(
            evolutionSummary(edge.summary, 'cs'),
            edge.summary,
            `${edge.method}: ${edge.summary}`,
        );
});

void test('unknown summary templates are not partially translated', () => {
    for (const unknown of [
        'Reach level 16 while holding a new item.',
        'Use Thunder Stone underwater.',
        'Use Thunder Stone. Then win a battle.',
        'Level up while knowing New Move after a critical hit.',
        'An undiscovered evolution rule.',
        '',
    ]) {
        strictEqual(evolutionSummary(unknown, 'cs'), unknown);
    }
});

const conditionCases: readonly (readonly [string, string])[] = [
    ['Recorded level meets level 16', 'Zaznamenaná úroveň dosahuje úrovně 16'],
    ['Recorded moves include AncientPower', 'Zaznamenané útoky obsahují AncientPower'],
    ['Recorded moves include move #246', 'Zaznamenané útoky obsahují útok č. 246'],
    ['Recorded moves include a Fairy-type move', 'Zaznamenané útoky obsahují útok typu Vílí'],
    ['Recorded party includes Remoraid', 'Zaznamenaný tým obsahuje Remoraid'],
    ['Recorded party includes species #223', 'Zaznamenaný tým obsahuje druh č. 223'],
    ['Recorded party includes a Dark-type Pokémon', 'Zaznamenaný tým obsahuje Pokémona typu Temný'],
    [
        'Measured stats at the recorded level satisfy Attack < Defense',
        'Naměřené statistiky při zaznamenané úrovni splňují podmínku Útok < Obrana',
    ],
    [
        'Measured stats at the recorded level satisfy Attack > Defense',
        'Naměřené statistiky při zaznamenané úrovni splňují podmínku Útok > Obrana',
    ],
    [
        'Measured stats at the recorded level satisfy Attack = Defense',
        'Naměřené statistiky při zaznamenané úrovni splňují podmínku Útok = Obrana',
    ],
    ['item: check in game', 'Předmět: ověřit ve hře'],
    ['held Item: check in game', 'Držený předmět: ověřit ve hře'],
    ['move Used At Least: check in game', 'Počet použití útoku: ověřit ve hře'],
    ['trade Partner Species: check in game', 'Druh získaný výměnou: ověřit ve hře'],
    ['natures: check in game', 'Povahy: ověřit ve hře'],
    ['special Trigger: check in game', 'Zvláštní spouštěč: ověřit ve hře'],
    ['friendship: high', 'Přátelství: vysoké'],
    ['time: day', 'Denní doba: den'],
    ['time: night', 'Denní doba: noc'],
    ['time: dusk', 'Denní doba: soumrak'],
    ['gender: male', 'Pohlaví: samec'],
    ['gender: female', 'Pohlaví: samice'],
    ['weather: rain', 'Počasí: déšť'],
    ['weather: fog', 'Počasí: mlha'],
    ['nature Group: amped', 'Skupina povah: Amped'],
    ['nature Group: low_key', 'Skupina povah: Low Key'],
    ['minimum Beauty: 170', 'Minimální krása: 170'],
    ['critical Hits In One Battle: 3', 'Kritické zásahy v jednom souboji: 3'],
    ['missing Hp At Least: 49', 'Chybějící HP alespoň: 49'],
    ['map Section Id: 63', 'ID oblasti: 63'],
    ['map Section: New Mauville', 'Oblast: New Mauville'],
    ['map Id: 6923', 'ID mapy: 6923'],
    [
        'map Hint: Moss Rock evolution area (Leafeon)',
        'Upřesnění oblasti: oblast vývoje Moss Rock (Leafeon)',
    ],
    [
        'map Hint: Ice Rock / icy evolution area (Glaceon, Crabominable)',
        'Upřesnění oblasti: oblast vývoje Ice Rock / ledová oblast (Glaceon, Crabominable)',
    ],
    ['personality Chance: 99% branch', 'Pravděpodobnost podle osobnosti: 99 %'],
    ['personality Chance: 1% branch', 'Pravděpodobnost podle osobnosti: 1 %'],
    ['personality Branch: A', 'Větev podle osobnosti: A'],
    ['personality Branch: B', 'Větev podle osobnosti: B'],
    ['special: Shedinja companion evolution', 'Zvláštní podmínka: souběžný vývoj Shedinja'],
    ['scroll: Scroll of Darkness', 'Svitek: Scroll of Darkness'],
    ['Use Thunder Stone.', 'Použít Thunder Stone.'],
];

void test('Czech condition evidence translates requirements without changing their values', () => {
    for (const [english, czech] of conditionCases)
        strictEqual(evolutionConditionLabel(english, 'cs'), czech, english);
});

void test('English and unknown condition evidence remain unchanged', () => {
    for (const [english] of conditionCases)
        strictEqual(evolutionConditionLabel(english, 'en'), english);
    for (const unknown of [
        'new Condition: high',
        'Recorded moves include a future condition',
        'Measured stats at the recorded level satisfy HP > Speed',
    ])
        strictEqual(evolutionConditionLabel(unknown, 'cs'), unknown);
});
