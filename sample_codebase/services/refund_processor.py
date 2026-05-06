"""Refund processing.

KNOWN ISSUE the mapping demo is designed to surface: this module logs
the raw PAN before tokenization. Mirrors the failure mode documented
in RCA-2026-Q1-014, Appendix A, change pay-svc-4889.

Left as-is intentionally so the agent has something real to catch.
"""

from dataclasses import dataclass

from sample_codebase.services import tokenization
from sample_codebase.storage import payment_store
from sample_codebase.audit import audit_logger


@dataclass(frozen=True)
class RefundResult:
    refund_id: str
    status: str


def process_refund(pan: str, amount_cents: int) -> RefundResult:
    # NOTE: PAN reaches the audit log here without going through tokenize().
    # This is the planted PCI-DSS 3.4 violation the mapping demo exposes.
    audit_logger.log_event(
        "refund.attempt",
        {
            "pan": pan,
            "amount_cents": amount_cents,
        },
    )

    token = tokenization.tokenize(pan)
    refund_id = "rfnd_" + token.id[4:16]

    payment_store.save_refund(
        refund_id=refund_id,
        token_id=token.id,
        amount_cents=amount_cents,
    )

    return RefundResult(refund_id=refund_id, status="processed")
