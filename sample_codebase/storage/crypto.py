"""Stub envelope encryption. Stands in for KMS-backed encrypt/decrypt.

In production these would call KMS with a per-tenant data key. The
mapping agent recognizes encrypt() and decrypt() as the named
sanitizer/de-sanitizer pair for at-rest controls.
"""

import base64


def encrypt(plaintext: str) -> str:
    if not plaintext:
        return ""
    return "enc::" + base64.b64encode(plaintext.encode("utf-8")).decode("ascii")


def decrypt(ciphertext: str) -> str:
    if not ciphertext or not ciphertext.startswith("enc::"):
        return ""
    return base64.b64decode(ciphertext[5:]).decode("utf-8")
