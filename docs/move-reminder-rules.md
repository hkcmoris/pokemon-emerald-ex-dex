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
| Whether raw level-zero entries are reminder/evolution moves? | No |
| Whether egg, tutor, TM/HM, or previously known moves qualify? | No |
| NPC location, progression requirement, payment, and repeat cost? | No |
| Moves offered immediately after an evolution at the same level? | No |

The planner therefore treats level-zero entries as unverified and requires a
future form to be reached before that form's ordinary level-up move deadline.

## Enabling reminder alternatives later

Require either release-matched source/configuration or reproducible observations
from the ROM with the hash above. Record the NPC/access/payment requirements and
test current versus future levels, previous-stage-only moves, level-zero moves,
and egg/tutor/TM moves separately. Verify same-level evolution learning separately
from the reminder menu.

Keep reminder access explicit in the resulting plan, including the form and any
minimum level at which the NPC must be visited. Do not assume that a reminder in
the final evolution can recover a move available only before evolution. Add
regression tests for the verified boundaries before enabling that capability.
