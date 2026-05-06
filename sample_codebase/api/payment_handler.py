"""HTTP entrypoints for the payment service.

Three flows live here, each one a complete end-to-end path used by the
mapping demo:
  - checkout: green path, PAN tokenized before persisting
  - refund:   red path, PAN reaches the audit log unsanitized
  - reporting_export: yellow path, NPI returned with incomplete IAM evidence
"""

from typing import Any

from sample_codebase.services import (
    tokenization,
    payment_processor,
    refund_processor,
    reporting_service,
)
from sample_codebase.notifications import email_sender


def checkout(request: dict[str, Any]) -> dict[str, Any]:
    pan = request["body"]["card_number"]
    customer_email = request["body"]["customer_email"]
    amount_cents = int(request["body"]["amount_cents"])

    token = tokenization.tokenize(pan)
    result = payment_processor.charge(token, amount_cents, request["body"]["customer_id"])

    email_sender.send_receipt(customer_email, amount_cents, token.last_four)

    return {"status": "ok", "token_id": token.id, "charge_id": result.charge_id}


def refund(request: dict[str, Any]) -> dict[str, Any]:
    pan = request["body"]["card_number"]
    amount_cents = int(request["body"]["amount_cents"])

    result = refund_processor.process_refund(pan, amount_cents)

    return {"status": "ok", "refund_id": result.refund_id}


def reporting_export(request: dict[str, Any]) -> dict[str, Any]:
    user_id = request["body"]["user_id"]

    records = reporting_service.get_user_payments(user_id)

    return {"records": records}
