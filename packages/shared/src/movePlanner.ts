import type { KnownMove, OwnedPokemon } from './collection.js';
import type { SpeciesDetails, SpeciesEvolution } from './dex.js';

/** Emerald EX 1.0.4 reminder eligibility has no verified game-specific evidence. */
export const MOVE_REMINDER_ALTERNATIVES_ENABLED = false;

export type MovePlanMoveStatus =
    'learned' | 'natural' | 'conditional' | 'unreachable' | 'conflict' | 'unknown';

export interface MovePlanSource {
    kind: 'level-up' | 'machine';
    speciesId: number;
    level: number;
    machine: string | null;
    requirement: string | null;
}

export type MovePlanStep =
    | {
          kind: 'learn';
          moveId: number;
          name: string;
          speciesId: number;
          level: number;
          source: MovePlanSource;
      }
    | {
          kind: 'evolve';
          fromSpeciesId: number;
          toSpeciesId: number;
          level: number;
          evolution: SpeciesEvolution;
          conditional: boolean;
      };

export interface MovePlanMove extends KnownMove {
    status: MovePlanMoveStatus;
    source: MovePlanSource | null;
    conflictingMoveIds: number[];
    reason: string | null;
}

export interface MoveWishlistPlan {
    status: 'ready' | 'choose-branch' | 'unknown' | 'unreachable';
    branches: { speciesId: number; name: string }[];
    targetSpeciesId: number | null;
    steps: MovePlanStep[];
    moves: MovePlanMove[];
    missingSpeciesIds: number[];
    warnings: string[];
}

export interface MovePlannerOptions {
    t?: (english: string, czech: string) => string;
}

export interface MoveWishlistAddition {
    allowed: boolean;
    status: MovePlanMoveStatus;
    reason: string | null;
    conflictingMoveIds: number[];
    plan: MoveWishlistPlan;
}

interface EvolutionPath {
    speciesIds: number[];
    edges: SpeciesEvolution[];
}
interface Route {
    path: EvolutionPath;
    sources: Map<number, MovePlanSource>;
    evolutionLevels: number[];
    prerequisites: Map<number, { move: KnownMove; source: MovePlanSource }>;
}
interface RouteSearch {
    best: Route | null;
    possibleMoveIds: Set<number>;
    complete: boolean;
    unverifiedRequirements: Set<string>;
}
type Translate = NonNullable<MovePlannerOptions['t']>;
const english: Translate = (en) => en;

function evolutionPaths(
    currentSpeciesId: number,
    details: Readonly<Record<number, SpeciesDetails>>,
): { paths: EvolutionPath[]; incomplete: boolean } {
    const edges = new Map<string, SpeciesEvolution>();
    for (const species of Object.values(details)) {
        for (const edge of [...species.evolutionFamily, ...species.evolutionLinks]) {
            if (!edge.internalOnly)
                edges.set(
                    `${edge.fromSpeciesId}:${edge.toSpeciesId}:${edge.methodId}:${edge.rawParam}`,
                    edge,
                );
        }
    }
    const paths: EvolutionPath[] = [];
    let incomplete = false;
    let visited = 0;
    const visit = (path: EvolutionPath): void => {
        if (++visited > 5000 || path.speciesIds.length > 32) {
            incomplete = true;
            return;
        }
        const current = path.speciesIds[path.speciesIds.length - 1];
        const outgoing = [...edges.values()].filter((edge) => edge.fromSpeciesId === current);
        if (outgoing.length === 0) {
            paths.push(path);
            return;
        }
        for (const edge of outgoing) {
            if (visited > 5000) return;
            if (path.speciesIds.includes(edge.toSpeciesId)) {
                incomplete = true;
                continue;
            }
            visit({
                speciesIds: [...path.speciesIds, edge.toSpeciesId],
                edges: [...path.edges, edge],
            });
        }
    };
    visit({ speciesIds: [currentSpeciesId], edges: [] });
    return { paths, incomplete };
}

function conditionalCount(route: Route): number {
    return [
        ...new Map([
            ...route.sources,
            ...[...route.prerequisites].map(([id, entry]): [number, MovePlanSource] => [
                id,
                entry.source,
            ]),
        ]).values(),
    ].filter((source) => source.kind === 'machine').length;
}

