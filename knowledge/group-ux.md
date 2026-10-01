# Group UX lessons

What the first trip taught about a page a whole group uses, seniors included, on phones and on the move.

## Wording

- **Never describe people by family relationship** on the page. Say "the group", "seniors", "adults", or a count.
- **Seniors:** count walking time ×1.4, and suggest a taxi first for long legs.

## Money

- **Every group cost also shows a per-person share**, because the group may split up and each person needs to know
  roughly what they'll spend. Both the destination currency and the home currency, at a rate the reader can edit.
- **Per-vehicle costs don't shrink** with fewer people (a charter, a taxi). Say so where the group might split.

## The plan

- **Fixed times never move.** A re-plan only suggests; it never moves anything by itself, and fixed items anchor the
  day.
- **The next thing is one glance away.** The Now/Next card leads the page.
- **Decisions show their rule**: when to go, when to skip, and the fallback, so the group can decide in the chat.

## A shared plan

Learned designing group sync ([ADR-20261002-sync-planners](../memory-bank/standards/decisions/ADR-20261002-sync-planners.md)):

- **A removal that can't be undone is the main risk.** With one shared plan, one slip on one phone changes everyone's
  page. Offer Undo on the toast, and keep a list of what left the plan, so a stop can come back after the toast is gone.
- **Undo beats a list.** The people most likely to slip are the ones least likely to open a list to fix it, so the
  toast comes first and the list is the fallback.
- **Show who did it.** Mark each added stop with the name of who added it. Ask for the name once, the first time a phone
  opens the page, and again where the person is already acting (the add sheet), never only two taps deep in a menu.
- **Let a person change only what they added.** A planner can change anything. Guard stops only: a pushed-back time or a
  tick is something everyone needs to do.
- **Say what the guard is.** If the page enforces it, it stops mistakes, not someone who has the page.

## Testing it like the group

Walk the group's real journeys yourself before calling a page change done, at 390 px, one-handed, as a senior would:

- what's next;
- getting to the next stop;
- where to eat nearby;
- the rain plan;
- the budget;
- the airport;
- coming back after following a link.

Count taps and long scrolls. Look for dead ends, back-navigation traps, tiny targets and squeezed text. On the first
trip the planner found squeezed meal rows, jumps far down with no way back, and route buttons buried below the
schedule by using the page on a phone. Each one could have been found this way first.
