# My Pokémon

Status: accepted and implemented from the feature interview on 2026-10-12.
The decisions and defaults below were confirmed by the user. The React client,
browser persistence, conflict handling, and Node/PHP database sync implementations
are included. Live Google sign-in still requires a deployment-specific OAuth Web
client ID, allowed origins, and cookie configuration; no client ID is supplied.
See [sign-in and synchronization setup](../my-pokemon-sync.md).

## Purpose

Help Emerald EX players track the Pokémon they own and decide what to do next during
a playthrough, especially before evolving. Casual users can maintain levels and moves;
users interested in growth can also record battle stats without imposing that work on
everyone else.

Success means a player can update their party after playing, see relevant upcoming
moves and evolution comparisons, and continue on another connected device without
exporting or importing their collection.

## Page and ownership

- Add a fourth navigation page named **My Pokémon**.
- Open on the active party, with a playthrough selector and a nearby Collection view.
- Support separate named playthroughs. Each owns its collection, active party, and
  recorded history.
- A collection contains individual owned Pokémon. Multiple individuals of the same
  species/form are valid and remain distinct.
- A party contains up to six owned Pokémon from its playthrough's collection.
  Removing a Pokémon from the party does not remove it from the collection.
- Party members can be reordered or replaced. Removed Pokémon, playthroughs, and
  stat observations remain available for restoration.
- Require only species/form and level when adding a Pokémon. Nickname, current moves,
  and battle stats are optional.
- Unrecorded moves mean unknown, not absent. Never infer a current moveset from a
  species learnset.
- Party cards prioritize level updates, current moves, and upcoming opportunities.
  Individual Pokémon details contain stats and history.

## Manual updates and catch-up

- Levels, actual evolutions, and current moves are recorded by the player.
- After a level increase, offer a skippable catch-up recap of learning and evolution
  opportunities between the old and new levels.
- Saving a new level does not depend on completing the recap or entering stats.
- Do not change species or known moves without confirmation. An available move is
  not evidence that the player learned it, and evolution does not prove which moves
  were retained or forgotten.
- Keep the same owned Pokémon identity through evolution and form changes.
- Allow missing evolution dates and levels. Accept the current species/form and level
  without requiring reconstruction of the entire history.
- Allow correction of past entries. A correction should not masquerade as a new
  growth observation.

## Optional stat history

- Record observed individual battle stats separately from species base stats.
- Keep the level and species/form associated with each observation so later evolution
  does not reinterpret old records.
- Support clearly marked estimates between observations to show growth through
  unrecorded levels. Keep estimates distinct from player-entered observations.
- Estimate each stat only between unambiguous measured values for the same owned
  Pokémon and continuous species/form period (`formEpoch`). Conflicting measurements
  at one level do not silently select a value as an interpolation endpoint.
- Never interpolate across an evolution or form change, including a transition whose
  timing is unknown.
- Keep stat entry and history unobtrusive for players who do not use them.
- The purpose is tracking observed growth, not predicting future battle stats or
  reconstructing exact unrecorded values.

## Upcoming moves and evolution comparisons

- Use the existing Emerald EX 1.0.4 dataset.
- Compare full future evolution paths and identify differences by branch.
- Cover level-up moves and TM/HM compatibility. Explicitly exclude tutors and move
  reminders from the comparison; do not wait for their data to launch this feature.
- Highlight both sides of the level-up tradeoff: moves available by delaying an
  evolution that later stages never learn by level-up, and moves unlocked by evolving
  that the current stage never learns by level-up. Keep intermediate-stage choices
  associated with the stage that must be retained.
- Compare complete learnset membership when identifying these differences. A shared
  move such as Torchic's Peck remains a timing comparison even if an evolved stage's
  learning level would already have passed. Do not call it an exclusive move.
- Keep level-up differences visible when a TM/HM is an alternative, and show that
  alternative beside the move. For example, Torchic learns Flamethrower at level 46;
  Combusken and Blaziken lack that level-up entry but can use TM35.
- Do not recommend waiting for moves already recorded as known or for learning
  levels already passed. Incomplete species data cannot establish exclusivity.
- Identify TM/HM-only alternatives and differences in learning level separately.
  Compatibility does not establish that the player owns the machine.
- Show relevant highlights on the Pokémon card and provide an expandable full
  comparison. Avoid implying permanent unavailability across excluded sources.
- Do not equate membership in a later stage's learnset with a future learning
  opportunity when that learning level would already have passed.
- Raw level-zero learnset entries are special entries with conditional availability,
  labeled for verification in the game rather than treated as ordinary level-ups.