/** Prefer more fulfilled wishes, then fewer machines, then earlier evolutions. */
function isBetterRoute(candidate: Route, previous: Route | null): boolean {
    if (!previous) return true;
    if (candidate.sources.size !== previous.sources.size)
        return candidate.sources.size > previous.sources.size;
    const conditionalDifference = conditionalCount(candidate) - conditionalCount(previous);
    if (conditionalDifference !== 0) return conditionalDifference < 0;
    for (let index = 0; index < candidate.evolutionLevels.length; index++) {
        const difference =
            candidate.evolutionLevels[index] - (previous.evolutionLevels[index] ?? 100);
        if (difference !== 0) return difference < 0;
    }
    return candidate.evolutionLevels.length < previous.evolutionLevels.length;
}

function collectSources(
    species: SpeciesDetails,
    entryLevel: number,
    exitLevel: number,
    wanted: ReadonlySet<number>,
    prior: ReadonlyMap<number, MovePlanSource>,
    t: Translate,
    locked: ReadonlySet<number> = new Set(),
): Map<number, MovePlanSource> {
    const result = new Map(prior);
    for (const machine of species.machines) {
        if (wanted.has(machine.moveId) && !result.has(machine.moveId))
            result.set(machine.moveId, {
                kind: 'machine',
                speciesId: species.speciesId,
                level: entryLevel,
                machine: machine.machine,
                requirement: t(
                    `Requires access to ${machine.machine}; availability is not assumed.`,
                    `Vyžaduje přístup k ${machine.machine}; jeho dostupnost není potvrzena.`,
                ),
            });
    }
    for (const move of species.learnset) {
        // Learning occurs before evolution. Level 0 and equal-entry-level learning
        // are not verified alternatives for this ROM.
        if (
            wanted.has(move.moveId) &&
            !locked.has(move.moveId) &&
            move.level > entryLevel &&
            move.level <= exitLevel &&
            (result.get(move.moveId)?.kind !== 'level-up' ||
                result.get(move.moveId)!.level > move.level)
        )
            result.set(move.moveId, {
                kind: 'level-up',
                speciesId: species.speciesId,
                level: move.level,
                machine: null,
                requirement: null,
            });
    }
    return result;
}

/**
 * Search stage intervals, not combinations of learning sources per wish. Between
 * two wanted learning levels, delaying evolution cannot add an opportunity: the
 * earlier exit preserves the same moves and only adds time in the next form.
 * Each stage therefore needs only its earliest exit and wanted learning levels.
 */
