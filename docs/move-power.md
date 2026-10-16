# Owned move effective power

Owned Pokémon move cards show a larger **Effective power** number above the original
base **Power**. Click or tap the number (or focus it and press Enter) for the formula
and its limits. The explanation is available in English and Czech. Escape or a click
outside closes it.

## Calculation

```text
effective power = round(base move power × recorded attacking stat × STAB)
```

Physical moves use Attack; special moves use Sp. Atk, using the ROM's per-move
category. Body Press uses Defense. STAB is 1.5 when either current species/form type
matches the move type, otherwise 1. Struggle never receives STAB. Matching two type
slots still applies the bonus only once.

For example, Water Gun (40 power) with recorded Sp. Atk 32 on a Water-type Pokémon
scores 1,920; a Normal-type Vice Grip (55 power) with Attack 26 on the same Pokémon
scores 1,430. This makes the stat and STAB advantage visible while retaining both
moves' original base power.

Use only the latest unambiguous observation at the owned Pokémon's current level,
species/form and continuous form period, through `getCurrentStats`. An individual
stat can be used from a partial observation. Never fill missing values from older
observations, species base stats or predicted stats. Missing reference/type/stat data
or unresolved state/stat conflicts display a dash. Each owned Pokémon has its own
calculation context. Upcoming moves, wishlist choices and learning-plan moves compare
using that same **current** Pokémon; they do not predict future stats or evolved types.

Status moves and moves with no ordinary fixed base power show a dash. The ROM also
uses power 1 for many fixed-damage, OHKO and variable-power moves; these are not
multiplied as if they were ordinary attacks. Moves requiring the target's stats,
conditional category selection or changing types also show a dash rather than an
unsupported number. See the audited ROM move IDs in
`apps/client/src/collectionMovePower.ts`.

## Relationship to damage

The general battle formula, before modifiers and with integer rounding omitted, is:

```text
base damage = (((2 × level / 5 + 2) × power × attack / defense) / 50) + 2
```

The opponent's Defense or Sp. Def is required. Further modifiers include STAB, type
effectiveness, a random 85–100% roll, critical hits, weather, burn, items and abilities.
For example, Adaptability changes ordinary STAB to 2. The collection does not record
an individual's active ability, held item or battle state, so the score uses ordinary
STAB and does not guess those modifiers.

Effective power is a target-independent **comparison score**, not a prediction of HP
lost. It intentionally omits the level factor and defensive denominator. It compares
listed base power, not conditional power boosts, accuracy-weighted damage, expected
multi-hit totals or other battle effects. Multi-hit moves use their listed per-hit
power. It does not change the existing base-stat affinity border.

## Research and verification

Reviewed on 2026-10-16:

- [Emerald EX creator repository](https://github.com/pokemonamethystteam/Pokemon_Emerald_EX):
  no released source files were available to verify exact 1.0.4 damage rounding or
  battle configuration. The existing [Move Reminder source review](move-reminder-rules.md)
  identifies the game and its pokeemerald-expansion origins.
- [pokeemerald-expansion 1.8.0 stat selection](https://github.com/rh-hideout/pokeemerald-expansion/blob/expansion/1.8.0/src/battle_util.c#L9111-L9150):
  physical/special attacking stats and the Foul Play/Body Press exceptions.
- [Upstream base damage and STAB](https://github.com/rh-hideout/pokeemerald-expansion/blob/expansion/1.8.0/src/battle_util.c#L9477-L9504):
  level, attack/defense, move power, ordinary STAB, Adaptability and Struggle.
- [Upstream final modifiers and random roll](https://github.com/rh-hideout/pokeemerald-expansion/blob/expansion/1.8.0/src/battle_util.c#L9775-L9811).
- The local `docs/pokemon_emerald_ex_1.0.4_learnsets.json` provides the release's
  actual move power, type, category and internal move IDs. Later move IDs differ
  from the official games' numbering.

The upstream implementation establishes the formula's inputs and the limits of a
calculation without a target; it is not a release-matched audit of Emerald EX 1.0.4.