- Evolution requirements can depend on moves, party members, items, time, stats, and
  other conditions. Reflect recorded knowledge and label unknown conditions rather
  than claiming readiness from level alone.
- Do not treat interpolated stats as observed evidence that an evolution condition
  is satisfied.
- Where evolution timing is unknown, label recap opportunities that depend on that
  timing as conditional.

## Local use, Google sign-in, and database sync

- Allow immediate local use without registration.
- Offer Google sign-in when enabling sync. Google is the only launch provider;
  Apple sign-in is deferred.
- Google authenticates the player only. The application's own backend and MySQL
  database store playthroughs, Pokémon, moves, observations, and sync revisions.
  Google Drive or other Google storage is not used for collection data.
- Connect each browser once and normally retain its signed-in session. A fresh device
  still needs an initial sign-in; opening the public URL alone cannot identify a user.
- Automatically upload guest playthroughs when the user enables sync. Preserve them
  separately from existing account playthroughs, including runs with matching names.
- Identify playthroughs and owned Pokémon independently of their names or species;
  never deduplicate by those attributes.
- Allow viewing and editing a previously loaded collection offline. Show pending
  sync state and synchronize automatically when a connection is available.
- Production builds cache the app shell after the first successful visit so it can
  reopen offline. Species and move data are cached as they are loaded. Uncached
  reference data requires a connection; the Vite development server does not install
  the production service worker.
- Full offline access to the entire dex is outside the initial scope.

## Concurrent offline changes

Automatically merge compatible changes. Preserve incompatible alternatives and ask
for a focused choice or correction; the remaining changes continue syncing.

| Concurrent changes | Agreed behavior |
| --- | --- |
| Different owned Pokémon or independent fields | Merge automatically. |
| Same field changed to the same value | Resolve automatically. |
| Same field changed to different values | Show both values and let the user choose or correct them. |
| Separate new stat observations | Preserve both with their recorded level and species/form. |
| Incompatible movesets or evolution updates | Resolve together where needed to preserve a coherent Pokémon state. |
| Party changes exceeding six members or assigning incompatible positions | Ask for a valid lineup; preserve all Pokémon in the collection. |
| Removal of a Pokémon or playthrough concurrent with an edit | Keep a recoverable copy and ask whether to retain the removal or restore the updated entry. |

Do not choose the highest level automatically: a lower value may be a correction.
Do not let reconnection order or a device's clock silently decide the user's intent.

## Accepted defaults

These confirmed defaults make the implemented behavior explicit:

- Partial stat observations are allowed; omitted values remain unknown. Estimate
  each stat only within an interval bounded by recorded observations of the same
  species/form, with no known intervening form change. Do not extrapolate beyond
  recorded observations or present an estimate as a current measured value.
- Record when a stat observation was made. Different observations at the same level
  can both be valid. Concurrent corrections or removal of the same observation use
  the ordinary conflict rule rather than being treated as new observations.
- Upload each guest playthrough once. Repeated sign-in or sync retries do not create
  additional copies; genuinely independent guest runs remain separate.
- Automatic sync occurs while the app is running and connected. It does not promise
  synchronization while the browser is closed.
- Signing out returns to guest use. Synced playthroughs remain associated with their
  Google account and return after signing in to that account; they do not become
  guest runs that could upload into another account. Pending edits retain their
  ownership and are not silently discarded.
- If an unresolved conflict affects level, species/form, or moves, display a coherent
  state and indicate the conflict; do not invent advice by combining incompatible
  alternatives.

## Boundaries

The initial feature includes optional Google sign-in with database sync, offline collection edits, stat
history, and evolution comparisons. Apple sign-in, tutor/reminder coverage, exact
future stat prediction, and a fully offline dex are deferred or outside this scope.
The app remains a manually maintained companion; this design does not add automatic
reading of the running game or game saves.

## Deployment setup

Guest collection use works without Google configuration. To enable cross-device sync,
apply the additive collection migration `scripts/sql/022_my_pokemon.sql` and configure
`GOOGLE_CLIENT_ID`, `COLLECTION_ALLOWED_ORIGINS`, and `COLLECTION_COOKIE_SECURE` for the
deployment. Google OAuth setup and a live sign-in test on both devices remain required;
they are not completed by the repository implementation. Node and PHP configuration,
database permissions, and the API contract are documented in
[My Pokémon sign-in and synchronization](../my-pokemon-sync.md).

Shared terminology is recorded in [CONTEXT.md](../../CONTEXT.md). The persistence
trade-off is recorded in [ADR 0001](../adr/0001-local-collections-with-optional-sync.md).
