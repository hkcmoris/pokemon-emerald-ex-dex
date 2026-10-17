# Owned Pokémon battle strength

The automatic score compares **current battle strength**, using the current form,
level, recorded stats and equipped moves. It is a fixed 0–100 heuristic, not a win
probability, competitive tier, training-potential rating or recommendation for a
particular opponent. Adding another Pokémon never changes existing scores.

## Formula, version 1

Let `clamp(x) = min(1, max(0, x))`. All internal calculations retain precision; only
the total is rounded to the nearest integer.

```text
offense = max(Attack, Sp. Atk)
balancedDefense = 2 × Defense × Sp. Def / (Defense + Sp. Def)
bulk = sqrt(HP × balancedDefense)
S = clamp((0.45 × offense + 0.40 × bulk + 0.15 × Speed) / 300)

Stats points  = 50 × S
Moves points  = 35 × S × M
Typing points = 15 × S × T
Score         = round(Stats points + Moves points + Typing points)
```

The fixed stat reference is **300**. It is a calibration constant, not a current
collection maximum. Harmonic averaging of Defense and Sp. Def prevents a very
high value from hiding a very weak defense. When an equipped, referenced Body
Press has the audited physical category and effect 281, Defense also enters the
`offense` maximum because that attack uses Defense.

Level is already reflected in current stats and is **not multiplied in again**.
Moves and typing scale with `S`, so their static quality cannot grant a low-level
Pokémon dozens of points independently of its current strength. Components are
contributions to this total, not three independent 0–100 grades. Rounding their
displayed values separately can produce a small apparent difference from the
rounded total.

## Current stats and estimates

The scorer reuses `getCurrentStats`: only the latest undeleted measurement for
this individual, current species, form epoch and level qualifies. A newer partial
measurement does not borrow values from an older complete measurement. Tied
measurements must agree on each recorded value; contradictory numeric values
suppress the score. Complementary partial measurements are not combined.

For each missing stat, estimate with **IV 15 and EV 0**, the current base stat and
level, and the recorded nature. An unknown nature is assumed neutral. Every
estimated stat is explicitly identified; estimates never become measurements.

```text
scaled = floor((2 × baseStat + 15) × level / 100)
HP = scaled + level + 10
otherStat = floor((scaled + 5) × naturePercent / 100)
naturePercent = 110, 90 or 100
```

Shedinja (ROM species 292) has estimated HP 1. Recorded stats already include
nature, IVs and EVs and are never adjusted again.

## Moves

Each supported damaging move receives expected comparison power:

```text
accuracy = listedAccuracy / 100, or 1 when the ROM uses accuracy 0
alignment = min(1, attackingStat / offense)
expectedPower = listedPower × STAB × alignment × accuracy
```

Physical moves use Attack; special moves use Sp. Atk; Body Press uses Defense.
STAB is 1.5 for a matching current type and otherwise 1. Struggle has no STAB and
ignores type matchups. This is not the damage formula and does not multiply by a
raw attacking stat again.

For each defending monotype in the complete chart, take the **best** equipped
attack's `expectedPower × effectiveness`, divide by the fixed reference **180**,
and clamp to 0–1. `coverage` is the equally weighted mean of these values. Extra
copies of a move or weaker attacks with identical coverage cannot inflate it.

```text
utility = min(0.20, bestHealing + bestSetup + bestControl + bestProtection)
M = clamp(0.80 × coverage + utility)
```

Utility uses explicit reviewed move rules, not the number of effect badges. Each
role contributes only its highest value, multiplied by the move's accuracy.
Attack-specific setup additionally requires a supported equipped attack using
that stat and is multiplied by that stat's alignment. Having Swords Dance with
only special attacks earns no offensive setup bonus.

The following rules were checked against the committed
`pokemon_emerald_ex_1.0.4_learnsets.json` export. IDs, category 2, power 0, effect ID
and target ID must match. The export's ROM SHA-256 is
`6150445dadedc9e95cb16ffb0be1bce37e632ce2fd2777bec6201eeec8e54e57`.