function findRoutes(
    paths: readonly EvolutionPath[],
    pokemon: OwnedPokemon,
    wanted: ReadonlySet<number>,
    details: Readonly<Record<number, SpeciesDetails>>,
    t: Translate,
): RouteSearch {
    const result: RouteSearch = {
        best: null,
        possibleMoveIds: new Set(),
        complete: true,
        unverifiedRequirements: new Set(),
    };
    const equipped = new Set((pokemon.state.moves ?? []).map((move) => move.moveId));
    const metadata = new Map(
        Object.values(details)
            .flatMap((species) => [...species.learnset, ...species.machines])
            .map((move) => [move.moveId, move]),
    );
    let visited = 0;
    for (const path of paths) {
        // Evolution prerequisites are learning targets too, even when not wishlisted.
        // Historical learned IDs are intentionally absent: evolution needs an equipped move.
        const requirements = path.edges.map((edge) => {
            const known = edge.conditions.knownMove;
            if (known !== undefined) {
                if (
                    known !== null &&
                    typeof known === 'object' &&
                    'moveId' in known &&
                    typeof known.moveId === 'number'
                ) {
                    const name =
                        'name' in known && typeof known.name === 'string'
                            ? known.name
                            : (metadata.get(known.moveId)?.name ?? '#' + known.moveId);
                    return {
                        label: name,
                        moves: [{ moveId: known.moveId, name }],
                        supported: true,
                    };
                }
                return { label: edge.summary, moves: [], supported: false };
            }
            const type = edge.conditions.knownMoveType;
            if (type !== undefined) {
                if (typeof type !== 'string')
                    return { label: edge.summary, moves: [], supported: false };
                return {
                    label: t('a ' + type + '-type move', 'útok typu ' + type),
                    moves: [...metadata.values()]
                        .filter((move) => move.type === type)
                        .map((move) => ({ moveId: move.moveId, name: move.name })),
                    supported: true,
                };
            }
            return null;
        });
        const targets = new Set([
            ...wanted,
            ...requirements.flatMap(
                (requirement) => requirement?.moves.map((move) => move.moveId) ?? [],
            ),
        ]);
        const seen = new Set<string>();
        const visit = (
            stage: number,
            entry: number,
            prior: ReadonlyMap<number, MovePlanSource>,
            evolutionLevels: number[],
            prerequisites: Route['prerequisites'],
        ): void => {
            if (++visited > 50000) {
                result.complete = false;
                return;
            }
            const signature =
                stage +
                ':' +
                entry +
                ':' +
                [...prior]
                    .map(([id, moveSource]) => id + ':' + moveSource.kind)
                    .sort()
                    .join(',') +
                ':locked:' +
                [...prerequisites.keys()].sort((a, b) => a - b).join(',');
            if (seen.has(signature)) return;
            seen.add(signature);
            const species = details[path.speciesIds[stage]];
            if (!species) {
                result.complete = false;
                return;
            }
            const locked = new Set(prerequisites.keys());
            const edge = path.edges[stage];
            if (!edge) {
                const allSources = collectSources(species, entry, 100, targets, prior, t, locked);
                const sources = new Map([...allSources].filter(([id]) => wanted.has(id)));
                for (const id of sources.keys()) result.possibleMoveIds.add(id);
                const route = { path, sources, evolutionLevels, prerequisites };
                if (isBetterRoute(route, result.best)) result.best = route;
                return;
            }
            const earliest = Math.max(
                entry + (edge.trigger === 'level_up' ? 1 : 0),
                edge.level ?? 1,
            );
            if (earliest > 100) return;
            const exits = new Set([
                earliest,
                ...species.learnset
                    .filter(
                        (move) =>
                            targets.has(move.moveId) && move.level >= earliest && move.level <= 100,
                    )
                    .map((move) => move.level),
            ]);
            const requirement = requirements[stage];
            for (const exit of [...exits].sort((a, b) => a - b)) {
                const sources = collectSources(species, entry, exit, targets, prior, t, locked);
                if (!requirement || requirement.moves.some((move) => equipped.has(move.moveId))) {
                    visit(stage + 1, exit, sources, [...evolutionLevels, exit], prerequisites);
                    continue;
                }
                const eligible = requirement.supported
                    ? requirement.moves.filter((move) => sources.has(move.moveId))
                    : [];
                if (eligible.length === 0) {
                    result.unverifiedRequirements.add(requirement.label);
                    continue;
                }
                for (const move of eligible) {
                    const acquired = sources.get(move.moveId)!;
                    const keep = t(
                        'Keep ' + move.name + ' equipped until evolving to ' + edge.toName + '.',
                        'Ponechte útok ' +
                            move.name +
                            ' mezi aktuálními útoky až do vývoje na ' +
                            edge.toName +
                            '.',
                    );
                    const requiredSource = {
                        ...acquired,
                        requirement: [acquired.requirement, keep].filter(Boolean).join(' '),
                    };
                    const nextSources = new Map(sources).set(move.moveId, requiredSource);
                    const nextPrerequisites = new Map(prerequisites).set(move.moveId, {
                        move,
                        source: requiredSource,
                    });
                    visit(
                        stage + 1,
                        exit,
                        nextSources,
                        [...evolutionLevels, exit],
                        nextPrerequisites,
                    );
                }
            }
        };
        visit(0, pokemon.state.level, new Map(), [], new Map());
    }
    return result;
}

function routeSteps(route: Route, wishes: readonly KnownMove[]): MovePlanStep[] {
    const result: MovePlanStep[] = [];
    const acquisitions = new Map(
        wishes.flatMap((move): [number, { move: KnownMove; source: MovePlanSource }][] => {
            const moveSource = route.sources.get(move.moveId);
            return moveSource ? [[move.moveId, { move, source: moveSource }]] : [];
        }),
    );
    for (const [id, prerequisite] of route.prerequisites) acquisitions.set(id, prerequisite);
    for (let stage = 0; stage < route.path.speciesIds.length; stage++) {
        const speciesId = route.path.speciesIds[stage];
        result.push(
            ...[...acquisitions.values()]
                .flatMap(({ move, source }): MovePlanStep[] =>
                    source.speciesId === speciesId
                        ? [{ kind: 'learn', ...move, speciesId, level: source.level, source }]
                        : [],
                )
                .sort((a, b) => a.level - b.level),
        );
        const evolution = route.path.edges[stage];
        if (evolution)
            result.push({
                kind: 'evolve',
                fromSpeciesId: speciesId,
                toSpeciesId: evolution.toSpeciesId,
                level: route.evolutionLevels[stage],
                evolution,
                conditional:
                    evolution.method !== 'level' || Object.keys(evolution.conditions).length > 0,
            });
    }
    return result;
}

