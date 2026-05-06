# Exercise 3 — Govern the System: Metrics, Risk, and Decisions Under Pressure

*by Brad Coughlin — bradjcoughlin@gmail.com — 402-477-4105*

---

## Scenario Framing

Before reviewing the 90-day metrics: I imagine a scenario where the targets shown were ratified by this committee at program launch and anchored to published baselines for traditional human compliance review, plus any metrics Gusto already maintains internally. The committee chose to set them meaningfully above those baselines as stretch goals. The original exercise table named only SOX-specific tagging accuracy; I am assuming an extended dashboard that tracks the program's other in-scope regimes (PCI-DSS, GLBA, SOC 2 CC-family, EU AI Act) alongside SOX, since a single-regulation view would not give this committee adequate coverage of the agentic program's regulatory surface.

| Metric | Industry baseline (traditional human review) | Target | 90-day result |
|---|---|---|---|
| Autonomous deployment rate | < 10% | 85% | 71% |
| Compliance artifact accuracy | n/a (not previously measured systematically) | 92% | 84% |
| False Low rate (High-risk auto-approved) | 8–15% miss rate on regulated scope | 0 | 14 events (rate unknown — denominator pending) |
| Unnecessary escalation rate | n/a (most reviews escalated by default) | < 5% | ~12% (31 events, ~9 engineer-hours) |
| Regulatory tagging accuracy | 70–85% (sampled, by regime) | 95% per regime | SOX 91%, PCI-DSS 88%, GLBA 86%, SOC 2 CC-family 89%, EU AI Act 84% |
| Regulatory false positive rate | 30–50% (over-tagging is the dominant pattern) | < 5% | 11% |
| Time-to-detection for misclassified changes | 60–120 days (next audit cycle) | < 5 business days | 3 business days |

*Baselines are directional estimates derived from PCAOB inspection report patterns (60–120 day audit cycles, ITGC material-weakness rates), audit-firm methodology guidance on sampled-control testing accuracy (SOX tagging accuracy in the 70–85% range), and security-operations research on alert false-positive and reviewer-fatigue rates (regulatory false-positive over-tagging in the 30–50% range). Firm citations would accompany the version of this dashboard published with committee materials.*

The submission below has three parts. Part A is the executive summary, written as the email body I would send to the Risk Committee chair, with the Part B post-mortem and a formal RCA document as attachments. Part C is presented separately as an isolated Slack exchange three days after the committee meeting.

For one of the three failure modes, I have included a realistic RCA artifact (separate document) that captures the low-altitude technical detail the Compl. Review Agent would produce in concert with the SDLC agents — the kind of evidence record an Internal Auditor or external regulator would actually request.

---

## Part A — Risk Committee Memo

**To:** Risk Committee Chair (cc: Risk Committee distribution)
**From:** Brad Coughlin, ERM/TPRM Lead
**Subject:** [No action required] 90-Day Program Review and Post-Mortem — 14 False Low Classifications

**No action required** from the committee at this time; sharing for awareness and oversight ahead of next month's regular review. When the committee designated the first 90 days as a learning and calibration window, the recognition was that agentic programs require close observation and rigorous evaluation before they can be expected to perform at target. The 14 underclassifications surfaced over those 90 days — including two that touched the payment authorization flow — are the focus of the attached post-mortem. None resulted in data exposure, customer harm, regulatory notification, or audit finding; we have remediated three in production and the remaining eleven are in active manual review. All 14 were detected within three business days of deployment, against a traditional review-cycle baseline of 60–120 days. The program's accelerated detection is a direct result of the structured, audit-ready evidence the agents produce alongside every change — eliminating the manual reconstruction effort that historically delayed identification. Remediations are underway in the Compl. Mapping Agent's coverage and the Compl. Review Agent's blind-review enforcement. We anticipated gaps in the calibration window and built the program's monitoring to surface them quickly; these 14 events are evidence the monitoring is working as intended, and we will continue with elevated attention as the program matures.

