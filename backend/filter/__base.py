from abc import ABC, abstractmethod
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
import idna

class ControlList(ABC):
    @abstractmethod
    def check(self, url: str) -> bool:
        """
        Determine whether a given URL is present in the list.

        Args:
            url (str): The URL to check.

        Returns:
            bool: True if the URL exists in the list, False otherwise.

        Raises:
            NotImplementedError: Must be implemented by subclasses.
        """
        pass

    def canonicalize_url(self, url: str) -> str:
        """Normalize URL for consistent allowlist checks.

        - Ensures scheme (defaults to https)
        - Lowercases scheme/host
        - Converts Unicode host to punycode
        - Removes default ports (80/443)
        - Adds 'www.' prefix if the host is bare (e.g. example.com → www.example.com)
        - Sorts query parameters
        """
        if not url:
            return ""

        url = url.strip()
        # Ensure scheme
        if not urlparse(url).scheme:
            url = "https://" + url

        parsed = urlparse(url)

        scheme = parsed.scheme.lower()
        host = (parsed.hostname or "").lower()
        try:
            host = idna.encode(host).decode("ascii")
        except Exception:
            pass

        # Add www. if host is bare (has exactly one dot and no subdomain)
        if host and host.count(".") == 1 and not host.startswith("www."):
            host = "www." + host

        port = parsed.port
        if (scheme == "http" and port == 80) or (scheme == "https" and port == 443):
            port = None

        path = parsed.path or "/"
        query_items = sorted(parse_qsl(parsed.query, keep_blank_values=True))
        query = urlencode(query_items)

        netloc = host if port is None else f"{host}:{port}"
        return urlunparse((scheme, netloc, path, "", query, ""))