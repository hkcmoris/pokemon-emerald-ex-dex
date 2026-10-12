import { readFileSync } from 'node:fs';
import type { Move, SpeciesDetails, SpeciesEvolution, SpeciesMachine } from '../../src/dex.js';

interface LearnsetExport {
    moves: Omit<Move, 'descriptionCs' | 'typeIconFile' | 'categoryIconFile'>[];
    species: { speciesId: number; name: string; learnset: { moveId: number; level: number }[] }[];
}
interface MachineExport {
    species: {
        speciesId: number;
        tms: { machine: string; moveId: number }[];
        hms: { machine: string; moveId: number }[];
    }[];
}
interface EvolutionExport {
    edges: Omit<SpeciesEvolution, 'edgeOrder' | 'items' | 'fromSprite' | 'toSprite'>[];
}

/** Real checked-in ROM data for guidance tests; no HTTP server or database is needed. */
export function loadCollectionSpeciesFixture(
    speciesIds: readonly number[],
): Record<number, SpeciesDetails> {
    const learnsets = JSON.parse(
        readFileSync(
            new URL('../../../../docs/pokemon_emerald_ex_1.0.4_learnsets.json', import.meta.url),
            'utf8',
        ),
    ) as LearnsetExport;
    const machines = JSON.parse(
        readFileSync(
            new URL(
                '../../../../docs/pokemon_emerald_ex_1.0.4_tm_hm_compatibility.json',
                import.meta.url,
            ),
            'utf8',
        ),
    ) as MachineExport;
    const evolutions = JSON.parse(
        readFileSync(
            new URL('../../../../docs/pokemon_emerald_ex_1.0.4_evolutions.json', import.meta.url),
            'utf8',
        ),
    ) as EvolutionExport;
    const moves = new Map(
        learnsets.moves.map((move): [number, Move] => [
            move.moveId,
            { ...move, descriptionCs: null, typeIconFile: null, categoryIconFile: null },
        ]),
    );
    const evolutionFamily = evolutions.edges
        .filter((edge) => speciesIds.includes(edge.fromSpeciesId))
        .map((edge, edgeOrder): SpeciesEvolution => ({
            ...edge,
            edgeOrder,
            items: [],
            fromSprite: null,
            toSprite: null,
        }));
    return Object.fromEntries(
        speciesIds.map((speciesId) => {
            const species = learnsets.species.find((entry) => entry.speciesId === speciesId);
            const compatible = machines.species.find((entry) => entry.speciesId === speciesId);
            if (!species || !compatible)
                throw new Error(`Missing dataset fixture for species ${speciesId}`);
            const value: SpeciesDetails = {
                speciesId,
                name: species.name,
                types: [],
                typeIds: [],
                typeIconFiles: [],
                stats: { hp: 1, attack: 1, defense: 1, spAttack: 1, spDefense: 1, speed: 1 },
                baseStatTotal: 6,
                sprites: null,
                abilities: [],
                learnset: species.learnset.map((entry, entryOrder) => ({
                    ...moves.get(entry.moveId)!,
                    level: entry.level,
                    entryOrder,
                })),
                machines: [...compatible.tms, ...compatible.hms].map((machine): SpeciesMachine => ({
                    ...moves.get(machine.moveId)!,
                    machine: machine.machine,
                    kind: machine.machine.startsWith('TM') ? 'TM' : 'HM',
                    number: Number(machine.machine.slice(2)),
                })),
                evolutionFamily,
                evolutionLinks: evolutionFamily.filter((edge) => edge.fromSpeciesId === speciesId),
                evolutionBaseSpeciesId: speciesIds[0],
                formInfo: null,
                forms: null,
                formChanges: [],
            };
            return [speciesId, value];
        }),
    );
}
