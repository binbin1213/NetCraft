"""Structured logging setup.

Kept intentionally small: one configuration point, request-scoped context via
a filter, and no third-party logging dependency.
"""

import logging
import sys


def configure_logging(level: str = "INFO") -> None:
    """Send application logs to stdout with a consistent format.

    Uses stdout (not stderr) so container log collectors treat them as normal
    output, and avoids duplicate handlers when the app is reloaded.
    """
    root = logging.getLogger()
    root.setLevel(level)

    # uvicorn installs its own handlers; avoid stacking a second one.
    for handler in list(root.handlers):
        if getattr(handler, "_netcraft", False):
            root.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    handler._netcraft = True  # type: ignore[attr-defined]
    handler.setFormatter(
        logging.Formatter(
            fmt="%(asctime)s %(levelname)-8s [%(name)s] %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
        )
    )
    root.addHandler(handler)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
