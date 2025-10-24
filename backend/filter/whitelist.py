from __future__ import annotations
from urllib.parse import urlparse

from filter.__base import ControlList 
import json
import os
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import urlparse
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
from filter.caching import _FileCache, get_month

def get_crux_location() -> str:
    """
    Detects your current country in ISO 3166-1 alpha-2 format,
    compatible with CrUX location identifiers.
    Returns e.g. 'US', 'SG', 'GB', etc.
    """
    try:
        res = requests.get("https://ipinfo.io/json", timeout=5)
        res.raise_for_status()
        data = res.json()
        country = data.get("country")
        if not country:
            raise RuntimeError("Country not found in IP info response.")
        return country.upper()
    except Exception as e:
        print(f"[WARN] Could not determine location automatically: {e}")
        # Default fallback — CrUX global dataset is 'US'
        return "US"

def _normalize_month(snapshot_month: str) -> Tuple[str, str]:
    s = snapshot_month.strip()
    if "_" in s:
        yyyy_mm = s
        yyyymm = s.replace("_", "")
    else:
        yyyymm = s
        yyyy_mm = s[:4] + "_" + s[4:]
    return yyyy_mm, yyyymm




CRUX_DATE_COL = "collection_date"  # confirmed current name



class CruxAllowlistBuilder:
    def __init__(
        self,
        *,
        project_id: Optional[str] = None,
        bq_client: Optional[bigquery.Client] = None,
        cache_dir: os.PathLike | str = ".crux_cache",
        location: str = "SG",
    ) -> None:
        self._cache = _FileCache(cache_dir)
        self._client = bq_client
        self._project_id = project_id
        self._location = location

    def get_allowlist(
        self,
        snapshot_month: str,
        *,
        top_n_domains: int = 100_000,
        force_refresh: bool = False,
        max_cache_age_days: int = 30,
    ) -> Tuple[List[str], Dict[str, Any]]:
        month_yyyy_mm, month_yyyymm = _normalize_month(snapshot_month)
        
        # Check if we should refresh the cache
        should_refresh = force_refresh or self._cache.is_expired(month_yyyy_mm, max_cache_age_days)
        
        if not should_refresh:
            cached = self._cache.get(month_yyyy_mm)
            if cached:
                print(f"[INFO] Using cached data for {month_yyyy_mm}")
                return cached
        else:
            if force_refresh:
                print(f"[INFO] Force refresh requested for {month_yyyy_mm}")
            else:
                print(f"[INFO] Cache expired for {month_yyyy_mm}, refreshing data...")

        creds, adc_project = google_auth_default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
        client = bigquery.Client(project=(self._project_id or adc_project), credentials=creds, location="US")


        # Fallback: materialized table, filtered by yyyymm (INT64)
        q_mat = f"""
        SELECT origin, rank
        FROM `chrome-ux-report.materialized.metrics_summary`
        WHERE yyyymm = @yyyymm
        AND rank = 1000
        ORDER BY origin
        LIMIT 1000;
        """
        job = client.query(
        q_mat,
        job_config=bigquery.QueryJobConfig(
            query_parameters=[bigquery.ScalarQueryParameter("yyyymm", "INT64", int(month_yyyymm))]
        ),
        )
        result = list(job.result())


        domains = [elem["origin"] for elem in result]


        meta = {
            "source": "crux",
            "snapshot_month": month_yyyy_mm,
            "cloned_at": datetime.now(timezone.utc).isoformat(),
            "table": "chrome-ux-report.materialized.origin_summary",
            "requested_top_n": top_n_domains,
            "row_count": len(domains),
            "project_used": client.project,
            "location": client.location,
        }

        self._cache.put(month_yyyy_mm, domains, meta)
        return domains, meta

class Whitelist(ControlList):
    def __init__(self):
        self.builder = CruxAllowlistBuilder(cache_dir=".crux_cache", project_id="cerberus-475906", location=get_crux_location())
        top_n = 100_000
        month = get_month()

        print(f"[INFO] Building CrUX allowlist for {month}")
        print(f"[INFO] Cache will expire after 30 days (configurable)")
    
        domains, meta = self.builder.get_allowlist(month, top_n_domains=top_n)

        print(f"[INFO] Retrieved {len(domains)} domains from project {meta['project_used']}")
        print(f"[INFO] Cached in: {self.builder._cache.dir.resolve()}")
        print(json.dumps(meta, indent=2))

        print(f"\n[INFO] Testing cache hit...")
        domains, meta_cached = self.builder.get_allowlist(month)
        print(f"[INFO] Cache hit confirmed ({meta_cached['row_count']} domains).")

        self.__allowed_domains = [self.canonicalize_url(domain) for domain in domains] 
    
    def check(self, url: str) -> bool:
        parsed = urlparse(self.canonicalize_url(url))
        domain = parsed.hostname or ""

        return self.canonicalize_url(domain) in self.__allowed_domains
        
