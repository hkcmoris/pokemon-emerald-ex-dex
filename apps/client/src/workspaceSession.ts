export interface WorkspaceSelection {
    playthroughId: string;
    pokemonId?: string;
}

let selection: WorkspaceSelection | null = null;

/** Navigation context lasts for this page session; battle scenarios are never stored here. */
export function readWorkspaceSession(): WorkspaceSelection | null {
    return selection === null ? null : { ...selection };
}

export function rememberWorkspaceSelection(value: WorkspaceSelection): void {
    selection = { ...value };
}
