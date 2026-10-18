import type { DamageSimulation } from './damageSimulation.js';
import { useLanguage } from './language.js';

type AvailableDamage = Extract<DamageSimulation, { status: 'available' }>;

export function DamageHitSummary({ damage }: { damage: AvailableDamage }) {
    const { t } = useLanguage();
    const count =
        damage.hits.min === damage.hits.max
            ? String(damage.hits.max)
            : `${damage.hits.min}–${damage.hits.max}`;
    const czechHits = damage.hits.max === 1 ? 'zásah' : damage.hits.max <= 4 ? 'zásahy' : 'zásahů';
    return (
        <>
            {t(
                `Total · ${count} ${damage.hits.max === 1 ? 'hit' : 'hits'}`,
                `Celkem · ${count} ${czechHits}`,
            )}
            {damage.appliedAbility === 'skill-link' && ' · Skill Link'}
        </>
    );
}

export function DamagePerHit({ damage }: { damage: AvailableDamage }) {
    const { language, t } = useLanguage();
    if (damage.hits.max === 1) return null;
    const first = damage.perHit[0];
    const identical = damage.perHit.every((hit) => hit.min === first.min && hit.max === first.max);
    const range = (hit: { min: number; max: number }): string =>
        `${hit.min.toLocaleString(language)}–${hit.max.toLocaleString(language)} HP`;
    return (
        <p>
            {identical
                ? t(`Per hit: ${range(first)}.`, `Za jeden zásah: ${range(first)}.`)
                : damage.perHit
                      .map((hit, index) =>
                          t(`Hit ${index + 1}: ${range(hit)}`, `Zásah ${index + 1}: ${range(hit)}`),
                      )
                      .join(' · ')}
        </p>
    );
}