/** Plans acquisition history, so learned wishes never constrain later evolution. */
export function planMoveWishlist(
    pokemon: OwnedPokemon,
    details: Readonly<Record<number, SpeciesDetails>>,
    options: MovePlannerOptions = {},
): MoveWishlistPlan {
    const t = options.t ?? english;
    const wishes = pokemon.moveWishlist?.moves ?? [];
    const learned = new Set([
        ...(pokemon.moveWishlist?.learnedMoveIds ?? []),
        ...(pokemon.state.moves ?? []).map((move) => move.moveId),
    ]);
    const graph = evolutionPaths(pokemon.state.speciesId, details);
    const branches = [
        ...new Map(
            graph.paths.map((path) => {
                const speciesId = path.speciesIds[path.speciesIds.length - 1];
                return [
                    speciesId,
                    {
                        speciesId,
                        name:
                            details[speciesId]?.name ??
                            path.edges.at(-1)?.toName ??
                            `#${speciesId}`,
                    },
                ];
            }),
        ).values(),
    ];
    const selected = pokemon.moveWishlist?.targetSpeciesId ?? null;
    const targetSpeciesId = selected ?? (branches.length === 1 ? branches[0].speciesId : null);
    const paths = graph.paths.filter((path) => path.speciesIds.at(-1) === targetSpeciesId);
    const relevantPaths = targetSpeciesId === null ? graph.paths : paths;
    const missingSpeciesIds = [
        ...new Set([pokemon.state.speciesId, ...relevantPaths.flatMap((path) => path.speciesIds)]),
    ].filter((id) => !details[id]);
    const warnings: string[] = [];
    let status: MoveWishlistPlan['status'] = 'ready';
    let blockedReason: string | null = null;
    if (missingSpeciesIds.length > 0 || graph.incomplete) {
        status = 'unknown';
        blockedReason = t(
            'The evolution family data is incomplete; a route cannot yet be verified.',
            'Údaje o vývojové rodině nejsou úplné; plán zatím nelze ověřit.',
        );
    } else if (targetSpeciesId === null) {
        status = 'choose-branch';
        blockedReason = t(
            'Choose a final evolution branch before adding moves.',
            'Před přidáním útoků vyberte cílovou vývojovou větev.',
        );
    } else if (paths.length === 0) {
        status = 'unreachable';
        blockedReason = t(
            'The selected final form is not reachable from the recorded current form. Choose another branch.',
            'Zvolená cílová forma není dostupná z aktuálně zaznamenané formy. Vyberte jinou větev.',
        );
    }
    if (blockedReason) warnings.push(blockedReason);
    const wanted = new Set(
        wishes.filter((move) => !learned.has(move.moveId)).map((move) => move.moveId),
    );
    const search = blockedReason ? null : findRoutes(paths, pokemon, wanted, details, t);
    if (search && !search.complete) {
        status = 'unknown';
        blockedReason = t(
            'The full route could not be verified. Keep the wishlist and check the data.',
            'Celý plán se nepodařilo ověřit. Ponechte seznam přání a zkontrolujte údaje.',
        );
        warnings.push(blockedReason);
    }
    if (search && !search.best && search.complete) {
        status = search.unverifiedRequirements.size ? 'unknown' : 'unreachable';
        blockedReason = search.unverifiedRequirements.size
            ? t(
                  'Cannot verify the required equipped evolution move: ' +
                      [...search.unverifiedRequirements].join(', ') +
                      '. Record it in current moves if known. Move Reminder is not an enabled alternative.',
                  'Nelze ověřit požadovaný aktuální útok pro vývoj: ' +
                      [...search.unverifiedRequirements].join(', ') +
                      '. Pokud jej Pokémon zná, zaznamenejte jej mezi aktuální útoky. Připomenutí útoků není povolená alternativa.',
              )
            : t(
                  'No verified evolution route reaches the selected final form from this level.',
                  'Z této úrovně nevede ověřený vývojový plán do zvolené cílové formy.',
              );
        warnings.push(blockedReason);
    }
    const conflicting = search?.best
        ? [...wanted].filter(
              (id) => search.possibleMoveIds.has(id) && !search.best!.sources.has(id),
          )
        : [];
    const moves = wishes.map((move): MovePlanMove => {
        const base = { ...move, source: null, conflictingMoveIds: [], reason: null };
        if (learned.has(move.moveId)) return { ...base, status: 'learned' };
        if (blockedReason)
            return {
                ...base,
                status: status === 'unreachable' ? 'unreachable' : 'unknown',
                reason: blockedReason,
            };
        const source = search?.best?.sources.get(move.moveId);
        if (source)
            return {
                ...base,
                status: source.kind === 'machine' ? 'conditional' : 'natural',
                source,
                reason: source.requirement,
            };
        if (search?.possibleMoveIds.has(move.moveId))
            return {
                ...base,
                status: 'conflict',
                conflictingMoveIds: [...wanted].filter(
                    (id) => id !== move.moveId && !conflicting.includes(id),
                ),
                reason: t(
                    'This move cannot share a verified evolution schedule with the other wanted moves.',
                    'Tento útok nelze zařadit do společného ověřeného vývojového plánu s ostatními požadovanými útoky.',
                ),
            };
        return {
            ...base,
            status: 'unreachable',
            reason: t(
                'No verified learning route from this form and level on the selected branch. Move Reminder and special evolution learning are not assumed.',
                'Z této formy a úrovně není na zvolené větvi ověřená možnost naučení. Připomenutí útoků ani zvláštní naučení při vývoji nejsou potvrzené alternativy.',
            ),
        };
    });
    for (const move of moves) {
        if (move.status === 'unreachable' || move.status === 'conflict') {
            status = status === 'unknown' ? status : 'unreachable';
            warnings.push(`${move.name}: ${move.reason ?? ''}`);
        }
    }
    return {
        status,
        branches,
        targetSpeciesId,
        steps: search?.best && !blockedReason ? routeSteps(search.best, wishes) : [],
        moves,
        missingSpeciesIds,
        warnings,
    };
}

