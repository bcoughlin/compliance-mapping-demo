"""Charge processing. Operates on tokens only — PAN never reaches this
module by design. This is the green path the mapping demo highlights.
"""

from dataclasses import dataclass

from sample_codebase.services.tokenization import Token
from sample_codebase.storage import payment_store
from sample_codebase.audit import audit_logger


@dataclass(frozen=True)
class ChargeResult:
    charge_id: str
    status: str


def charge(token: Token, amount_cents: int, customer_id: str) -> ChargeResult:
    charge_id = "ch_" + token.id[4:16]

    payment_store.save_payment(
        charge_id=charge_id,
        token_id=token.id,
        amount_cents=amount_cents,
        customer_id=customer_id,
    )

    audit_logger.log_event(
        "payment.charged",
        {
            "charge_id": charge_id,
            "token_id": token.id,
            "amount_cents": amount_cents,
            "customer_id": customer_id,
            "last_four": token.last_four,
        },
    )

    return ChargeResult(charge_id=charge_id, status="captured")
