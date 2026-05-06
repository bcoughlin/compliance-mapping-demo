"""Outbound email stub. The mapping agent treats outbound network as
a sink and verifies that nothing reaching it is regulated data.
"""


def send_receipt(customer_email: str, amount_cents: int, last_four: str) -> None:
    body = (
        f"Charged ${amount_cents / 100:.2f} to card ending {last_four}. "
        f"Thank you."
    )
    _deliver(customer_email, "Your receipt", body)


def _deliver(to_address: str, subject: str, body: str) -> None:
    # In production this would call SES / Postmark / equivalent.
    pass
