export function DexFooter({
    context = 'species',
}: {
    context?: 'species' | 'items' | 'abilities';
}) {
    return (
        <footer className="mt-8 flex flex-wrap justify-between gap-3 text-xs leading-relaxed text-stone-500">
            <p>
                {context === 'abilities'
                    ? 'Ability IDs and descriptions are preserved from the ROM.'
                    : context === 'items'
                      ? 'Item IDs and names are preserved from the ROM.'
                      : 'IDs are internal ROM species/form IDs. Forms can share a name.'}
            </p>
            <a href="https://deerflow.tech" target="_blank" rel="noreferrer">
                Created By Deerflow
            </a>
        </footer>
    );
}
