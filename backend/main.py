from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import pipelines, runners, scheduler

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="CI/CD Pipeline Scheduler Simulator API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(pipelines.router)
app.include_router(runners.router)
app.include_router(scheduler.router)

@app.get("/")
def root():
    return {"message": "Welcome to CI/CD Pipeline Scheduler Simulator API"}
