import type { Language } from './language.js';
import { typeDisplayName } from './typeNames.js';

const czechSummaries: Readonly<Record<string, string>> = {
    'Internal alternate-form routing marker; not a normal player-triggered evolution method.':
        'Interní značka pro směrování alternativních forem; nejde o běžný způsob vývoje vyvolaný hráčem.',
    'Level up with high friendship.': 'Zvýšit úroveň při vysokém přátelství.',
    'Level up with high friendship during the day.': 'Zvýšit úroveň při vysokém přátelství ve dne.',
    'Level up with high friendship at night.': 'Zvýšit úroveň při vysokém přátelství v noci.',
    'Trade the Pokémon.': 'Vyměnit Pokémona.',
    'Level up in Moss Rock evolution area (Leafeon).':
        'Zvýšit úroveň v oblasti vývoje Moss Rock (Leafeon).',
    'Level up in Ice Rock / icy evolution area (Glaceon, Crabominable).':
        'Zvýšit úroveň v oblasti vývoje Ice Rock / ledové oblasti (Glaceon, Crabominable).',
    'Interact with the Scroll of Darkness evolution trigger.':
        'Aktivovat spouštěč vývoje Scroll of Darkness.',
    'Interact with the Scroll of Waters evolution trigger.':
        'Aktivovat spouštěč vývoje Scroll of Waters.',
};

