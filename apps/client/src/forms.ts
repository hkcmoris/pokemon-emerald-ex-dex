export function formDisplayName(
    name: string,
    form: { isBaseForm: boolean; formLabel: string | null } | null,
): string {
    if (!form || form.isBaseForm || !form.formLabel || form.formLabel === 'Base') return name;
    const megaVariant = /^Mega ([XY])$/.exec(form.formLabel);
    return megaVariant ? `Mega ${name} ${megaVariant[1]}` : `${form.formLabel} ${name}`;
}

export function formKindLabel(kind: string): string {
    const label = kind.replaceAll('_', ' ');
    return label.charAt(0).toUpperCase() + label.slice(1);
}
