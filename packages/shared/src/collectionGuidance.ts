import type { LearnsetEntry, SpeciesDetails, SpeciesEvolution } from './dex.js';
import type { OwnedPokemon, StatObservation } from './collection.js';

export interface EvolutionConditionEvidence {
    label: string;
    status: 'met' | 'unmet' | 'unknown';
}

export interface EvolutionConditionContext {
    party?: readonly OwnedPokemon[];
    observations?: readonly StatObservation[];
    details?: Readonly<Record<number, SpeciesDetails>>;
}

/** Report recorded evidence, never a promise that evolution will trigger in the game. */
export function getEvolutionConditions(
    pokemon: OwnedPokemon,
    evolution: SpeciesEvolution,
    context: EvolutionConditionContext = {},
): EvolutionConditionEvidence[] {
    const result: EvolutionConditionEvidence[] = [];
    const handled = new Set<string>();
    if (evolution.level !== null)
        result.push({
            label: `Recorded level meets level ${evolution.level}`,
            status: pokemon.state.level >= evolution.level ? 'met' : 'unmet',
        });
    const knownMove = evolution.conditions.knownMove;
    if (
        knownMove !== null &&
        typeof knownMove === 'object' &&
        'moveId' in knownMove &&
        typeof knownMove.moveId === 'number'
    ) {
        handled.add('knownMove');
        result.push({
            label: `Recorded moves include ${'name' in knownMove && typeof knownMove.name === 'string' ? knownMove.name : `move #${knownMove.moveId}`}`,
            status:
                pokemon.state.moves === null
                    ? 'unknown'
                    : pokemon.state.moves.some((move) => move.moveId === knownMove.moveId)
                      ? 'met'
                      : 'unmet',
        });
    }
    const knownMoveType = evolution.conditions.knownMoveType;
    if (typeof knownMoveType === 'string') {
        handled.add('knownMoveType');
        const moveTypes = pokemon.state.moves?.map(
            (known) =>
                Object.values(context.details ?? {})
                    .flatMap((details) => [...details.learnset, ...details.machines])
                    .find((move) => move.moveId === known.moveId)?.type,
        );
        result.push({
            label: `Recorded moves include a ${knownMoveType}-type move`,
            status: moveTypes?.includes(knownMoveType)
                ? 'met'
                : !moveTypes || moveTypes.some((type) => type === undefined)
                  ? 'unknown'
                  : 'unmet',
        });
    }
    const speciesInParty = evolution.conditions.speciesInParty;
    if (
        speciesInParty !== null &&
        typeof speciesInParty === 'object' &&
        'speciesId' in speciesInParty &&
        typeof speciesInParty.speciesId === 'number'
    ) {
        handled.add('speciesInParty');
        result.push({
            label: `Recorded party includes ${'name' in speciesInParty && typeof speciesInParty.name === 'string' ? speciesInParty.name : `species #${speciesInParty.speciesId}`}`,
            status:
                context.party === undefined
                    ? 'unknown'
                    : context.party.some(
                            (owned) =>
                                !owned.deleted &&
                                owned.state.speciesId === speciesInParty.speciesId,
                        )
                      ? 'met'
                      : 'unmet',
        });
    }
    if (evolution.method === 'level_with_dark_type_in_party') {
        handled.add('partyRequirement');
        const types = context.party
            ?.filter((owned) => !owned.deleted)
            .map((owned) => context.details?.[owned.state.speciesId]?.types);
        result.push({
            label: 'Recorded party includes a Dark-type Pokémon',
            status: types?.some((entry) => entry?.includes('Dark'))
                ? 'met'
                : !types || types.some((entry) => entry === undefined)
                  ? 'unknown'
                  : 'unmet',
        });
    }
    if (typeof evolution.conditions.statRelation === 'string') {
        handled.add('statRelation');
        const observed = (context.observations ?? []).filter(
            (entry) =>
                !entry.deleted &&
                entry.pokemonId === pokemon.id &&
                entry.speciesId === pokemon.state.speciesId &&
                entry.formEpoch === pokemon.state.formEpoch &&
                entry.level === pokemon.state.level &&
                entry.stats.attack !== undefined &&
                entry.stats.defense !== undefined,
        );
        const relations = observed.map((entry) =>
            evolution.method === 'level_attack_gt_defense'
                ? entry.stats.attack! > entry.stats.defense!
                : evolution.method === 'level_attack_lt_defense'
                  ? entry.stats.attack! < entry.stats.defense!
                  : evolution.method === 'level_attack_eq_defense'
                    ? entry.stats.attack === entry.stats.defense
                    : null,
        );
        // Same-level training may change the relation; contradictory observations remain unknown.
        const outcomes = new Set(relations);
        result.push({
            label: `Measured stats at the recorded level satisfy ${evolution.conditions.statRelation}`,
            status:
                outcomes.size !== 1 || outcomes.has(null)
                    ? 'unknown'
                    : outcomes.has(true)
                      ? 'met'
                      : 'unmet',
        });
    }
    for (const [condition, value] of Object.entries(evolution.conditions)) {
        if (!handled.has(condition))
            result.push({
                label: `${condition.replace(/([A-Z])/g, ' $1')}: ${typeof value === 'string' || typeof value === 'number' ? value : 'check in game'}`,
                status: 'unknown',
            });
    }
    if (result.length === 0 && evolution.method !== 'level')
        result.push({ label: evolution.summary, status: 'unknown' });
    return result;
}

