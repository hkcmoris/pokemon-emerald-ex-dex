export function TypeBadges({ types }: { types: readonly string[] }) {
    return (
        <span className="flex flex-wrap gap-1.5">
            {types.map((type) => (
                <span className="type-badge" data-type={type} key={type}>
                    {type}
                </span>
            ))}
        </span>
    );
}
