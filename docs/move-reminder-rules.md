# Emerald EX Move Reminder verification

Checked on 2026-10-14 for **Pokémon Emerald EX 1.0.4 by Pokémon Amethyst Team**.
This is a different game from Theta Emerald EX and Emerald EX Speedchoice.

## Planner decision

**Move Reminder alternatives remain disabled.** The available primary sources do
not establish this release's reminder eligibility or access requirements. The
planner must not use assumed reminder access to accept a wishlist or resolve a
level-up conflict. A blocked selection means no supported route was found, not
that every possible in-game learning method has been disproved.

Level-up and TM/HM routes use the existing ROM exports. TM/HM availability remains
conditional on obtaining the machine. Remembering that an owned Pokémon learned
a wishlisted move is application history, not evidence that the game can relearn it.

## Evidence checked

- The local [learnset export](pokemon_emerald_ex_1.0.4_learnsets.json) identifies
  version 1.0.4 and ROM SHA-256
  `6150445dadedc9e95cb16ffb0be1bce37e632ce2fd2777bec6201eeec8e54e57`.
  Its metadata describes extracted level-up tables, not reminder logic. The
  [evolution export](pokemon_emerald_ex_1.0.4_evolutions.json) explicitly identifies
  an older `pokeemerald-expansion` evolution-method enum. Neither export records
  build configuration or the reminder implementation.
- The creator's [release thread](https://www.reddit.com/r/PokemonROMhacks/comments/1vbx9nw/pokemon_emerald_ex_release/)
  identifies the game, credits `pokeemerald-expansion`, and links the official
  documentation. It does not specify reminder eligibility. The author's later
  source-sharing comment offers a tileset ZIP, not a documented engine release.
- The creator's [public source repository](https://github.com/pokemonamethystteam/Pokemon_Emerald_EX)
  is empty. Its [contents API](https://api.github.com/repos/pokemonamethystteam/Pokemon_Emerald_EX/contents)
  returned HTTP 404 with `This repository is empty.` There is no released source
  revision to match against this project's ROM hash.
- The creator's [master documentation](https://docs.google.com/spreadsheets/d/1PjqPF42jGx6NxhKohJjHr768_Cvd49kw/edit)
  was inspected through its public XLSX export, including workbook sheet names and
  XML text. Its nine sheets cover wild Pokémon, the Pokédex, rarities, Pokémon
  changes, evolution item locations, TM locations, level caps, gym teams, and
  credits. They provide no reminder/relearner, Heart Scale, or Move Maniac rule.
- The upstream expansion's [level-up reminder implementation](https://github.com/rh-hideout/pokeemerald-expansion/blob/73b3fbeb574327cd9420c89e56bef5aa3c08fead/src/move_relearner.c#L914-L942)
  illustrates why the base project's name is insufficient evidence:
  `P_ENABLE_ALL_LEVEL_UP_MOVES` selects the level cutoff, and `P_PRE_EVO_MOVES`
  selects whether previous species are searched. This is **not** the verified
  Emerald EX 1.0.4 implementation and must not supply its defaults.

## Rules still requiring release-specific verification

| Question | Verified for Emerald EX 1.0.4? |
| --- | --- |
| Current species only, or previous evolution stages too? | No |
| Moves at or below the current level, or future levels too? | No |
| Meaning of raw level-zero learnset entries? | Evolution marker in upstream source; adopted for all species |
| Whether egg, tutor, TM/HM, or previously known moves qualify? | No |
| NPC location, progression requirement, payment, and repeat cost? | No |
| Ordinary moves matching the level at evolution? | Supported upstream; not yet included in the planner |

### Evolution learning is separate from the Move Reminder

The upstream engine explicitly checks for raw **level 0** entries when a Pokémon
evolves. It also offers ordinary moves matching the Pokémon's current level. It
does not offer every level-1 move just because the species evolved:

- [Expansion 1.8.0 evolution-learning implementation](https://github.com/rh-hideout/pokeemerald-expansion/blob/expansion/1.8.0/src/pokemon.c#L5927-L5950)
  checks `learnset.level == 0 || learnset.level == currentLevel`.
- [Current pinned upstream implementation](https://github.com/rh-hideout/pokeemerald-expansion/blob/73b3fbeb574327cd9420c89e56bef5aa3c08fead/src/pokemon.c#L5854-L5878)
  retains that distinction. Its additional level-1 configuration only concerns
  Pokémon whose actual level is 1 when evolving.
- The creator's release thread above identifies Emerald EX as built on
  `pokeemerald-expansion`. The custom game's exact source revision remains
  unavailable, so this establishes the upstream data convention, not an audit
  of every mechanic in the release-matched binary.

The app uses this convention consistently: `getEvolutionMoves` selects and
deduplicates all raw level-zero entries, without species or move exceptions. The
milestones, wishlist, and comparisons offer them when entering the evolved
species, including delayed evolution. The species page labels them **On evolution**
and keeps their raw value in additional data. A level-1 duplicate is neither a
second evolution move nor proof that the Move Reminder can recover it.

The local Emerald EX 1.0.4 export contains:

| Species | Move | Raw levels | Evolution marker? |
| --- | --- | --- | --- |
| Combusken | Double Kick | 0, 1 | Yes |
| Blaziken | Blaze Kick | 0, 1 | Yes |
| Sceptile | Leaf Blade | 0 | Yes; a level-1 duplicate is not required |
| Fearow | Drill Run | 1, 45 | No |

Fearow's level-1 listing does not demonstrate that it learns Drill Run when
Spearow evolves. Classifying it as an evolution move would require additional
release-specific evidence beyond that listing. Existing evolved Pokémon are not
assumed to recover earlier evolution moves. Ordinary same-level learning at the
point of evolution remains outside the planner's supported routes; this patch
addresses the explicit level-zero marker.

## Enabling reminder alternatives later

Require either release-matched source/configuration or reproducible observations
from the ROM with the hash above. Record the NPC/access/payment requirements and
test current versus future levels, previous-stage-only moves, level-zero moves,
and egg/tutor/TM moves separately. Verify ordinary same-level evolution learning
separately from the reminder menu.

Keep reminder access explicit in the resulting plan, including the form and any
minimum level at which the NPC must be visited. Do not assume that a reminder in
the final evolution can recover a move available only before evolution. Add
regression tests for the verified boundaries before enabling that capability.
