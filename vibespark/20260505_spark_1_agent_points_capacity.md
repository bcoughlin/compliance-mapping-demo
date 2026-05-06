# Self-Calibrating Agent Estimation via Points + Observed Capacity

*Date: 2026-05-05*
*Captured during a chat about why Claude's time estimates are always wrong.*

---

## The idea

An agent that estimates work in **relative points** instead of absolute time, and **observes its own throughput** over a window of completed work to derive a velocity. Over time the agent learns its own capacity the same way a SCRUM team does — not by predicting wall-clock hours but by sizing tasks against each other and watching how many points actually clear per unit of focus time.

The estimate becomes a *forecast grounded in the agent's own history*, not a reflexive PM-convention number pulled from training-distribution averages.

---

## What sparked it

Brad asked: "where in your prompt or context are you being compelled to estimate, and how?" Honest answer was *nothing* — it's a learned reflex from software-engineering convention. The estimates are aesthetic, not grounded. They're usually wrong because:

- No calibration to the specific user's speed, stack familiarity, or focus availability
- No feedback loop comparing prior estimates to actual outcomes
- The numbers are produced once and never measured against reality

That gap is exactly what SCRUM points + velocity tracking solves for human teams. Same shape, applied to an agent.

---

## What's already in reach

- **Agent loops already log structured events.** Tool calls, durations, success/failure, completion timestamps are already in the event stream (Loom replay does this; Claude Code's transcripts do this).
- **Comparing tasks is something LLMs do well.** "Is this task bigger than the last one?" is exactly the relative judgment SCRUM points encode. The agent can already produce coherent fibonacci sizings if asked.
- **A simple velocity model is trivial math.** Sum points completed in the last N sessions ÷ wall-clock or focus-time elapsed = points per hour / per session.
- **Per-user calibration is automatic.** Each user's transcript history is the training set for their own capacity profile. No global model needed.

---

## What's missing

- **A points scale.** Needs to be defined once per user/project, anchored in 2–3 reference tasks ("this 1-pointer = renaming a variable across a file; this 5-pointer = adding a new API route with tests"). The agent then sizes everything against those anchors.
- **A persistence layer.** Estimates and outcomes need to live somewhere durable — likely in CLAUDE.md or a sibling file (e.g., `~/.claude/capacity.json`). Each completed task writes back: estimated points, actual time, success/failure.
- **A feedback ritual.** When a task closes, agent self-reports: "I estimated 3 points, it took 90 minutes, my running velocity is now ~2 points/hour for this stack." Eventually drops to a one-line confirmation.
- **Honesty about variance.** Velocity has wide bands. The output should be "3 points, P50 ~2 hours, P90 ~5 hours" not a single number — same way good SCRUM teams report ranges.

---

## Why this is interesting beyond estimation

**It's the same primitive as agent self-monitoring.** An agent that tracks its own throughput is one step from an agent that tracks its own quality, drift, refusal rate, off-policy frequency. Capacity is just the easiest of these to operationalize because outcomes are unambiguous (points done = points done).

**It would change the human-agent contract.** Instead of "Claude says 3 hours" (no provenance, no accountability), the user gets "Claude estimates 3 points; Claude's last 12 sessions on this stack averaged 2.1 points/hour with P90 of 4.8 points/hour." That's a forecast that can be *trusted or contested* on its own terms.

**It generalizes to any repeated agent task.** Code review turnaround. PR triage rate. Compliance evaluation cycle time (callback to the demo we're building — the Mapping Agent's velocity per kloc would be a real ops metric).

---

## Adjacent sparks

- Agent that **declines to estimate** until it has enough history. "I haven't seen enough comparable tasks to size this; can you anchor it against [reference]?"
- Agent that **flags scope creep at threshold**. "This task is now 3x the original size; want to re-budget?"
- A shared "points anchor library" — open-source reference tasks the community calibrates against, so one user's 5-pointer means roughly the same as another's.
- Loom-style replay extended to *velocity replays*: heatmap of which nodes burned the most time per traversal, surfacing where the agent is actually slow.

---

## Open questions

- Does it work cross-stack? A 5-pointer in TypeScript ≠ a 5-pointer in Rust. Probably need per-stack anchors.
- How do you account for tasks the user steered mid-flight? Re-estimation feels right but adds a UX burden.
- Where's the line between "agent self-reports velocity" (helpful) and "agent gets defensive about its estimates" (annoying)?
- Does this become a productivity-surveillance tool in disguise? Important to keep it agent-side, not user-side.
- Is there an existing tool already doing this? Worth a search before building.
