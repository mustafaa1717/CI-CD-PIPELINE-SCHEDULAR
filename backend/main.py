from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import pipelines, runners, scheduler, auth, admin

app = FastAPI(title="CI/CD Pipeline Scheduler Simulator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(pipelines.router)
app.include_router(runners.router)
app.include_router(scheduler.router)
app.include_router(admin.router)


@app.get("/")
def root():
    return {"message": "CI/CD Pipeline Scheduler API — MongoDB backend"}