// Names stay in the game's language. Lowercase condition words cannot become part of a name.
const name = "([A-Z][A-Za-z0-9'.-]*(?: (?:[A-Z][A-Za-z0-9'.-]*|of|the))*)";
const czechSummaryTemplates: readonly (readonly [RegExp, string])[] = [
    [/^Reach level (\d+)\.$/, 'Dosáhnout úrovně $1.'],
    [new RegExp(`^Use ${name}\\.$`), 'Použít $1.'],
    [new RegExp(`^Use ${name} during the day\\.$`), 'Použít $1 ve dne.'],
    [new RegExp(`^Use ${name} during the night\\.$`), 'Použít $1 v noci.'],
    [new RegExp(`^Use ${name} on a male Pokémon\\.$`), 'Použít $1 na samce Pokémona.'],
    [new RegExp(`^Use ${name} on a female Pokémon\\.$`), 'Použít $1 na samici Pokémona.'],
    [
        new RegExp(`^Use ${name} at least (\\d+) times, then level up\\.$`),
        'Použít útok $1 alespoň $2krát, poté zvýšit úroveň.',
    ],
    [new RegExp(`^Trade while holding ${name}\\.$`), 'Vyměnit Pokémona, který drží $1.'],
    [new RegExp(`^Trade specifically for ${name}\\.$`), 'Vyměnit Pokémona konkrétně za $1.'],
    [new RegExp(`^Level up in ${name}\\.$`), 'Zvýšit úroveň v $1.'],
    [new RegExp(`^Level up while knowing ${name}\\.$`), 'Zvýšit úroveň se znalostí útoku $1.'],
    [
        new RegExp(
            `^Level up while knowing ${name} \\((\\d+)% personality branch; two-segment result\\)\\.$`,
        ),
        'Zvýšit úroveň se znalostí útoku $1 ($2% větev podle osobnosti; dvousegmentový výsledek).',
    ],
    [
        new RegExp(
            `^Level up while knowing ${name} \\((\\d+)% personality branch; three-segment result\\)\\.$`,
        ),
        'Zvýšit úroveň se znalostí útoku $1 ($2% větev podle osobnosti; třísegmentový výsledek).',
    ],
    [
        new RegExp(`^Level up while holding ${name} during the day\\.$`),
        'Zvýšit úroveň při držení $1 ve dne.',
    ],
    [
        new RegExp(`^Level up while holding ${name} at night\\.$`),
        'Zvýšit úroveň při držení $1 v noci.',
    ],
    [
        /^Reach level (\d+) with Attack ([<>=]) Defense\.$/,
        'Dosáhnout úrovně $1 při splnění podmínky Útok $2 Obrana.',
    ],
    [
        /^Reach level (\d+); result depends on the Pokémon's internal personality branch\.$/,
        'Dosáhnout úrovně $1; výsledek závisí na větvi dané interní osobností Pokémona.',
    ],
    [
        /^Reach level (\d+) \(Ninjask special evolution branch\)\.$/,
        'Dosáhnout úrovně $1 (zvláštní větev vývoje na Ninjask).',
    ],
    [
        /^At level (\d+), Shedinja is created alongside Ninjask via the special Nincada evolution logic \(requires an available party slot; Poké Ball handling is controlled by the engine configuration\)\.$/,
        'Na úrovni $1 vznikne Shedinja spolu s Ninjask podle zvláštních pravidel vývoje Nincada (vyžaduje volné místo v týmu; pravidla pro předmět Poké Ball určuje konfigurace hry).',
    ],
    [/^Level up with Beauty at least (\d+)\.$/, 'Zvýšit úroveň při kráse alespoň $1.'],
    [/^Reach level (\d+) while female\.$/, 'Dosáhnout úrovně $1 jako samice.'],
    [/^Reach level (\d+) while male\.$/, 'Dosáhnout úrovně $1 jako samec.'],
    [new RegExp(`^Level up with ${name} in the party\\.$`), 'Zvýšit úroveň s $1 v týmu.'],
    [/^Reach level (\d+) during day\.$/, 'Dosáhnout úrovně $1 ve dne.'],
    [/^Reach level (\d+) during night\.$/, 'Dosáhnout úrovně $1 v noci.'],
    [/^Reach level (\d+) during dusk\.$/, 'Dosáhnout úrovně $1 za soumraku.'],
    [/^Reach level (\d+) while it is raining\.$/, 'Dosáhnout úrovně $1 za deště.'],
    [/^Reach level (\d+) while it is foggy\.$/, 'Dosáhnout úrovně $1 za mlhy.'],
    [
        /^Reach level (\d+) with an Amped nature\.$/,
        'Dosáhnout úrovně $1 s povahou ze skupiny Amped.',
    ],
    [
        /^Reach level (\d+) with an Low Key nature\.$/,
        'Dosáhnout úrovně $1 s povahou ze skupiny Low Key.',
    ],
    [
        /^Land at least (\d+) critical hits in one battle\.$/,
        'Zasadit alespoň $1 kritické zásahy v jednom souboji.',
    ],
    [
        /^Have at least (\d+) HP missing, then activate the ROM's special overworld evolution trigger\.$/,
        'Mít ztraceno alespoň $1 HP, poté aktivovat zvláštní spouštěč vývoje mimo souboj v této ROM.',
    ],
    [
        /^Reach level (\d+) in battle \((\d+)% personality branch; Family of Four\)\.$/,
        'Dosáhnout úrovně $1 v souboji ($2% větev podle osobnosti; Family of Four).',
    ],
    [
        /^Reach level (\d+) in battle \((\d+)% personality branch; Family of Three\)\.$/,
        'Dosáhnout úrovně $1 v souboji ($2% větev podle osobnosti; Family of Three).',
    ],
];

export function evolutionSummary(summary: string, language: Language): string {
    if (language !== 'cs') return summary;
    if (Object.hasOwn(czechSummaries, summary)) return czechSummaries[summary] ?? summary;
    const friendshipType =
        /^Level up with high friendship while knowing a ([A-Za-z]+) move\.$/.exec(summary);
    if (friendshipType?.[1])
        return `Zvýšit úroveň při vysokém přátelství se znalostí útoku typu ${typeDisplayName(friendshipType[1], language)}.`;
    const partyType = /^Reach level (\d+) with a ([A-Za-z]+)-type Pokémon in the party\.$/.exec(
        summary,
    );
    if (partyType?.[1] && partyType[2])
        return `Dosáhnout úrovně ${partyType[1]} s Pokémonem typu ${typeDisplayName(partyType[2], language)} v týmu.`;
    for (const [pattern, translation] of czechSummaryTemplates) {
        if (pattern.test(summary)) return summary.replace(pattern, translation);
    }
    return summary;
}