The post-mortem walks through the three distinct failure modes and the remediation specifics, and a formal Root Cause Analysis is attached for committee members who want the full technical record. I will return at the next meeting with updated data on the remediations.

---

## Part B — Post-Mortem (Attached to the Memo)

**Subject:** Post-Mortem — 14 False Low Classifications, 90-Day Review
**Author:** Brad Coughlin, ERM/TPRM Lead
**Status:** Closed-loop review; remediations in progress
**Audience:** Risk Committee — Compliance, Legal, Risk, Engineering, and Internal Audit representation

### Post-Mortem Context

The broader 90-day picture is positive: the program produced valuable learnings and key metrics are trending toward target, with some stretch goals in sight. Engineering is shipping with compliance context built in at the planning stage rather than bolted on at audit.

The 14 false Low classifications are the most consequential failure in the 90-day data and the focus of this post-mortem. The program operates inside a calibration window the committee ratified at launch — designated for learning and iteration, not target attainment. All 14 events were detected within three business days of deployment, well inside the 60–120 day detection cycle traditional human review historically delivered, and none resulted in data exposure, regulatory notification obligation, or external audit finding. Internally, the events are control failures — surfaced by the program itself within three business days — but they did not become regulatory incidents. Remediated three of the changes in production; the remaining eleven are in active manual review.

### Failure Mode 1 — Six events: a system was outside the program's coverage

**What happened.** Six events involved changes to data storage systems the program did not have on its map. At launch, our system inventory missed one repository; the systems served by that repository were therefore invisible to the compliance program when changes against them came through the pipeline. The program's policy at the time treated lookups returning "not on the map" as out-of-regulated-scope, and the classifications proceeded as Low.

**How we confirmed.** Cross-referenced the change identifiers against the program's coverage map at the time each change was processed. All six fell under the same missing repository. Coverage gap reports confirmed the omission was present at launch and was not a regression.

**Remediation.** Inventoried the repository and added it to the coverage map. Updated the program's policy so that "not on the map" is now treated as an escalation trigger, never as out-of-scope. Extended the Compl. Intelligence Agent's planning-stage protocol: if a proposed change touches a data store the agent cannot resolve against the coverage map, it must push back on the Builder Agent and escalate, rather than allow the change to proceed. This closes the class of problem at planning time, not just the specific repository gap that caused these six events.

**Owner / timeline.** ERM/TPRM Lead with Engineering; deployed by next committee review.

### Failure Mode 2 — Three events: an ambiguous answer was treated as a confident one

**What happened.** Three events involved changes to files whose names closely resembled other files already on the map. The lookup returned a record for the similar-named file rather than flagging the match as uncertain — for example, a change to a payment-handling file was matched against a low-risk utility with a near-identical name. The Compl. Review Agent had no signal the response was uncertain and accepted the lower tier.

**How we confirmed.** Replayed the program's lookup events for the three changes. In each case, the registry returned a single closest-match record without surfacing that other plausible matches existed and disagreed on tier.

**Remediation.** Two changes. The registry now returns all close matches when a lookup is ambiguous, surfacing the ambiguity to the agent rather than resolving it silently. When close matches disagree on tier, the program's policy is now to BLOCK and escalate rather than pick the lowest-risk interpretation.

**Owner / timeline.** ERM/TPRM Lead; deployed within two weeks.

### Failure Mode 3 — Five events: a code change introduced new regulatory scope into a previously-low-risk file

**What happened.** Five events involved code changes that introduced new PCI-relevant scope (specifically, NPI handling) into files previously classified Low-risk. Neither the earlier code review stage nor the compliance agent recognized the regulatory implication; both anchored on the file's prior classification rather than examining the change end-to-end on its own merits. This is the most concerning of the three modes — the regulatory implication was visible in the change itself.