export interface EvolutionOpportunity {
    evolution: SpeciesEvolution;
    condition: 'level-met' | 'unknown';
    note: string;
}

export interface CatchUpRecap {
    moves: LearnsetEntry[];
    evolutions: EvolutionOpportunity[];
}

/** A recap describes opportunities; it never changes the actual species or known moves. */
export function getCatchUpRecap(
    details: SpeciesDetails,
    oldLevel: number,
    newLevel: number,
): CatchUpRecap {
    if (newLevel <= oldLevel) return { moves: [], evolutions: [] };
    return {
        moves: details.learnset.filter((move) => move.level > oldLevel && move.level <= newLevel),
        evolutions: details.evolutionLinks
            .filter(
                (edge) =>
                    !edge.internalOnly &&
                    edge.fromSpeciesId === details.speciesId &&
                    (edge.level === null || edge.level <= newLevel),
            )
            .map((evolution) => ({
                evolution,
                condition: evolution.method === 'level' ? 'level-met' : 'unknown',
                note:
                    evolution.method === 'level'
                        ? 'Level requirement reached; confirm whether evolution actually happened.'
                        : `Other conditions need checking: ${evolution.summary}`,
            })),
    };
}

export interface EvolutionMoveOpportunity {
    speciesId: number;
    level: number | null;
    machine: string | null;
    conditional: boolean;
}

export interface EvolutionMoveAdvice {
    moveId: number;
    name: string;
    sourceSpeciesId: number;
    currentLevel: number | null;
    sourceMachine: string | null;
    /** Ordered species IDs from the currently owned form to one terminal evolution. */
    branch: number[];
    kind: 'check-before-evolving' | 'evolution-gain' | 'machine-alternative' | 'timing';
    /** True only for an unrecorded, reachable positive-level move tradeoff with complete path data. */
    actionable: boolean;
    message: string;
    opportunities: EvolutionMoveOpportunity[];
}

interface FutureStage {
    speciesId: number;
    earliestLevel: number;
    conditional: boolean;
}

