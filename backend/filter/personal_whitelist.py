from collections import deque
from pathlib import Path
import json
import tempfile
import os
from urllib.parse import urlparse

from filter.__base import ControlList


class PersonalWhitelist(ControlList):
    def __init__(self, max_size : int = 30, json_path: str = ".personal_whitelist/list.json"):
        self.max_size = max_size
        self.cache = deque()
        self.lookup = set()  # to quickly check if an item exists

        # Persistence path
        self._path = Path(json_path)
        self._path.parent.mkdir(parents=True, exist_ok=True)

        # Load existing list if present
        self._load()

    def add(self, item):
        """Add item to cache, ensuring uniqueness and bounded size. Persist on update."""
        # If exists: move to end (most recent) and persist
        parsed = urlparse(self.canonicalize_url(item))
        domain = parsed.hostname or ""
        item = self.canonicalize_url(domain)

        if item in self.lookup:
            self.cache.remove(item)
            self.cache.append(item)
            self._save()
            return

        # New item; if full, evict oldest
        if len(self.cache) >= self.max_size:
            oldest = self.cache.popleft()
            self.lookup.remove(oldest)

        self.cache.append(item)
        self.lookup.add(item)
        self._save()

    def get_all(self):
        """Return a list of cached items (oldest first)."""
        return list(self.cache)

    def __contains__(self, item):
        """Check if item is in cache."""
        return item in self.lookup

    def __len__(self):
        return len(self.cache)

    # Optional: remove item and persist (handy if you need it)
    def remove(self, item):
        """Remove an item if present and persist."""
        if item in self.lookup:
            self.cache.remove(item)
            self.lookup.remove(item)
            self._save()

    # Optional: clear all and persist
    def clear(self):
        """Clear the cache and persist."""
        if self.cache or self.lookup:
            self.cache.clear()
            self.lookup.clear()
            self._save()

    def _load(self):
        """Load items from JSON file into deque/set, ignoring corrupt/non-list data."""
        if not self._path.exists():
            return

        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
            if isinstance(data, list):
                # Enforce uniqueness in order from file (oldest first)
                seen = set()
                ordered_unique = []
                for x in data:
                    if x not in seen:
                        seen.add(x)
                        ordered_unique.append(x)

                # Truncate to max_size from the end (keep most recent)
                if len(ordered_unique) > self.max_size:
                    ordered_unique = ordered_unique[-self.max_size:]

                self.cache = deque(ordered_unique)
                self.lookup = set(ordered_unique)
            # else: silently ignore invalid structure
        except Exception:
            # Corrupt JSON—ignore but keep file for manual inspection
            pass

    def _save(self):
        """Atomically write current cache to JSON as a list (oldest first)."""
        data = list(self.cache)

        # Ensure JSON-serializable; raise if not
        try:
            json.dumps(data)
        except TypeError as e:
            raise TypeError(
                f"Items must be JSON-serializable. Failed to serialize: {e}"
            )

        # Atomic write: write to temp, then replace
        tmp_dir = self._path.parent
        with tempfile.NamedTemporaryFile("w", delete=False, dir=tmp_dir, encoding="utf-8") as tmp:
            json.dump(data, tmp, ensure_ascii=False, indent=2)
            tmp.flush()
            os.fsync(tmp.fileno())
            tmp_path = Path(tmp.name)

        tmp_path.replace(self._path)
    
    def check(self, url):
        parsed = urlparse(self.canonicalize_url(url))
        domain = parsed.hostname or ""

        return self.canonicalize_url(domain) in self.get_all()
        