const czechConditionKeys: Readonly<Record<string, string>> = {
    item: 'Předmět',
    'held Item': 'Držený předmět',
    'move Used At Least': 'Počet použití útoku',
    'trade Partner Species': 'Druh získaný výměnou',
    natures: 'Povahy',
    'special Trigger': 'Zvláštní spouštěč',
    friendship: 'Přátelství',
    time: 'Denní doba',
    gender: 'Pohlaví',
    weather: 'Počasí',
    'nature Group': 'Skupina povah',
    'minimum Beauty': 'Minimální krása',
    'critical Hits In One Battle': 'Kritické zásahy v jednom souboji',
    'missing Hp At Least': 'Chybějící HP alespoň',
    'map Section Id': 'ID oblasti',
    'map Section': 'Oblast',
    'map Id': 'ID mapy',
    'map Hint': 'Upřesnění oblasti',
    'personality Chance': 'Pravděpodobnost podle osobnosti',
    'personality Branch': 'Větev podle osobnosti',
    special: 'Zvláštní podmínka',
    scroll: 'Svitek',
};
const czechConditionValues: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    friendship: { high: 'vysoké' },
    time: { day: 'den', night: 'noc', dusk: 'soumrak' },
    gender: { male: 'samec', female: 'samice' },
    weather: { rain: 'déšť', fog: 'mlha' },
    'nature Group': { amped: 'Amped', low_key: 'Low Key' },
    'personality Chance': { '99% branch': '99 %', '1% branch': '1 %' },
    special: { 'Shedinja companion evolution': 'souběžný vývoj Shedinja' },
    'map Hint': {
        'Moss Rock evolution area (Leafeon)': 'oblast vývoje Moss Rock (Leafeon)',
        'Ice Rock / icy evolution area (Glaceon, Crabominable)':
            'oblast vývoje Ice Rock / ledová oblast (Glaceon, Crabominable)',
    },
};

export function evolutionConditionLabel(label: string, language: Language): string {
    if (language !== 'cs') return label;
    const knownType = /^Recorded moves include a ([A-Za-z]+)-type move$/.exec(label);
    if (knownType?.[1])
        return `Zaznamenané útoky obsahují útok typu ${typeDisplayName(knownType[1], language)}`;
    const partyType = /^Recorded party includes a ([A-Za-z]+)-type Pokémon$/.exec(label);
    if (partyType?.[1])
        return `Zaznamenaný tým obsahuje Pokémona typu ${typeDisplayName(partyType[1], language)}`;
    const templates: readonly (readonly [RegExp, string])[] = [
        [/^Recorded level meets level (\d+)$/, 'Zaznamenaná úroveň dosahuje úrovně $1'],
        [/^Recorded moves include move #(\d+)$/, 'Zaznamenané útoky obsahují útok č. $1'],
        [new RegExp(`^Recorded moves include ${name}$`), 'Zaznamenané útoky obsahují $1'],
        [/^Recorded party includes species #(\d+)$/, 'Zaznamenaný tým obsahuje druh č. $1'],
        [new RegExp(`^Recorded party includes ${name}$`), 'Zaznamenaný tým obsahuje $1'],
        [
            /^Measured stats at the recorded level satisfy Attack ([<>=]) Defense$/,
            'Naměřené statistiky při zaznamenané úrovni splňují podmínku Útok $1 Obrana',
        ],
    ];
    for (const [pattern, translation] of templates) {
        if (pattern.test(label)) return label.replace(pattern, translation);
    }
    const separator = label.indexOf(': ');
    const key = label.slice(0, separator);
    if (separator >= 0 && Object.hasOwn(czechConditionKeys, key)) {
        const value = label.slice(separator + 2);
        const values = czechConditionValues[key];
        const translatedValue =
            value === 'check in game'
                ? 'ověřit ve hře'
                : values && Object.hasOwn(values, value)
                  ? values[value]
                  : value;
        return `${czechConditionKeys[key]}: ${translatedValue}`;
    }
    return evolutionSummary(label, language);
}