function paths(
    pokemon: OwnedPokemon,
    details: Readonly<Record<number, SpeciesDetails>>,
): FutureStage[][] {
    const edges = new Map<string, SpeciesEvolution>();
    for (const species of Object.values(details)) {
        for (const edge of species.evolutionFamily) {
            if (!edge.internalOnly)
                edges.set(
                    `${edge.fromSpeciesId}:${edge.toSpeciesId}:${edge.methodId}:${edge.rawParam}`,
                    edge,
                );
        }
    }
    const result: FutureStage[][] = [];
    const visit = (stages: FutureStage[]): void => {
        const current = stages[stages.length - 1];
        const next = [...edges.values()].filter(
            (edge) =>
                edge.fromSpeciesId === current.speciesId &&
                !stages.some((stage) => stage.speciesId === edge.toSpeciesId),
        );
        if (next.length === 0 || stages.length >= 16) {
            if (stages.length > 1) result.push(stages);
            return;
        }
        for (const edge of next) {
            const levelTriggered = edge.trigger === 'level_up';
            visit([
                ...stages,
                {
                    speciesId: edge.toSpeciesId,
                    earliestLevel: Math.max(
                        current.earliestLevel + (levelTriggered ? 1 : 0),
                        edge.level ?? 1,
                    ),
                    conditional: current.conditional || edge.method !== 'level',
                },
            ]);
        }
    };
    visit([
        {
            speciesId: pokemon.state.speciesId,
            earliestLevel: pokemon.state.level,
            conditional: false,
        },
    ]);
    return result;
}

function moveOpportunities(
    moveId: number,
    stages: readonly FutureStage[],
    pokemon: OwnedPokemon,
    details: Readonly<Record<number, SpeciesDetails>>,
): EvolutionMoveOpportunity[] {
    const result: EvolutionMoveOpportunity[] = [];
    for (const stage of stages) {
        const species = details[stage.speciesId];
        if (!species) continue;
        for (const move of species.learnset) {
            if (
                move.moveId === moveId &&
                (move.level === 0 ||
                    (move.level >= stage.earliestLevel && move.level > pokemon.state.level))
            )
                result.push({
                    speciesId: stage.speciesId,
                    level: move.level,
                    machine: null,
                    conditional:
                        move.level === 0 || stage.conditional || move.level === stage.earliestLevel,
                });
        }
        for (const machine of species.machines) {
            if (machine.moveId === moveId)
                result.push({
                    speciesId: stage.speciesId,
                    level: null,
                    machine: machine.machine,
                    conditional: true,
                });
        }
    }
    return result;
}

function machineNote(opportunities: readonly EvolutionMoveOpportunity[]): string {
    const machines = [
        ...new Set(
            opportunities.flatMap((entry) => (entry.machine === null ? [] : [entry.machine])),
        ),
    ];
    return machines.length
        ? ` TM/HM alternative: ${machines.join('/')}; check that you have the machine.`
        : '';
}

function evolutionGains(
    pokemon: OwnedPokemon,
    path: readonly FutureStage[],
    details: Readonly<Record<number, SpeciesDetails>>,
): EvolutionMoveAdvice[] {
    const current = details[pokemon.state.speciesId];
    if (!current) return [];
    const currentMoves = new Set(current.learnset.map((entry) => entry.moveId));
    const candidates = new Map<
        number,
        { speciesId: number; move: LearnsetEntry; reachable: boolean }[]
    >();
    for (const stage of path.slice(1)) {
        for (const move of details[stage.speciesId]?.learnset ?? []) {
            if (currentMoves.has(move.moveId)) continue;
            const candidate = {
                speciesId: stage.speciesId,
                move,
                reachable: move.level > pokemon.state.level && move.level >= stage.earliestLevel,
            };
            candidates.set(move.moveId, [...(candidates.get(move.moveId) ?? []), candidate]);
        }
    }
    return [...candidates.values()].map((entries): EvolutionMoveAdvice => {
        const ranked = [...entries].sort(
            (a, b) =>
                Number(b.reachable) - Number(a.reachable) ||
                Number(b.move.level === 0) - Number(a.move.level === 0) ||
                a.move.level - b.move.level,
        );
        const first = ranked[0];
        const complete = path.every((stage) => details[stage.speciesId] !== undefined);
        const known =
            pokemon.state.moves?.some((move) => move.moveId === first.move.moveId) ?? false;
        const opportunities = moveOpportunities(first.move.moveId, path.slice(1), pokemon, details);
        const source = details[first.speciesId];
        let message =
            first.move.level === 0
                ? `${source.name} lists ${first.move.name} as a special learnset entry (raw level 0). Verify its learning trigger in the game.`
                : `${source.name} learns ${first.move.name} at level ${first.move.level}.`;
        if (complete)
            message +=
                first.move.level === 0
                    ? ` This special entry is absent from ${current.name}'s learnset; its availability after evolution needs in-game confirmation.`
                    : ` ${current.name} does not learn this move by leveling; this is a move gained along this evolution path.`;
        if (first.reachable)
            message += ` Reach ${source.name} in time for that learning level; delaying earlier evolutions past it can miss this opportunity. Evolution requirements still apply.`;
        else if (first.move.level !== 0)
            message +=
                ' Its listed learning levels would already be past when those forms are reached; this is not an upcoming learning opportunity.';
        if (known)
            message += ' Already recorded in current moves; no need to evolve just to learn it.';
        if (!complete)
            message += ' This path is still missing species data; availability is unconfirmed.';
        const currentMachine = current.machines.filter((move) => move.moveId === first.move.moveId);
        if (currentMachine.length)
            message += ` ${current.name} already has a TM/HM route: ${currentMachine.map((move) => move.machine).join('/')}; check that you have the machine.`;
        message += machineNote(opportunities);
        return {
            moveId: first.move.moveId,
            name: first.move.name,
            sourceSpeciesId: first.speciesId,
            currentLevel: first.move.level,
            sourceMachine: null,
            branch: path.map((stage) => stage.speciesId),
            kind: 'evolution-gain',
            actionable: complete && first.reachable && !known,
            message,
            opportunities,
        };
    });
}