| Role | Moves (ROM IDs) | Value before accuracy/alignment |
| --- | --- | --- |
| Healing | Recover (105), Soft-Boiled (135), Milk Drink (208), Slack Off (303), Roost (355) | 0.12 |
| Healing | Rest (156), discounted for the sleep cost | 0.08 |
| Setup, Attack | Swords Dance (14), Bulk Up (339), Dragon Dance (349) | 0.10 |
| Setup, Sp. Atk | Calm Mind (347), Nasty Plot (417), Quiver Dance (483) | 0.10 |
| Setup | Agility (97), Iron Defense (334) | 0.07 |
| Control | Sleep Powder (79), Thunder Wave (86), Toxic (92), Hypnosis (95), Spore (147), Will-O-Wisp (261) | 0.10 |
| Control | Scary Face (184), Charm (204) | 0.06 |
| Control | Growl (45) | 0.04 |
| Protection | Light Screen (113), Reflect (115) | 0.06 |
| Protection | Protect (182), Detect (197) | 0.04 |

These values are deliberately coarse utility credits, not healing fractions,
status probabilities, stat-stage predictions or simulated turn advantages.

## Defensive typing

Multiply incoming effectiveness across the distinct current defensive types.
Each attacking type in the chart has equal weight. The severity credit is:

| Incoming multiplier | Credit |
| --- | --- |
| 4× | −2 |
| 2× | −1 |
| 1× | 0 |
| ½× | +1 |
| ¼× | +2 |
| Immune | +3 |

`T = clamp(0.5 + sum(credits) / (2 × numberOfChartTypes))`. This is equivalent to
`-log2(multiplier)` for nonzero multipliers. Neutral typing therefore starts at
0.5. Immunities earn more than quarter resistances, and a fourfold weakness costs
twice as much as a twofold weakness.

## Availability and limits

- Unknown move slots give **incomplete** with no total. A recorded move lacking
  reference data also gives incomplete, with a distinct missing-reference reason
  so the interface can retry. A known empty moveset has zero move contribution.
- Missing or invalid species/type-chart references give **unavailable**. A stale
  species reference is rejected even if all stats were recorded.
- State or relevant observation conflicts give **conflict**, with no total.
  A nature conflict only blocks when a non-HP stat needs estimating.
- Known unsupported moves are listed explicitly. They contribute no move points;
  the remaining information still produces a score. This may underrate Pokémon
  whose strengths depend on those moves.
- Unreviewed status moves, fixed/variable damage and dynamically selected attack
  types/categories covered by `calculateMovePower` remain unsupported. Additional
  audited exclusions cover multi-hit family 25; charging/repeated/conditional
  attack families 4, 5, 58, 93, 95, 117, 121, 125, 136, 155, 236, 273, 315 and 322;
  recharge IDs 63, 307, 308, 338, 416, 439, 459, 665, 722 and 723; and unusual
  effectiveness/reuse IDs 485, 560, 573, 614, 804, 805 and 819.
- Other positive fixed-power attacks use their listed single-hit power. Secondary
  effects, recoil, draining, priority, critical hits, PP, additional hits outside
  the excluded family and conditional power changes are not simulated or awarded
  utility. A supported base-power comparison does not claim full move support.
- Abilities, held items, weather, terrain, battle stat stages, current HP,
  opposing stats, dual-type opponent prevalence, team synergy and battle format
  are excluded. For example, a type immunity granted by an ability does not
  affect this version's Typing component. The chart measures typing alone.

## Calibration and regression checks

An artificial reference Pokémon with base 80 in every stat, neutral nature,
estimated IV 15/EV 0, Normal typing, Tackle and an all-neutral 18-type chart scores
**3 at level 5, 23 at level 50 and 44 at level 100**. These are reproducible scale
anchors, not expected ratings for those levels. A level-5 reference with strong
coverage and reviewed utility remains below the same reference at level 50 with
a known empty moveset.

Tests also check precise estimation and nature rounding, current observation
selection, Body Press, attack-category fit, accuracy, STAB, duplicate coverage,
severity ordering, utility role caps, ROM rule guards, missing references,
conflicts, bounded results and input immutability. Changes to these constants or
assumptions require an explicit scoring-version update and calibration review.
