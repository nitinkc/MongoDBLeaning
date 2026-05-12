"""
Shared MongoDB connection helper for all notebooks.
Import this at the top of each notebook cell:
    from notebooks.connection import get_db   (if running from project root)
    # or paste the snippet directly into a notebook cell
"""

from pymongo import MongoClient

# ── Connection mode ──────────────────────────────────────────────────────────
# Set USE_ATLAS = True and fill in ATLAS_URI to use MongoDB Atlas (cloud).
# Set USE_ATLAS = False to use the local Docker replica set.

USE_ATLAS = False  # flip to True for Atlas

# Atlas URI  →  replace with your Atlas connection string
ATLAS_URI = "mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority"

# Local Docker replica-set URI (3-node rs0 from docker-compose)
DOCKER_URI = "mongodb://127.0.0.1:27017/mongo_labs?directConnection=true"


def get_client() -> MongoClient:
    uri = ATLAS_URI if USE_ATLAS else DOCKER_URI
    return MongoClient(uri)


def get_db(db_name: str = "mongo_labs"):
    return get_client()[db_name]

