import { createContext, useContext, useId, type ReactNode } from 'react';
import type { BaseStats, Move } from '@pokemon-emerald-ex-dex/shared';

import { calculateMovePower } from './collectionMovePower.js';
import { useLanguage } from './language.js';

interface MovePowerContextValue {
    stats: Partial<BaseStats>;
    typeIds?: readonly number[];
}

const MovePowerContext = createContext<MovePowerContextValue | undefined>(undefined);

export function MovePowerProvider({
    stats,
    typeIds,
    children,
}: MovePowerContextValue & { children: ReactNode }) {
    return (
        <MovePowerContext.Provider value={{ stats, typeIds }}>{children}</MovePowerContext.Provider>
    );
}

/** Compare moves using this individual's current recorded battle stats. */
export function MovePower({ move }: { move?: Move }) {
    const context = useContext(MovePowerContext);
    const { language, t } = useLanguage();
    const hintId = useId();
    if (!context) return null;
    const power = calculateMovePower(move, context.stats, context.typeIds);
    const label = t('Effective power', 'Efektivní síla');
    const value = power.status === 'available' ? power.value.toLocaleString(language) : '—';
    const explanation =
        power.status === 'available'
            ? t(
                  `${move!.power} base power × ${power.statValue} ${power.stat === 'attack' ? 'Attack' : power.stat === 'defense' ? 'Defense' : 'Sp. Atk'} × ${power.stab} STAB. Uses current recorded stats and types, including for future moves. Comparison score, not HP damage. Opponent defenses, level factor, effectiveness, abilities, items, battle conditions and random rolls are not included. Multi-hit moves use power per hit.`,
                  `${move!.power} základní síla × ${power.statValue} ${power.stat === 'attack' ? 'Útok' : power.stat === 'defense' ? 'Obrana' : 'Sp. útok'} × ${power.stab} STAB. Používá aktuální zaznamenané statistiky a typy i pro budoucí útoky. Srovnávací skóre, nikoli poškození HP. Nezahrnuje obranu soupeře, faktor úrovně, účinnost, schopnosti, předměty, podmínky boje ani náhodu. U vícenásobných útoků počítá jeden zásah.`,
              )
            : power.status === 'not-applicable'
              ? t(
                    'This move has no ordinary fixed-power damage to compare.',
                    'Tento útok nemá běžné poškození s pevnou základní silou.',
                )
              : power.status === 'unsupported'
                ? t(
                      'This move needs additional battle information to calculate its power.',
                      'Výpočet síly tohoto útoku vyžaduje další údaje o boji.',
                  )
                : t(
                      'Record the required battle stat at the current level and form. Resolve any stat conflicts. Move and Pokémon type data must also be available.',
                      'Zaznamenejte potřebnou bojovou statistiku na aktuální úrovni a ve stávající formě. Vyřešte případné konflikty statistik. Musí být dostupné také údaje o útoku a typech Pokémona.',
                  );
    return (
        <>
            <button
                type="button"
                className="my-move-effective-power"
                aria-label={`${label}: ${value}`}
                popoverTarget={hintId}
                title={`${label}: ${value}. ${explanation}`}
                onClick={(event) => event.stopPropagation()}
            >
                <strong>{value}</strong>
            </button>
            <span id={hintId} popover="auto" className="my-move-power-hint">
                <strong>
                    {label}: {value}
                </strong>
                <span>{explanation}</span>
            </span>
        </>
    );
}
