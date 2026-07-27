"""
ReForge — Rate Limiter.

Configures slowapi for rate limiting.
Designed to use in-memory storage by default, but can easily be swapped
to Redis by changing the storage backend here.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Initialize Limiter
# To use Redis in the future:
# from limits.storage import RedisStorage
# limiter = Limiter(key_func=get_remote_address, storage_uri="redis://localhost:6379")
limiter = Limiter(key_func=get_remote_address)
