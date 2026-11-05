"""
MongoDB document helpers.
No SQLAlchemy — pure pymongo with integer auto-increment IDs
(stored in a 'counters' collection for simplicity).
"""
from pymongo import MongoClient
from .database import db

def _next_id(collection_name: str) -> int:
    """Auto-increment counter stored in MongoDB."""
    result = db["counters"].find_one_and_update(
        {"_id": collection_name},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    return result["seq"]


def pipeline_to_dict(doc: dict) -> dict:
    """Normalize a pipeline doc for API response."""
    if doc is None:
        return None
    doc["id"] = doc.get("id") or doc.get("_id")
    doc.pop("_id", None)
    for t in doc.get("tasks", []):
        if isinstance(t.get("depends_on"), str):
            import json
            try:
                t["depends_on"] = json.loads(t["depends_on"])
            except Exception:
                t["depends_on"] = []
    return doc


def runner_to_dict(doc: dict) -> dict:
    if doc is None:
        return None
    doc["id"] = doc.get("id") or doc.get("_id")
    doc.pop("_id", None)
    return doc


def run_to_dict(doc: dict) -> dict:
    if doc is None:
        return None
    doc["id"] = doc.get("id") or doc.get("_id")
    doc.pop("_id", None)
    doc.setdefault("task_executions", [])
    return doc
