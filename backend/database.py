from pymongo import MongoClient
from pymongo.database import Database

MONGO_URL = "mongodb://localhost:27017"
DB_NAME   = "cicd_scheduler"

client = MongoClient(MONGO_URL)
db: Database = client[DB_NAME]

# Collections
pipelines_col    = db["pipelines"]
runners_col      = db["runners"]
pipeline_runs_col = db["pipeline_runs"]
users_col        = db["users"]

def get_db():
    """FastAPI dependency — yields the mongo db instance."""
    yield db
