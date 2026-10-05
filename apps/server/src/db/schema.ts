export const schema = `
CREATE TABLE species (
    species_id INTEGER PRIMARY KEY, name TEXT NOT NULL, search_name TEXT NOT NULL,
    same_name_count INTEGER NOT NULL, move_count INTEGER NOT NULL, machine_count INTEGER NOT NULL
);
CREATE INDEX idx_species_search_name ON species(search_name);
CREATE TABLE moves (move_id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE learnsets (
    species_id INTEGER NOT NULL REFERENCES species(species_id), position INTEGER NOT NULL,
    level INTEGER NOT NULL, move_id INTEGER NOT NULL REFERENCES moves(move_id),
    PRIMARY KEY (species_id, position)
);
CREATE TABLE machines (
    machine TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('TM', 'HM')),
    number INTEGER NOT NULL, move_id INTEGER NOT NULL REFERENCES moves(move_id)
);
CREATE TABLE compatibility (
    species_id INTEGER NOT NULL REFERENCES species(species_id),
    machine TEXT NOT NULL REFERENCES machines(machine), PRIMARY KEY (species_id, machine)
);
CREATE TABLE evolutions (
    edge_id INTEGER PRIMARY KEY, from_species_id INTEGER NOT NULL REFERENCES species(species_id),
    to_species_id INTEGER NOT NULL REFERENCES species(species_id), internal_only INTEGER NOT NULL, data TEXT NOT NULL
);
CREATE INDEX idx_evolutions_from ON evolutions(from_species_id);
CREATE INDEX idx_evolutions_to ON evolutions(to_species_id);
CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;
