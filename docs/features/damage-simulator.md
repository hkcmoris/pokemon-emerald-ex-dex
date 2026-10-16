# Collection damage simulator

Status: implemented from the design approved on 2026-10-16.

Open **Simulate damage** on a collection Pokémon to visit
`#/my-pokemon/<owned-id>/simulator`. The collection selector changes the attacker.
Its current form uses the back sprite; the selected opponent uses the front sprite.
The collection's [effective-power score](../move-power.md) remains a separate,
target-independent comparison.

## Inputs and move previews

- Use the owned Pokémon's current recorded level, form and unambiguous recorded
  stats. Missing stats require temporary inputs; older observations, base stats
  and growth predictions do not fill gaps. Recorded stats can also be overridden
  temporarily. Form, level or identity conflicts block the scenario; observation
  conflicts require temporary values.
- Select any enemy species/form and a level from 1 to 100. Enemy stats assume
  neutral nature, 31 IVs and 0 EVs. HP, Defense and Sp. Def can be overridden;
  changing enemy species or level clears its overrides. Shedinja's estimated HP is 1.
- The four recorded moves appear first, including recorded inherited moves absent
  from the current form's learnset. Preview the **current form's full level-up
  learnset and TM/HM moves**, with source and future level labels. Future previews
  use today's attacker level, stats and types. Moves exclusive to future evolved
  forms are not included.
- Past-level labels describe the learnset, not confirmed Move Reminder access;
  game-specific acquisition rules remain unverified in
  [the source review](../move-reminder-rules.md).
- Scenario inputs and previews are local component state. They never update the
  saved collection, known moves, level, observations, wishlist or history. Changing
  attacker/form/recorded level or leaving the page starts a fresh scenario.

The simulator also displays the attacker’s saved nature and selected ability.
Nature highlights current attacking stats; recorded values already include its
effect and are never multiplied again. Ability effects remain excluded from damage.
Change these saved choices on the collection card; simulator controls stay temporary.

## Damage calculation

The prominent result is a **minimum–maximum HP damage range**, with the percentage
of enemy maximum HP below and the original base move power kept smaller.
Each result describes one successful hit at the listed base power.

```text
level factor = floor(2 × attacker level / 5) + 2
base damage = floor(floor(level factor × power × attack / defense) / 50) + 2
random damage = floor(base damage × random roll / 100), rolls 85…100
STAB damage = round-half-down(random damage × STAB)
final damage = round-half-down(STAB damage × combined type effectiveness)
```

Non-immune hits have a minimum of 1 HP; immunity gives 0 HP. Physical moves use
Attack and Defense; special moves use Sp. Atk and Sp. Def. Body Press uses the
attacker's Defense. Psyshock, Psystrike and Secret Sword use the enemy's Defense.
Ordinary STAB is 1.5 for a matching attacker type and 1 otherwise. Struggle ignores
STAB and type matchups. Both enemy types contribute to effectiveness. The formula
uses underlying stats, never the collection's rounded effective-power score.

Enemy non-HP stats are `floor((2 × base + 31) × level / 100) + 5`; HP uses the same
floored term plus `level + 10`, except Shedinja.

## Limits and sources

Abilities, held items, weather, critical hits, status conditions and stat boosts
are excluded. Conditional-power moves use their listed power; multi-hit moves
show damage per hit. This is an independent-hit comparison, not a battle engine.
Fixed-damage, OHKO, unsupported dynamic stats/types and special type-effectiveness
moves display a dash. In particular, Flying Press, Freeze-Dry, Thousand Arrows, Synchronoise,
Collision Course and Electro Drift
need mechanics beyond the ordinary type chart.

The formula follows the
[upstream pokeemerald-expansion damage calculation](https://github.com/rh-hideout/pokeemerald-expansion/blob/expansion/1.8.0/src/battle_util.c#L9478-L9504)
and [modifier order](https://github.com/rh-hideout/pokeemerald-expansion/blob/expansion/1.8.0/src/battle_util.c#L9770-L9822).
Exact Emerald EX 1.0.4 battle configuration could not be verified against released
source, so results are estimates under the stated assumptions. The ROM supplies
move power, category, type, learnsets and base stats; see
[the research record](../move-power.md#research-and-verification).
