# Move effect badges

The move badges summarize supported status effects, stat changes, healing, draining,
and recoil. They supplement the full move description. An absent badge means no
supported, sufficiently clear classification is available; it does not mean that
the move has no effect.

## Source audit

On 2026-10-15, a read-only `SELECT` inspected all **935 move records** and **338
distinct effect IDs** in the local `emerald-ex-1.0.4` database. Move IDs, names,
English descriptions, effect IDs, target IDs, and categories matched the committed
`docs/pokemon_emerald_ex_1.0.4_learnsets.json` export exactly. The export identifies
its source as Pokémon Emerald EX 1.0.4, ROM SHA-256
`6150445dadedc9e95cb16ffb0be1bce37e632ce2fd2777bec6201eeec8e54e57`.
No database records or schema were changed for this classification.

The export preserves raw engine IDs but does not include secondary-effect chances,
stat-stage amounts, or the engine's complete secondary-effect definitions. In
particular, **effect 1 is generic**: it is shared by ordinary damage, burns,
paralysis, confusion, recoil, and stat changes. Other families also have exceptions:
effect 87 includes ordinary protection, poison on contact, burns on contact, and
stat drops on contact. Effect 137 includes both status-dependent damage and real
secondary status effects.

`packages/shared/src/moveEffects.ts` therefore combines explicit homogeneous
effect-family rules with audited per-move rules. Per-move rules also require the
expected effect ID. There is no runtime keyword matching, lookup by translated
name, guessed probability, or dependency on an external Pokémon API.

The initial classification assigns at least one badge to **363 of 935 moves**.
It produces 239 stat-change badges, 136 status badges, 27 healing badges, 15 draining
badges, and 19 recoil badges. A move may have several badges. The remaining moves
include ordinary attacks, unsupported mechanics, and intentionally unresolved
descriptions.

## Meaning of the fields

- `target: self` means the user receives the effect. `target` means the move's
  recipient or recipients, which may be an ally. `allies` means the user's team;
  `all` means both sides, as with Grassy Terrain healing.
- `likelihood: guaranteed` means the documented effect follows a successful use,
  subject to accuracy, immunity, eligibility, and other battle rules. It is not a
  promise that the move always lands or works against every Pokémon.
- `possible` marks a secondary chance or a description that does not establish a
  guaranteed secondary effect. No percentages are displayed.
- `conditional` marks requirements such as contact, switching in, an existing
  condition, completing a delayed action, or knocking out the target. The full move
  description retains the condition; the badge must not imply an immediate certainty.
- Stat badges report the direction, not the magnitude. They include accuracy and
  evasion. Tailwind is a Speed boost, not a claim that it changes a stat stage.
- Healing means HP recovery. Removing poison, paralysis, or burns alone does not
  count as HP healing. Draining identifies HP taken from another Pokémon to heal
  the user. Recoil describes self-damage from attacks, including conditional crash
  damage; the UI does not equate HP costs or fainting with ordinary recoil.

## Cases that require explicit handling

| Move or family | Classification |
| --- | --- |
| Toxic, Poison Fang, Malignant Chain | Bad poison, separate from ordinary poison |
| Toxic Thread | Target poison and target Speed decrease |
| Swagger / Flatter | Target confusion and target Attack / Special Attack increase |
| Rest | User sleep and user HP recovery |
| Thrash, Petal Dance, Outrage, Raging Fury | Conditional user confusion |
| Shell Smash | User Attack, Special Attack, Speed up; Defense and Special Defense down |
| Overheat, Close Combat, Draco Meteor and similar penalties | User stat decreases despite a foe being the attack's target |
| Flare Blitz | Possible target burn and user recoil |
| Toxic Spikes, Baneful Bunker, Beak Blast | Conditional target status effects |
| Burning Jealousy / Alluring Voice | Conditional burn / confusion after the target's stat boost |
| Ice Fang | Possible **frostbite**, as named by this export, plus possible flinching |
| Dire Claw | Possible paralysis, poison, or **drowsiness**, as named by this export |
| Sleep Powder / Hypnosis | Sleep on successful use; their accuracy does not turn this into a secondary-effect chance |
| Octazooka / Seed Flare | Possible stat drop; abbreviated wording does not establish a guaranteed secondary effect |

Freeze and frostbite remain separate, as do sleep and drowsiness. The local
descriptions use both terms; the classifier does not silently normalize one
mechanic into another. Multiple possible statuses on one move represent
alternatives or possible outcomes, not a claim that all apply simultaneously.

## Deliberate limits

The badges are not a battle simulator. They do not resolve abilities, held items,
weather, terrain eligibility, immunities, Protect, stat caps, contact, type-dependent
Curse behavior, random Acupressure selection, or form-dependent Order Up effects.
They do not assign precise probabilities, stage amounts, durations, or healing
fractions that are absent from the shared move contract.

Some descriptions are incomplete or ambiguous. Superpower says it lowers
"abilities" without identifying the stats; Silver Wind is similarly vague.
Tri Attack does not name its possible ailments. Secret Power varies by location.
These receive no inferred precise effects. Growth receives only the Special
Attack badge that its description confirms. Empty-description Max/Z moves are
not classified from their names. Additional source evidence is needed before
expanding these cases.

Cures and prevention are not infliction: Refresh, Heal Bell, Aromatherapy,
Safeguard, Sparkling Aria, and Electric Terrain do not acquire status-infliction
badges. Facade, Venoshock, Hex, Smelling Salts, Wake-Up Slap, Snore, and Sleep Talk
do not acquire the statuses they mention as conditions. Incinerate burns items;
Fire Pledge can burn grass; Burn Up removes a type. They do not gain burn badges.

Haze, Clear Smog, stat swaps, and stolen boosts are not ordinary stat increases or
decreases. Light Screen and Reflect reduce damage without dropping an opposing
attack stat. Focus Energy and Dragon Cheer raise critical-hit ratios, not accuracy.
Their descriptions remain the source of detail for these unsupported mechanics.

Regression tests use the committed ROM export and cover recipients, conditional
effects, combined effects, unknown IDs, and these false-positive cases. When a new
dataset or revised move definition is imported, audit its descriptions and raw IDs
before reusing or extending this version-specific classification.
