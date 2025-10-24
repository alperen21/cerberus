from datetime import datetime, timezone
from filter.__base import ControlList
import json
from typing import List, Optional
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import os
from filter.caching import _FileCache, get_month



class Blacklist(ControlList):
    def __init__(self, force_refresh : bool = False):
        self.dest_dir = ".openphish_cache"
        self._cache = _FileCache(self.dest_dir)
        self.force_refresh = force_refresh
        self.blacklist = self.fetch_openphish_newest_json()



    def fetch_openphish_newest_json(
        self,
        n: int = 1000,
        timeout: int = 30,
        feed_url: str = "https://openphish.com/feed.txt",
        session: Optional[requests.Session] = None,
        max_cache_age_days: int = 30,

    ) -> List[str]:
        """
        Fetch newest N OpenPhish entries and export to JSON inside directory `dest_json`.
        If dest_json is None, a directory named ".openphish_cache" will be created in cwd.
        The JSON filename is: <dest_json>/blacklist.json

        Returns a list of URLs.
        """
        month_yyyy_mm = get_month()
        should_refresh = self.force_refresh or self._cache.is_expired(month_yyyy_mm, max_cache_age_days)

        if not should_refresh:
            cached, _ = self._cache.get(month_yyyy_mm)
            return cached
        # Create a session with retry logic
        if session is None:
            session = requests.Session()
            retries = Retry(
                total=5,
                backoff_factor=1,
                status_forcelist=(429, 500, 502, 503, 504),
                allowed_methods=frozenset(["GET"]),
            )
            session.mount("https://", HTTPAdapter(max_retries=retries))

        print(f"[INFO] Fetching OpenPhish feed from {feed_url}")
        try:
            resp = session.get(feed_url, timeout=timeout, headers={"User-Agent": "openphish-clone-script/1.0"})
            resp.raise_for_status()
        except Exception as e:
            print(f"[ERROR] Failed to download feed: {e}")
            raise

        lines = [line.strip() for line in resp.text.splitlines() if line.strip()]
        print(f"[INFO] Fetched {len(lines)} URLs from feed")

        selected = lines[:n]
        urls: List[str] = []

        for idx, raw_url in enumerate(selected, 1):
            try:
                canon = self.canonicalize_url(raw_url)
                if canon:
                    urls.append(canon)
                    print(f"[{idx:04d}] {canon}")
            except Exception as e:
                print(f"[WARN] Error canonicalizing URL {raw_url!r}: {e}")

        # determine destination directory

        try:
            os.makedirs(self.dest_dir, exist_ok=True)
            print(f"[INFO] Ensured directory exists: {self.dest_dir}")
        except Exception as e:
            print(f"[ERROR] Failed to create directory {self.dest_dir}: {e}")
            raise

        out_path = os.path.join(self.dest_dir, "blacklist.json")
        try:
            print(f"[INFO] Writing {len(urls)} URLs to {out_path}")
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(urls, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[ERROR] Failed to write JSON to {out_path}: {e}")
            raise

        meta = {
            "source": "crux",
            "snapshot_month": month_yyyy_mm,
            "cloned_at": datetime.now(timezone.utc).isoformat(),
            "table": "chrome-ux-report.materialized.origin_summary",
            "requested_top_n": n,
            "row_count": len(urls),
        }

        print(f"[INFO] Done. {len(urls)} URLs saved to {out_path}")
        urls = [self.canonicalize_url(url) for url in urls]
        self._cache.put(month_yyyy_mm, urls, meta)
        return urls

    def check(self, url):
        return self.canonicalize_url(url) in self.blacklist