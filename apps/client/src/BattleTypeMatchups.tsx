import {
    getTypeDefenses,
    type TypeDefense,
    type TypeEffectivenessChart,
} from '@pokemon-emerald-ex-dex/shared';

import { useLanguage } from './language.js';
import { TypeBadges } from './TypeBadges.js';
import { typeDisplayName } from './typeNames.js';

/** Incoming type matchups relevant to the other combatant's types, excluding neutral hits. */
export function getBattleTypeMatchups(
    defendingTypeIds: readonly number[],
    attackingTypeIds: readonly number[],
    chart: TypeEffectivenessChart | undefined,
): TypeDefense[] | null {
    if (!chart || attackingTypeIds.length === 0) return null;
    const defenses = getTypeDefenses(defendingTypeIds, chart);
    if (!defenses) return null;
    const knownTypes = new Set(chart.types.map((type) => type.typeId));
    if (attackingTypeIds.some((id) => !knownTypes.has(id))) return null;
    const attacks = new Set(attackingTypeIds);
    return defenses.filter((type) => attacks.has(type.typeId) && type.multiplier !== 1);
}

export function BattleTypeMatchups({
    defendingTypeIds,
    attackingTypeIds,
    chart,
    defenderName,
}: {
    defendingTypeIds: readonly number[];
    attackingTypeIds: readonly number[];
    chart?: TypeEffectivenessChart;
    defenderName: string;
}) {
    const { t, language } = useLanguage();
    const matchups = getBattleTypeMatchups(defendingTypeIds, attackingTypeIds, chart);
    if (!matchups?.length) return null;
    return (
        <aside
            className="sim-battle-matchups"
            aria-label={t(
                `${defenderName}: incoming type matchups`,
                `${defenderName}: přijaté poškození podle typu`,
            )}
        >
            <ul>
                {matchups.map((type) => {
                    const kind =
                        type.multiplier === 0
                            ? 'immune'
                            : type.multiplier > 1
                              ? 'weak'
                              : 'resistant';
                    const label =
                        type.multiplier === 0
                            ? t('Immune', 'Imunita')
                            : type.multiplier > 1
                              ? t('Weakness', 'Slabina')
                              : t('Resistance', 'Odolnost');
                    const multiplier =
                        type.multiplier === 0.5
                            ? '½×'
                            : type.multiplier === 0.25
                              ? '¼×'
                              : `${type.multiplier}×`;
                    return (
                        <li
                            key={type.typeId}
                            data-matchup={kind}
                            data-multiplier={type.multiplier}
                            title={t(
                                `${typeDisplayName(type.name, language)} attacks: ${multiplier} damage taken`,
                                `Útoky typu ${typeDisplayName(type.name, language)}: přijaté poškození ${multiplier}`,
                            )}
                        >
                            <span className="sim-matchup-label">{label}</span>
                            <span className="sim-matchup-value">
                                <TypeBadges
                                    types={[type.name]}
                                    iconFiles={[type.iconFile]}
                                    iconOnly
                                />
                                <strong>{multiplier}</strong>
                            </span>
                        </li>
                    );
                })}
            </ul>
            <span className="sr-only">
                {t(
                    'Based on the opposing Pokémon’s types. Abilities and battle effects are excluded.',
                    'Podle typů protějšího Pokémona. Schopnosti a bojové efekty nejsou zahrnuty.',
                )}
            </span>
        </aside>
    );
}
