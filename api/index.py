"""Vercel Python Function entrypoint: serves the FastAPI backend under /api/*."""

import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for path in (os.path.join(ROOT, "backend"), os.path.join(ROOT, "backend", "engine"), ROOT):
    if path not in sys.path:
        sys.path.insert(0, path)

from app.main import app  # noqa: E402,F401
