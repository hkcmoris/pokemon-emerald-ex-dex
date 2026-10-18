# Collection damage simulator

Status: implemented, including saved encounters approved on 2026-10-18.

Open **Simulator** from the persistent main navigation at `#/simulator`, or use
**Simulate damage** on a collection Pokémon to visit `#/simulator/<owned-id>`.
The older `#/my-pokemon/<owned-id>/simulator` links remain supported.
The main entry uses the active playthrough and remembered member, then falls back
to its first party member or collection Pokémon. An empty playthrough offers a
link to add Pokémon rather than selecting an attacker from another run.
The collection selector changes the attacker.
Its current form uses the back sprite; the selected opponent uses the front sprite.
The collection's [effective-power score](../move-power.md) remains a separate,
target-independent comparison.

The battle column starts with compact sprite strips for your party and the selected
encounter's enemy party, followed by the matchup and current move cards. Both strips
keep the saved roster order and mark the selected member. Switch either side directly
from its sprite; switching your Pokémon preserves the selected opponent and page position.
Sprite labels include names and levels, and known incoming move weaknesses or sync
conflicts retain warning icons. An empty or conflicted own party shows a notice. Quick
matchups show the single selected opponent instead of inventing an enemy party.
**Edit battle stats** starts collapsed and contains both sides' temporary stat overrides;
opening it retains the current values and calculations. Quick opponent selection stays
outside the disclosure, with search open until an opponent is chosen. Detailed encounter
management and party warnings, the collection selector, scenario reset, and saved-level
controls sit in a desktop sidebar and follow the battle column on phones. **Teams**
and **Back to battle** phone shortcuts move focus between them. Incoming damage and move
previews follow the stat editor.

## Inputs and move previews

- **Level up +1** immediately saves one level for the selected collection Pokémon.
  The adjacent level editor supports larger jumps and corrections with **Save level**.
  Levels remain within 1–100. Saving keeps earlier observations and the selected opponent,
  clears stale attacker overrides, and leaves newly reached moves/evolutions available
  through **Review level-up changes**. Record new measured stats from the linked workspace;
  older-level stats are never reused as current measurements. Stale member, form, level,
  or playthrough changes reject the save rather than overwrite newer data.
- Use the owned Pokémon's current recorded level, form and unambiguous recorded
  stats. Missing stats require temporary inputs; older observations, base stats
  and growth predictions do not fill gaps. Recorded stats can also be overridden
  temporarily. Form, level or identity conflicts block the scenario; observation
  conflicts require temporary values.
- Select any enemy species/form and a level from 1 to 100. Enemy stats assume
  neutral nature, 31 IVs and 0 EVs. HP, Attack, Defense, Sp. Atk and Sp. Def can be overridden;
  changing enemy species or level clears its overrides. Shedinja's estimated HP is 1.
- The four recorded moves appear first, including recorded inherited moves absent
  from the current form's learnset. Their learning-source badges sit inside
  **Calculation** when damage is available, keeping the battle cards short; preview
  cards retain their source badges beside the move. Preview the **current form's full level-up
  learnset and TM/HM moves**, with source and future level labels. Future previews
  use today's attacker level, stats and types. Moves exclusive to future evolved
  forms are not included.
- Past-level labels describe the learnset, not confirmed Move Reminder access;
  game-specific acquisition rules remain unverified in
  [the source review](../move-reminder-rules.md).
- Quick-matchup inputs, stat overrides and move previews are separate session state.
  They never update recorded stats, owned moves, observations, wishlist or history. Switching attackers
  preserves the opponent, its level and stat overrides. Navigating away and returning
  restores the scenario and each unchanged attacker's previews and temporary values.
  New recorded stats, moves, nature, ability, form or level invalidate that attacker's
  temporary values and previews. Scenarios are isolated per dataset and are cleared by
  **Reset scenario** or a browser reload. Saved encounter teams are retained.

## Saved encounters and revealed moves

Create named encounters within the current playthrough, for example **Rival · Route 110**.
Each encounter holds up to six opponents with independent identities, so two Pokémon of
the same species can have different levels and revealed moves. Use the horizontal enemy
roster to switch the selected matchup without re-entering anything. Duplicate an encounter
for a rematch; its opponents receive new identities, leaving the original battle intact.