**How we confirmed.** Reviewed all five diffs directly; all five introduced new NPI handling. Replayed the compliance agent's analysis on each. An audit of the agent's prompt against the program's blind-review specification surfaced a leak: upstream verdict information was reaching the agent in a form the specification said it should not.

**Remediation.** Two changes. Removed the leaking input; the agent now sees only individual upstream findings, not aggregated verdicts. Added a check that flags any change introducing a regulatory category not previously associated with the touched files, catching this pattern at an earlier stage where the agent's reasoning is not yet involved.

**Owner / timeline.** ERM/TPRM Lead with Compliance and Engineering. First remediation deployed; second will deploy within three weeks.

### Learnings summary

Takeaways from this 90-day window worth surfacing for the committee's consideration as the program exits its calibration phase:

**AI/LLM-specific:**

1. **Prompt boundary conditions need explicit handling.** Mode 1 was a coverage-map gap, but the agent's underlying failure was that the policy did not specify what to do with an "unknown" lookup result — it defaulted to the safest-looking interpretation (Low-risk) rather than escalating. Consider treating "cannot resolve" as a permanent hard stop at planning time in the Compl. Intelligence Agent.

2. **Specification and prompt-version drift is a real risk.** Mode 3 surfaced a gap between the blind-review specification and its implementation: the orchestration layer aggregated upstream verdicts into the agent's input, and Layer 2's reasoning anchored on that aggregation. Evaluate whether specification review at deployment should explicitly enumerate derived signals and verify each against intent as a standing requirement.

**General:**

1. **Coverage maps may need active maintenance treated as a first-class control.** The program's most consequential miss came from a system the program could not see. Consider treating coverage gaps as incidents rather than passive omissions.

2. **Sampling is necessary but may not be sufficient for high-impact patterns.** Detection at three business days is better than the 60–120 day baseline, but for the change patterns that matter most, continuous catches at change time are a higher bar. Discuss whether the program should invest in expanding deterministic checks at Layer 1 for additional high-impact patterns beyond the three modes addressed here.

I will bring concrete proposals on each of these to the committee at the next review.

### What the committee can expect at the next review

All three sets of remediations deployed and instrumented, with updated false-Low rate, updated autonomous-deployment rate (the Mode 3 fix tightens the gate, which will move the autonomous-deployment number), and a revised projection for time-to-target. The accompanying RCA captures the full technical record.

---

## Part C — Response to the VP of Engineering

*Reading the message as a private DM from a cross-functional stakeholder and fellow Risk Committee member under velocity pressure, presumably tied to an OKR for that function.*

> Totally understand the concern. 18% is significant, and deployment velocity is on our shared OKR list — though I'd argue we should break that number out to make the tradeoffs visible: time spent on proactive detection (planning-stage scope, preflight) versus passive remediation (gate friction, escalation cycles, rework after misclassification). Right now those costs are aggregated into one velocity figure. Splitting them would let us optimize the right thing. As you know, the high-risk items are top priority — last quarter alone we caught 14 underclassifications, two of which touched payment authorization. So I have a few ideas of how to alleviate friction without compromising on the human escalation (when absolutely necessary).
>
> 1) **Push detection earlier:**
> Most of the friction is changes arriving at the gate as unscoped. The Compliance agent needs to get better at flagging high-risk changes at the planning/build stage. Compliant agentic coding is the end-goal. That's the long-tail optimization, but the near term fixes should have major impact (cutting 18% to 5-10%).
>
> 2) **Cut the over-escalation:**
> The Compliance agent is also escalating ~31 Low/Medium changes that shouldn't have been. If we can improve the accuracy of low-risk detection we estimate a 9-10 hour saving per developer.
>
> With the optimizations on both ends of the process, I think we can reduce that 18% significantly. I want to surface this at the next steerco meeting to prioritize this as our next improvement area. Before that — can you share the velocity target and pre-program baseline you're benchmarking 18% against? Helps me bring the right asks.
