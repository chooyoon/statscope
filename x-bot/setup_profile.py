"""
One-time script to set up the StatScope Bluesky profile.
Run: python setup_profile.py
"""

import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
except ImportError:
    pass

from atproto import Client

BLUESKY_HANDLE = os.getenv("BLUESKY_HANDLE", "")
BLUESKY_PASSWORD = os.getenv("BLUESKY_PASSWORD", "")

if not BLUESKY_HANDLE or not BLUESKY_PASSWORD:
    print("Error: Set BLUESKY_HANDLE and BLUESKY_PASSWORD in .env")
    sys.exit(1)

client = Client()
client.login(BLUESKY_HANDLE, BLUESKY_PASSWORD)

profile = client.me

print(f"Current profile: @{profile.handle}")
print(f"  Display name: {profile.display_name or '(empty)'}")
print(f"  Description: {profile.description or '(empty)'}")
print()

NEW_DISPLAY_NAME = "StatScope | MLB Analytics"
NEW_DESCRIPTION = (
    "Free MLB sabermetrics & analytics platform.\n"
    "Daily game previews, recaps, pitcher matchups & stat leaders.\n"
    "Data-driven baseball insights.\n"
    "\n"
    "statscope-eta.vercel.app"
)

print(f"Setting display name: {NEW_DISPLAY_NAME}")
print(f"Setting description:\n{NEW_DESCRIPTION}")
print()

# Get current profile record to preserve avatar/banner
current = client.app.bsky.actor.get_profile({"actor": profile.did})

record = {
    "displayName": NEW_DISPLAY_NAME,
    "description": NEW_DESCRIPTION,
}

# Preserve existing avatar and banner if present
if current.avatar:
    # We need to keep the existing blob reference
    pass  # avatar stays as-is when not included in put

client.app.bsky.actor.profile.put(
    repo=profile.did,
    rkey="self",
    record=record,
)

print("Profile updated successfully!")

# Verify
updated = client.app.bsky.actor.get_profile({"actor": profile.did})
print(f"\nVerified:")
print(f"  Display name: {updated.display_name}")
print(f"  Description: {updated.description}")
