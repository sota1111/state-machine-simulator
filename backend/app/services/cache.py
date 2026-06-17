import time
import threading
import os
import logging

logger = logging.getLogger(__name__)

class ParseCache:
    def __init__(self, maxsize=256, ttl=None):
        self.maxsize = maxsize
        self.ttl = ttl or int(os.getenv("PARSE_CACHE_TTL", "600"))
        self._cache = {}  # {key: (value, expires_at)}
        self._lock = threading.Lock()

    def get(self, key):
        with self._lock:
            if key not in self._cache:
                return None
            
            value, expires_at = self._cache[key]
            if time.time() > expires_at:
                del self._cache[key]
                return None
            
            return value

    def set(self, key, value):
        with self._lock:
            # Evict expired or oldest if full
            now = time.time()
            expires_at = now + self.ttl
            
            if key not in self._cache and len(self._cache) >= self.maxsize:
                # First, remove all expired items
                expired_keys = [k for k, v in self._cache.items() if now > v[1]]
                for k in expired_keys:
                    del self._cache[k]
                
                # If still full, remove the oldest item (in Python 3.7+, dicts are ordered)
                if len(self._cache) >= self.maxsize:
                    oldest_key = next(iter(self._cache))
                    del self._cache[oldest_key]
            
            self._cache[key] = (value, expires_at)

    def clear(self):
        with self._lock:
            self._cache.clear()

# Global singleton
parse_cache = ParseCache()