/** Full-path comparisons of covered sources only. Tutors and move reminders are excluded. */
export function getEvolutionGuidance(
    pokemon: OwnedPokemon,
    details: Readonly<Record<number, SpeciesDetails>>,
): EvolutionMoveAdvice[] {
    const result: EvolutionMoveAdvice[] = [];
    for (const path of paths(pokemon, details)) {
        const branch = path.map((stage) => stage.speciesId);
        for (let sourceIndex = 0; sourceIndex < path.length - 1; sourceIndex++) {
            const stage = path[sourceIndex];
            const source = details[stage.speciesId];
            if (!source) continue;
            const laterStages = path.slice(sourceIndex + 1);
            const complete = path.every((entry) => details[entry.speciesId] !== undefined);
            const sourceMoves = new Map<
                number,
                { moveId: number; name: string; level: number | null; machine: string | null }
            >();
            for (const move of [...source.learnset].sort((a, b) => a.level - b.level)) {
                if (
                    sourceIndex > 0 &&
                    move.level !== 0 &&
                    (move.level < stage.earliestLevel || move.level <= pokemon.state.level)
                )
                    continue;
                const previous = sourceMoves.get(move.moveId);
                if (
                    !previous ||
                    (previous.level !== null &&
                        previous.level <= pokemon.state.level &&
                        move.level > pokemon.state.level)
                )
                    sourceMoves.set(move.moveId, { ...move, machine: null });
            }
            for (const machine of source.machines) {
                const learned = sourceMoves.get(machine.moveId);
                if (
                    !learned ||
                    (sourceIndex === 0 &&
                        learned.level !== null &&
                        learned.level < pokemon.state.level)
                )
                    sourceMoves.set(machine.moveId, {
                        moveId: machine.moveId,
                        name: machine.name,
                        level: null,
                        machine: machine.machine,
                    });
            }
            for (const move of sourceMoves.values()) {
                const opportunities = moveOpportunities(move.moveId, laterStages, pokemon, details);
                // Repertoire membership is independent of whether its learning level is still ahead.
                // A shared move does not become exclusive when an evolved form's entry is early.
                const laterRepertoire = laterStages.flatMap((later) =>
                    (details[later.speciesId]?.learnset ?? [])
                        .filter((entry) => entry.moveId === move.moveId)
                        .map((entry) => ({ speciesId: later.speciesId, level: entry.level })),
                );
                const levelMoves = opportunities.filter(
                    (opportunity) => opportunity.level !== null,
                );
                const machines = opportunities.filter(
                    (opportunity) => opportunity.machine !== null,
                );
                if (
                    move.level !== 0 &&
                    levelMoves.some((opportunity) => opportunity.level === move.level) &&
                    complete
                )
                    continue;
                if (move.machine !== null && machines.length > 0 && complete) continue;
                const prefix =
                    move.level === 0
                        ? `${source.name} lists ${move.name} as a special learnset entry (raw level 0). Verify its learning trigger in the game.`
                        : move.machine === null
                          ? `${source.name} learns ${move.name} at level ${move.level}.`
                          : `${source.name} can learn ${move.name} through ${move.machine}; check that you have the machine.`;
                let kind: EvolutionMoveAdvice['kind'];
                let message: string;
                if (!complete) {
                    kind = 'timing';
                    message = `${prefix} This path is still missing species data; later availability is unconfirmed.`;
                } else if (laterRepertoire.length > 0) {
                    kind = 'timing';
                    const repertoire = laterRepertoire
                        .map((opportunity) =>
                            opportunity.level === 0
                                ? `${details[opportunity.speciesId].name}: special entry (raw level 0; verify its trigger in game)`
                                : `${details[opportunity.speciesId].name} at ${opportunity.level}`,
                        )
                        .join(', ');
                    message = `${prefix} Also listed in later learnsets: ${repertoire}. This is a shared move, not a level-up exclusive.`;
                    if (levelMoves.length === 0)
                        message +=
                            ' Those later learning levels would already be past when these forms are reached; they are not upcoming learning opportunities.';
                    else
                        message +=
                            ' Evolution timing and requirements still apply to future learning opportunities.';
                    message += machineNote(opportunities);
                } else if (move.machine !== null) {
                    kind = 'machine-alternative';
                    message = `${prefix} No later level-up or TM/HM route is listed on this path. This is a machine compatibility comparison; tutors and move reminders are excluded.`;
                } else if (move.level === 0) {
                    kind = 'timing';
                    message = `${prefix} This comparison does not confirm its special learning trigger.${machineNote(opportunities)}`;
                } else {
                    kind = 'check-before-evolving';
                    message = `${prefix} This is a level-up exclusive compared with later stages on this path.`;
                    message +=
                        machines.length > 0
                            ? machineNote(opportunities)
                            : ' No later TM/HM route is listed either.';
                    message += ' Tutors and move reminders are excluded.';
                }
                if (move.level === 0) {
                    kind = 'timing';
                    message +=
                        ' This special entry is not an ordinary level-up opportunity; check recorded moves and its in-game trigger.';
                } else if (
                    sourceIndex === 0 &&
                    move.level !== null &&
                    move.level <= pokemon.state.level
                ) {
                    kind = 'timing';
                    message +=
                        move.level === pokemon.state.level
                            ? ' This is the currently recorded level. Confirm whether the move was learned at this level; waiting longer will not repeat that opportunity.'
                            : ' This learning level is already past. The comparison does not imply the move can still be learned now; check recorded moves.';
                }
                const known =
                    pokemon.state.moves?.some((entry) => entry.moveId === move.moveId) ?? false;
                const actionable =
                    complete &&
                    kind === 'check-before-evolving' &&
                    move.level !== null &&
                    move.level > 0 &&
                    move.level > pokemon.state.level &&
                    move.level >= stage.earliestLevel &&
                    !known;
                if (actionable)
                    message += ` Keep ${source.name} until level ${move.level} to learn it by leveling before evolving further.`;
                if (known)
                    message +=
                        ' Already recorded in current moves; no need to wait just to learn it.';
                result.push({
                    moveId: move.moveId,
                    name: move.name,
                    sourceSpeciesId: source.speciesId,
                    currentLevel: move.level,
                    sourceMachine: move.machine,
                    branch,
                    kind,
                    actionable,
                    message,
                    opportunities,
                });
            }
        }
        result.push(...evolutionGains(pokemon, path, details));
    }
    const priority = {
        'check-before-evolving': 0,
        'evolution-gain': 1,
        'machine-alternative': 2,
        timing: 3,
    };
    return result.sort(
        (a, b) =>
            Number(b.actionable) - Number(a.actionable) ||
            priority[a.kind] - priority[b.kind] ||
            (a.currentLevel ?? 101) - (b.currentLevel ?? 101) ||
            a.moveId - b.moveId,
    );
}
