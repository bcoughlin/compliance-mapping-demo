"""Audit log sink.

Every event the platform considers material to financial reporting,
PCI scope, or NPI access is funneled through here. The mapping agent
treats this as a regulated sink — whatever reaches it must already be
a token, an ID, or otherwise rendered unreadable per PCI-DSS 3.4.
"""

import json
import logging
from typing import Any

logger = logging.getLogger("audit")


def log_event(event_name: str, payload: dict[str, Any]) -> None:
    logger.info("%s %s", event_name, json.dumps(payload))
