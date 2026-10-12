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
