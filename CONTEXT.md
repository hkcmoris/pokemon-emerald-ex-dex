# Pokémon Emerald EX Dex

Shared vocabulary for the dex and the collection feature under discussion.

## Language

**Species entry**:
A kind of Pokémon or a specific form described by the dex, with its shared base
stats, learnsets, and evolution rules.
_Avoid_: Owned Pokémon

**Owned Pokémon**:
An individual Pokémon in a player's collection, with its own level and currently
known moves. Multiple owned Pokémon can belong to the same species entry.
_Avoid_: Species entry

**Nickname**:
An optional player-chosen name for an owned Pokémon, distinct from its species name.

**Playthrough**:
A named run of the game with its own collection, active party, and recorded history.
_Avoid_: Account, collection

**Collection**:
The player's owned Pokémon within one playthrough, including those in the active
party and those outside it.
_Avoid_: Party

**Party**:
The active subset of a collection, containing up to six owned Pokémon.
_Avoid_: Collection

**Known moves**:
The moves an owned Pokémon currently knows, as recorded by the player. Unrecorded
moves are unknown rather than evidence that the Pokémon does not know them.
_Avoid_: Learnset

**Learnset**:
The species-level list of moves obtainable by a specified learning method.
_Avoid_: Known moves

**Base stats**:
The six species-level stat values shared by Pokémon of the same species entry.
_Avoid_: Battle stats

**Battle stats**:
The six individual stat values of an owned Pokémon, optionally recorded by the player.
_Avoid_: Base stats

**Battle strength score**:
An automatic 0–100 comparison of an owned Pokémon's current strength at its present
level, based on battle stats, known moves, and defensive type matchups. Weaknesses,
resistances, and immunities contribute according to their severity, and the score
is independent of which other Pokémon the player owns.
_Avoid_: Training potential, party fit, damage prediction

**Estimated battle strength score**:
A battle strength score that uses estimated values for one or more unrecorded battle
stats, with those estimates identified separately from recorded observations.
_Avoid_: Measured stats, stat observation

**Incomplete battle strength score**:
A battle strength assessment whose move contribution is unknown because the owned
Pokémon's current moves have not been recorded or their reference data is unavailable.
_Avoid_: Zero strength, empty moveset

**Stat observation**:
Battle stat values recorded by the player for an owned Pokémon at a particular level
and species/form. An observation may contain only some of the six stats.
_Avoid_: Stat estimate

**Stat estimate**:
An explicitly estimated value between recorded stat observations, used to show growth
through levels that the player did not record.
_Avoid_: Stat observation, recorded gain

**Catch-up recap**:
An optional review of moves and evolution opportunities encountered between an owned
Pokémon's previously recorded level and its updated level.

**Evolution comparison**:
A comparison of level-up moves and TM/HM compatibility across evolution stages,
covering full future paths and identifying differences by branch. Tutors and move
reminders are outside this comparison's scope.
_Avoid_: Proof that a move is permanently unobtainable

**Damage simulation**:
A hypothetical matchup between an owned Pokémon and a selected enemy species/form
at a chosen level, kept separate from the saved collection.
_Avoid_: Recorded battle, collection update

**Simulation inputs**:
Temporary battle values and assumptions used for a damage simulation without
changing the owned Pokémon's recorded state or stat observations.
_Avoid_: Stat observation, recorded gain

**Damage range**:
The minimum and maximum HP loss predicted for a move under the simulation's stated
inputs and supported mechanics, also expressible as a percentage of enemy HP.
_Avoid_: Base power, effective power

**Preview move**:
A move examined in a damage simulation without adding it to the owned Pokémon's
recorded known moves.
_Avoid_: Known move, learned move