/** Reject new conflicts; already-missed wishes do not block unrelated additions. */
export function assessMoveWishlistAddition(
    pokemon: OwnedPokemon,
    details: Readonly<Record<number, SpeciesDetails>>,
    candidate: KnownMove,
    options: MovePlannerOptions = {},
): MoveWishlistAddition {
    const t = options.t ?? english;
    const wishlist = pokemon.moveWishlist ?? {
        moves: [],
        learnedMoveIds: [],
        targetSpeciesId: null,
    };
    const withMoves = (moves: KnownMove[]): OwnedPokemon => ({
        ...pokemon,
        moveWishlist: { ...wishlist, moves },
    });
    const plan = planMoveWishlist(
        withMoves([
            ...wishlist.moves.filter((move) => move.moveId !== candidate.moveId),
            candidate,
        ]),
        details,
        options,
    );
    const assessment = plan.moves.find((move) => move.moveId === candidate.moveId)!;
    if (
        plan.status === 'choose-branch' ||
        plan.status === 'unknown' ||
        assessment.status === 'unreachable' ||
        assessment.status === 'unknown'
    )
        return {
            allowed: false,
            status: assessment.status,
            reason: assessment.reason ?? plan.warnings[0] ?? null,
            conflictingMoveIds: [],
            plan,
        };
    const base = planMoveWishlist(pokemon, details, options);
    const relevant = wishlist.moves.filter((move) => {
        const status = base.moves.find((entry) => entry.moveId === move.moveId)?.status;
        return move.moveId !== candidate.moveId && status !== 'unreachable' && status !== 'learned';
    });
    const isConflict = (moves: KnownMove[]): boolean =>
        planMoveWishlist(withMoves([...moves, candidate]), details, options).moves.some(
            (move) => move.status === 'conflict',
        );
    if (isConflict(relevant)) {
        // An irreducible conflicting set gives a specific explanation, not every wish.
        let conflicting = relevant;
        for (const move of relevant) {
            const reduced = conflicting.filter((entry) => entry.moveId !== move.moveId);
            if (isConflict(reduced)) conflicting = reduced;
        }
        return {
            allowed: false,
            status: 'conflict',
            conflictingMoveIds: conflicting.map((move) => move.moveId),
            reason: t(
                `Conflicts with ${conflicting.map((move) => move.name).join(', ')}: no shared verified evolution schedule.`,
                `Konflikt s útoky ${conflicting.map((move) => move.name).join(', ')}: neexistuje společný ověřený vývojový plán.`,
            ),
            plan,
        };
    }
    return {
        allowed: true,
        status: assessment.status,
        reason: assessment.reason,
        conflictingMoveIds: [],
        plan,
    };
}
