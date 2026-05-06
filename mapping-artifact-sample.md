# Mapping Agent Artifact Sample — PCI-DSS Req. 3.5.1

*Illustrative end-to-end translation: regulation → theme → tag → detection → evidence.*

---

## 1. The regulation

> **PCI-DSS v4.0 Req. 3.5.1** — Cryptographic keys used for encryption of cardholder data must be protected against disclosure and misuse.

Plain text. Not machine-checkable.

---

## 2. The theme record (Mapping Agent output)

What the Compliance Mapping Agent stores in the Registry, derived from synthesizing PCI-DSS plus related guidance:

```yaml
theme_id: KEY_MANAGEMENT_CARDHOLDER_DATA
theme_version: 2026.1.0
ratified_by: governance_forum
ratified_at: 2026-01-15
regulations:
  - pci_dss_v4_0:
      requirement: "3.5.1"
      sub_requirements: ["3.5.1.1", "3.5.1.2"]
  - soc_2:
      criteria: ["CC6.1", "CC6.6"]
triggers:
  - file_paths:
      - "**/keys/*.py"
      - "**/crypto/*.py"
      - "**/payments/**/encrypt*.py"
  - iac_resources:
      - "aws_kms_key"
      - "aws_kms_alias"
      - "aws_iam_policy"
  - imports:
      - "cryptography.hazmat"
      - "boto3.client('kms')"
required_controls:
  - control_id: KMS_001
    description: "Cardholder-data encryption keys live in KMS, not in code or environment variables"
  - control_id: KMS_002
    description: "Key access is restricted to named IAM roles tied to specific services"
  - control_id: KMS_003
    description: "Key rotation enabled with maximum age of 365 days"
required_evidence:
  - kms_key_policy_json
  - iam_role_grants_log
  - rotation_configuration_snapshot
  - test_coverage_for_key_access_paths
```

---

## 3. The tag definition

When the Mapping Agent detects any trigger, it tags the change:

```yaml
tag: PCI_DSS_KEY_MANAGEMENT
tier_default: HIGH
applicable_themes: [KEY_MANAGEMENT_CARDHOLDER_DATA]
hard_match: true   # always escalates to High regardless of risk score
```

**Hard match** means this tag alone forces tier=High — it does not get summed with other signals.

---

## 4. The detection pattern (Layer 1 deterministic check)

What runs at the gate, against the diff and IaC artifacts:

```python
# pseudocode — what Layer 1 actually executes
def detect_KEY_MANAGEMENT_CARDHOLDER_DATA(change):
    matches = []

    # File-path triggers
    for path in change.modified_files:
        if matches_glob(path, theme.triggers.file_paths):
            matches.append(("file_path", path))

    # IaC resource triggers
    for resource in change.iac_diff.resources_added_or_modified:
        if resource.type in theme.triggers.iac_resources:
            matches.append(("iac_resource", resource))

    # Import triggers (static analysis of code diff)
    for import_stmt in static_analysis.imports_in_diff(change):
        if any(import_stmt.startswith(t) for t in theme.triggers.imports):
            matches.append(("import", import_stmt))

    return matches  # non-empty → tag PCI_DSS_KEY_MANAGEMENT applies
```

---

## 5. What an engineer actually sees

A change that touches `services/payments/crypto/key_rotation.py` and modifies an `aws_kms_key` resource:

```
Compliance preflight (Compliance Intelligence Agent):

  Tag matched:  PCI_DSS_KEY_MANAGEMENT
  Tier:         HIGH (hard match — human approval required)

  Required evidence for this change:
    [✓] KMS key policy JSON committed (terraform/kms/payments_cardholder.tf)
    [✓] IAM role grants log captured (compliance/evidence/iam_grants_2026q1.json)
    [✓] Rotation config snapshot (terraform/kms/rotation_policy.tf)
    [ ] Test coverage for key access paths — MISSING

  Applicable controls:
    KMS_001 — Keys live in KMS, not in code/env (auto-checked: PASS)
    KMS_002 — Access restricted to named IAM roles (auto-checked: PASS)
    KMS_003 — Rotation enabled, max age 365 days (auto-checked: PASS)

  Action required: add test coverage for key access paths before merge.
```

---

## 6. What an auditor sees

For the same change, the per-change compliance record stored in the audit substrate:

```yaml
change_id: payments-svc/PR-4892
change_timestamp: 2026-04-22T14:33:11Z
tags:
  - tag: PCI_DSS_KEY_MANAGEMENT
    triggered_by:
      - file_path: services/payments/crypto/key_rotation.py
      - iac_resource: aws_kms_key.payments_cardholder
    theme_version: 2026.1.0
    registry_record_id: KEY_MANAGEMENT_CARDHOLDER_DATA@2026.1.0
controls_evaluated:
  - KMS_001: PASS (auto, hash sha256:a3f...)
  - KMS_002: PASS (auto, hash sha256:b7c...)
  - KMS_003: PASS (auto, hash sha256:9d2...)
evidence_artifacts:
  - kms_key_policy_json:
      uri: s3://gusto-compliance-evidence/2026/q2/PR-4892/kms_policy.json
      hash: sha256:e4a...
  - iam_role_grants_log:
      uri: s3://gusto-compliance-evidence/2026/q2/PR-4892/iam_grants.json
      hash: sha256:c12...
human_approver: jane.smith@gusto.com (approved 2026-04-22T15:02:48Z)
final_decision: APPROVE
policy_version: compliance_review_agent.policy.mmd@v1.1.0
```

The auditor does not have to reconstruct any of this. The record was generated at the moment of decision and signed against the policy version in effect.

---

## Why this matters

Three transitions that the artifact above demonstrates:

1. **Regulation → machine-checkable theme.** The Mapping Agent's job is making "protect cryptographic keys" into something the SDLC pipeline can actually evaluate.
2. **Theme → per-change action.** Engineers get the tag, the tier, and the required evidence list *at planning time*, not at audit time.
3. **Per-change action → audit-ready record.** The auditor's question (*"show me how you approved this deployment"*) has a single, signed, replayable answer.

This is one theme. The Mapping Agent maintains hundreds of them, each ratified by the governance forum and versioned alongside policy. The same translation pattern applies to every regulatory requirement in scope.
