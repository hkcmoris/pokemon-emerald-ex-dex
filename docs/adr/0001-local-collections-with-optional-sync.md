# Local collections with optional sync and explicit conflict resolution

Players must be able to use My Pokémon without registration, edit previously loaded
collections offline, and optionally continue across devices through Google sign-in.
Preserve separately identified playthroughs and owned Pokémon, automatically merge
compatible edits, and ask the player to resolve incompatible changes while retaining
recoverable alternatives. This accepts the complexity of concurrent offline changes
to avoid mandatory connectivity, repeated manual transfers, and silent loss of valid
updates through upload-order, device-clock, or highest-level rules.

The [feature brief](../features/my-pokemon.md) records the agreed conflict cases and
guest-upload behavior. This decision does not select a storage library or synchronization
algorithm.