Each opponent starts with unknown moves. Record up to four moves as they are revealed,
using the full move search rather than assuming a level-up learnset. Changes save locally
and use the existing signed-in collection sync between desktop and phone. Levels save
on leaving the field or pressing Enter; move selections save immediately. Failed saves
remain visible for correction or retry. Conflicting edits require a choice before their
matchup estimates are used. Encounter data is also included in collection export/import.

Selecting **Quick matchup** retains the original temporary single-opponent workflow.
**Reset scenario** clears temporary overrides and previews without deleting named encounters.
The selected encounter and opponent are remembered on this device for each playthrough.

Known enemy moves add a separate incoming-threat warning to vulnerable party members,
even when their outgoing type matchup is favorable. Expand the warning to see the move
and its 2× or 4× multiplier. Status moves do not produce damaging-type warnings. Moves with
unmodeled type or damage mechanics are identified as uncertain instead of being treated
as safe. Unrevealed moves are always unknown; absence of a warning is not a safety claim.

The selected matchup shows incoming HP damage ranges and percentages of maximum HP for
each revealed move. Recorded current-form/current-level HP, Defense and Sp. Def take
priority. Missing defenses use labeled estimates with 31 IVs, 0 EVs and the recorded
nature (neutral if unknown). Measured stats already include nature and are not adjusted
again. Temporary Defense overrides apply in both directions. Observation conflicts
suppress incoming estimates until resolved. Each range totals the displayed hit count
for one move use, assuming the first hit lands. The enemy's ability is unknown, so
incoming estimates use the move's normal hit range, even if your Pokémon has Skill Link.
No current-health or guaranteed-knockout claim is made.

The simulator also displays the attacker’s saved nature and selected ability.
Nature highlights current attacking stats; recorded values already include its
effect and are never multiplied again. Skill Link affects supported multi-hit moves
when it is the saved current-form ability or the form's sole possible ability.
Unknown, stale or conflicting ability selections never choose among multiple abilities.
Other ability effects remain excluded from damage.
Change nature and ability on the collection card. Saved level controls update the collection;
named encounter levels and revealed moves also persist; quick matchups, stat overrides
and move previews remain temporary.

The battle preview shows relevant recorded move matchups beside each name: left
of the enemy for your recorded moves, and right of your Pokémon for the enemy's
revealed moves. Only non-neutral damaging moves appear, including immunities;
status moves and learnset previews never imply attacking coverage. Moves sharing
the same type and multiplier share one badge, with move names in its tooltip.
Both defensive types multiply. Unknown enemy moves produce no badge, and unresolved,
unsupported or conflicting move data suppresses the hints rather than substituting
the combatant's own types. Ability effects remain excluded from these type hints.

The party strip follows the current playthrough's saved party order and switches
attackers without changing the opponent. Green means at least one of a member's
recorded damaging moves is super effective against the enemy. Red means every
recorded damaging move is resisted (or blocked by immunity); a neutral option keeps
the card neutral. The label, move name and multiplier use the highest type-effectiveness
multiplier among recorded moves against both enemy types. A Water Pokémon with only Icicle Spear and status moves
is therefore resisted by a Fire opponent; a status move such as Withdraw never
supplies Water coverage. Off-type coverage moves count normally. This is move type
coverage guidance, not a prediction from stats, level or abilities. Unknown moves,
no damaging moves, missing data and unsupported mechanics get distinct neutral
labels. Missing or conflicting data produces no effectiveness claim. The selected attacker
has a separate outline so selection remains distinguishable from effectiveness.

## Damage calculation

The prominent result is a **minimum–maximum HP damage range**, with the percentage
of enemy maximum HP below and the original base move power kept smaller.
Each result totals one use of the move, with an explicit hit-count label such as
**Total · 2–5 hits** or **Total · 5 hits · Skill Link**. HP percentages use those
same totals. Expand **Calculation** for individual-hit ranges. Ranges assume the
first hit lands; they are possible extremes rather than expected damage or hit odds.

```text
level factor = floor(2 × attacker level / 5) + 2
base damage = floor(floor(level factor × power × attack / defense) / 50) + 2
random damage = floor(base damage × random roll / 100), rolls 85…100
STAB damage = round-half-down(random damage × STAB)
hit damage = round-half-down(STAB damage × combined type effectiveness)
total minimum = sum of the first minimum-hit-count hits at their minimum damage
total maximum = sum of all maximum-hit-count hits at their maximum damage
```

