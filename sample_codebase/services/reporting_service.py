"""Reporting service — returns customer payment history, including NPI.

The yellow flow in the mapping demo. Data is encrypted at rest in
payment_store and decrypted on fetch (control present), but this
endpoint does not call any IAM verification before serving — meaning
the evidence trail for "who can read this" is incomplete.
"""

from sample_codebase.storage import payment_store


def get_user_payments(user_id: str) -> list[dict]:
    records = payment_store.fetch_user_payments(user_id)

    enriched = []
    for record in records:
        enriched.append(
            {
                "charge_id": record["charge_id"],
                "amount_cents": record["amount_cents"],
                "ssn": record["ssn"],
                "bank_account_last_four": record["bank_account_last_four"],
                "customer_name": record["customer_name"],
            }
        )
    return enriched
