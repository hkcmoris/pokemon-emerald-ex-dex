import { useState } from 'react';
import { Button, Drawer } from '@heroui/react';
import type { PokemonType } from '@pokemon-emerald-ex-dex/shared';

import type { DexSort } from './dex.js';
import { TypeBadges } from './TypeBadges.js';

export const sortOptions: ReadonlyArray<{ value: DexSort; label: string }> = [
    { value: 'id', label: 'Species ID' },
    { value: 'name', label: 'Name A–Z' },
    { value: 'total', label: 'Highest stat total' },
    { value: 'speed', label: 'Highest speed' },
];

interface PokemonFilterSheetProps {
    types: readonly PokemonType[];
    selectedType: string;
    sort: DexSort;
    resultCount: number | undefined;
    updating: boolean;
    onTypeChange: (type: string) => void;
    onSortChange: (sort: DexSort) => void;
    onReset: () => void;
}

export function PokemonFilterSheet({
    types,
    selectedType,
    sort,
    resultCount,
    updating,
    onTypeChange,
    onSortChange,
    onReset,
}: PokemonFilterSheetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const activeCount = Number(Boolean(selectedType)) + Number(sort !== 'id');

    return (
        <Drawer isOpen={isOpen} onOpenChange={setIsOpen}>
            <Button className="filter-trigger" variant="secondary">
                <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
                >
                    <path d="M4 7h16M4 17h16" />
                    <circle cx="9" cy="7" r="2.5" />
                    <circle cx="15" cy="17" r="2.5" />
                </svg>
                Filters
                {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
            </Button>
            <Drawer.Backdrop className="filter-sheet-backdrop">
                <Drawer.Content placement="bottom" className="filter-sheet-content">
                    <Drawer.Dialog className="filter-sheet" aria-label="Filter Pokémon">
                        <Drawer.Handle />
                        <Drawer.CloseTrigger aria-label="Close filters" />
                        <Drawer.Header>
                            <p className="eyebrow">Fine-tune your field guide</p>
                            <Drawer.Heading className="filter-sheet-heading">
                                Filter Pokémon
                            </Drawer.Heading>
                        </Drawer.Header>
                        <Drawer.Body className="filter-sheet-body">
                            <fieldset>
                                <legend className="filter-legend">Type</legend>
                                <p className="filter-hint">
                                    Choose one type. Dual-type Pokémon are included.
                                </p>
                                <div className="filter-type-grid">
                                    <label
                                        className="filter-type-option"
                                        data-selected={!selectedType}
                                    >
                                        <input
                                            className="sr-only"
                                            type="radio"
                                            name="pokemon-type"
                                            value=""
                                            checked={!selectedType}
                                            onChange={() => onTypeChange('')}
                                        />
                                        <span className="filter-all-types">All types</span>
                                    </label>
                                    {types.map(({ typeId, name, iconFile }) => (
                                        <label
                                            className="filter-type-option"
                                            data-selected={selectedType === name}
                                            key={typeId}
                                        >
                                            <input
                                                className="sr-only"
                                                type="radio"
                                                name="pokemon-type"
                                                value={name}
                                                checked={selectedType === name}
                                                onChange={() => onTypeChange(name)}
                                            />
                                            <TypeBadges types={[name]} iconFiles={[iconFile]} />
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                            <label className="filter-label">
                                Sort by
                                <select
                                    className="filter-input"
                                    value={sort}
                                    onChange={(event) => {
                                        const option = sortOptions.find(
                                            (option) => option.value === event.target.value,
                                        );
                                        if (option) onSortChange(option.value);
                                    }}
                                >
                                    {sortOptions.map(({ value, label }) => (
                                        <option key={value} value={value}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </Drawer.Body>
                        <Drawer.Footer className="filter-sheet-footer">
                            <Button variant="secondary" onPress={onReset}>
                                Reset all
                            </Button>
                            <Button variant="primary" onPress={() => setIsOpen(false)}>
                                {updating
                                    ? 'View results'
                                    : resultCount === undefined
                                      ? 'View results'
                                      : `Show ${resultCount.toLocaleString('en-US')} results`}
                            </Button>
                        </Drawer.Footer>
                    </Drawer.Dialog>
                </Drawer.Content>
            </Drawer.Backdrop>
        </Drawer>
    );
}
