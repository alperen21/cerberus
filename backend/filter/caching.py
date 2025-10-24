from __future__ import annotations
from urllib.parse import urlparse

from filter.__base import ControlList 
import json
import os
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple

import idna
import tldextract
from google.cloud import bigquery
import json, os
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import idna, tldextract
from google.auth import default as google_auth_default
from google.cloud import bigquery
from datetime import datetime
from dateutil.relativedelta import relativedelta  # install via `pip install python-dateutil`
import requests


def get_month() -> str:
    """Return the current month in 'YYYY_MM' format."""
    prev_month = datetime.now() - relativedelta(months=1)
    return prev_month.strftime("%Y%m")


class _FileCache:
    def __init__(self, cache_dir: os.PathLike | str):
        self.dir = Path(cache_dir)
        self.dir.mkdir(parents=True, exist_ok=True)
        self._mem: Dict[str, Tuple[List[str], Dict[str, Any]]] = {}

    def _paths(self, month_yyyy_mm: str) -> Tuple[Path, Path]:
        key = f"control_list{month_yyyy_mm}"
        return (self.dir / f"{key}.json", self.dir / f"{key}.meta.json")

    def get(self, month_yyyy_mm: str) -> Optional[Tuple[List[str], Dict[str, Any]]]:
        if month_yyyy_mm in self._mem:
            return self._mem[month_yyyy_mm]
        data_p, meta_p = self._paths(month_yyyy_mm)
        if data_p.exists() and meta_p.exists():
            with data_p.open("r", encoding="utf-8") as f:
                domains = json.load(f)
            with meta_p.open("r", encoding="utf-8") as f:
                meta = json.load(f)
            self._mem[month_yyyy_mm] = (domains, meta)
            return domains, meta
        return None

    def put(self, month_yyyy_mm: str, domains: List[str], meta: Dict[str, Any]) -> None:
        self._mem[month_yyyy_mm] = (domains, meta)
        data_p, meta_p = self._paths(month_yyyy_mm)
        with data_p.open("w", encoding="utf-8") as f:
            json.dump(domains, f, ensure_ascii=False, indent=2)
        with meta_p.open("w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

    def is_expired(self, month_yyyy_mm: str, max_age_days: int = 30) -> bool:
        """Check if cached data is older than max_age_days"""
        if month_yyyy_mm in self._mem:
            # Check in-memory cache
            _, meta = self._mem[month_yyyy_mm]
            cloned_at = datetime.fromisoformat(meta.get("cloned_at", "").replace("Z", "+00:00"))
            return datetime.now(timezone.utc) - cloned_at > timedelta(days=max_age_days)
        
        # Check file cache
        data_p, meta_p = self._paths(month_yyyy_mm)
        if not (data_p.exists() and meta_p.exists()):
            return True
            
        try:
            with meta_p.open("r", encoding="utf-8") as f:
                meta = json.load(f)
            cloned_at = datetime.fromisoformat(meta.get("cloned_at", "").replace("Z", "+00:00"))
            return datetime.now(timezone.utc) - cloned_at > timedelta(days=max_age_days)
        except Exception:
            return True