Non-immune hits have a minimum of 1 HP; immunity gives 0 HP. Physical moves use
Attack and Defense; special moves use Sp. Atk and Sp. Def. Body Press uses the
attacker's Defense. Psyshock, Psystrike and Secret Sword use the enemy's Defense.
Ordinary STAB is 1.5 for a matching attacker type and 1 otherwise. Struggle ignores
STAB and type matchups. Both enemy types contribute to effectiveness. The formula
uses underlying stats, never the collection's rounded effective-power score.

The ROM's ordinary 2–5-hit moves, including Icicle Spear, use two minimum-damage
hits through five maximum-damage hits. Skill Link fixes their count at five.
Fixed two-hit and three-hit moves retain their fixed counts. Triple Kick and
Triple Axel increase their listed power by 1×, 2× and 3× across hits; their ranges
start at one hit because later accuracy checks can end the sequence. Population
Bomb similarly ranges from one to ten hits. Skill Link removes subsequent accuracy
checks for these moves, fixing them at three or ten hits respectively; the initial
accuracy check is still assumed to succeed. Damage is rounded independently per
hit before summing, not calculated once from multiplied base power.

For example, the reported Lv. 18 Shellder matchup (Attack 31, Icicle Spear power 25,
enemy Defense 41 and HP 69, Ice effectiveness 2×, no STAB) gives **8–10 HP per hit**.
It now displays **16–50 HP** normally, or **40–50 HP (58–72.5%)** with Skill Link.

Enemy non-HP stats are `floor((2 × base + 31) × level / 100) + 5`; HP uses the same
floored term plus `level + 10`, except Shedinja.

## Limits and sources

Except for Skill Link's hit-count effects, abilities, held items, weather, critical
hits, status conditions and stat boosts are excluded. Conditional-power moves use
their listed power, with the explicit escalating-hit cases above. Initial misses,
the probability of each hit count, contact-triggered effects between hits, and
stopping when the target faints are not modeled. This is a damage-range comparison,
not a battle engine.
Fixed-damage, OHKO, unsupported dynamic stats/types and special type-effectiveness
moves display a dash. In particular, Flying Press, Freeze-Dry, Thousand Arrows, Synchronoise,
Collision Course and Electro Drift
need mechanics beyond the ordinary type chart.
Surging Strikes is also unavailable because its guaranteed critical hits are not
modeled. Beat Up needs party-dependent damage data. Water Shuriken with a known
Battle Bond ability or Ash-Greninja form is unavailable because its special power
and hit-count rules are not modeled. Unrecognized multi-hit effect combinations
are unavailable rather than shown as ordinary single-hit damage.

Move identities and effect IDs are checked against the Emerald EX 1.0.4 export.
Its Skill Link ID is **92**, not the standard National ability ID 93. The hit-count
mapping therefore uses the ROM identifiers, and never guesses from a move name or
description. Names and translated descriptions remain display text.

The formula follows the
[upstream pokeemerald-expansion damage calculation](https://github.com/rh-hideout/pokeemerald-expansion/blob/expansion/1.8.0/src/battle_util.c#L9478-L9504)
and [modifier order](https://github.com/rh-hideout/pokeemerald-expansion/blob/expansion/1.8.0/src/battle_util.c#L9770-L9822).
Multi-hit behavior follows the pinned upstream
[hit-count selection](https://github.com/rh-hideout/pokeemerald-expansion/blob/expansion/1.8.0/src/battle_util.c#L3411-L3456),
[Skill Link accuracy checks](https://github.com/rh-hideout/pokeemerald-expansion/blob/expansion/1.8.0/src/battle_script_commands.c#L1697-L1704),
[escalating hit power](https://github.com/rh-hideout/pokeemerald-expansion/blob/expansion/1.8.0/src/battle_util.c#L8252-L8256),
and [Population Bomb's ten strikes](https://github.com/rh-hideout/pokeemerald-expansion/blob/expansion/1.8.0/src/data/moves_info.h#L17797-L17814).
Exact Emerald EX 1.0.4 battle configuration could not be verified against released
source, so results are estimates under the stated assumptions. The ROM supplies
move power, category, type, learnsets and base stats; see
[the research record](../move-power.md#research-and-verification).
