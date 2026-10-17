import type { MyPokemonView } from './MyPokemonViewToggle.js';

export interface WorkspaceSelection {
    playthroughId: string;
    pokemonId?: string;
}

let selection: WorkspaceSelection | null = null;
let view: MyPokemonView = 'stats';

/** Navigation context lasts for this page session. */
export function readWorkspaceSession(): WorkspaceSelection | null {
    return selection === null ? null : { ...selection };
}

export function rememberWorkspaceSelection(value: WorkspaceSelection): void {
    selection = { ...value };
}
export function readWorkspaceView(): MyPokemonView {
    return view;
}

export function rememberWorkspaceView(value: MyPokemonView): void {
    view = value;
}
