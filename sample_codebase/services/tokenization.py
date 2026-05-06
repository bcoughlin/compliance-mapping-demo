"""Tokenization service. The single sanitizer the mapping agent recognizes
for PAN-class data.

In production this would call the KMS-backed token vault. Here it is a
stub that returns a Token object without ever persisting the raw PAN.
"""

from dataclasses import dataclass
import hashlib
import secrets


@dataclass(frozen=True)
class Token:
    id: str
    last_four: str


def tokenize(pan: str) -> Token:
    """Convert a PAN into a token. PAN is never returned, never logged,
    never persisted past this call.
    """
    if not pan or len(pan) < 12:
        raise ValueError("invalid card number")

    token_id = "tok_" + hashlib.sha256(
        (pan + secrets.token_hex(16)).encode("utf-8")
    ).hexdigest()[:24]

    return Token(id=token_id, last_four=pan[-4:])
