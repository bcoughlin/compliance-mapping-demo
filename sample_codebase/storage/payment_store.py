"""In-memory payment store stub.

In production this would be Postgres (or DynamoDB) with envelope
encryption via KMS. Here it is a dict that pretends to encrypt at
rest by storing values through encrypt() and decrypt() calls.
"""

from typing import Any

from sample_codebase.storage import crypto

_PAYMENTS: dict[str, dict[str, Any]] = {}
_REFUNDS: dict[str, dict[str, Any]] = {}
_USER_PROFILES: dict[str, dict[str, Any]] = {
    # Pre-seeded test profile so reporting has data to return.
    "user_001": {
        "customer_name": crypto.encrypt("Jane Q. Customer"),
        "ssn": crypto.encrypt("123-45-6789"),
        "bank_account_last_four": crypto.encrypt("4321"),
    }
}


def save_payment(
    charge_id: str,
    token_id: str,
    amount_cents: int,
    customer_id: str,
) -> None:
    _PAYMENTS[charge_id] = {
        "charge_id": charge_id,
        "token_id": token_id,
        "amount_cents": amount_cents,
        "customer_id": customer_id,
    }


def save_refund(refund_id: str, token_id: str, amount_cents: int) -> None:
    _REFUNDS[refund_id] = {
        "refund_id": refund_id,
        "token_id": token_id,
        "amount_cents": amount_cents,
    }


def fetch_user_payments(user_id: str) -> list[dict[str, Any]]:
    profile = _USER_PROFILES.get(user_id, {})
    user_charges = [p for p in _PAYMENTS.values() if p.get("customer_id") == user_id]

    return [
        {
            "charge_id": c["charge_id"],
            "amount_cents": c["amount_cents"],
            "ssn": crypto.decrypt(profile.get("ssn", "")),
            "bank_account_last_four": crypto.decrypt(
                profile.get("bank_account_last_four", "")
            ),
            "customer_name": crypto.decrypt(profile.get("customer_name", "")),
        }
        for c in user_charges
    ]
