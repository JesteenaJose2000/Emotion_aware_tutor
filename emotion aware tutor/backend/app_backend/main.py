from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .routes.session_routes import router as session_router
from .routes.question_routes import router as question_router
from .routes.ser_routes import router as ser_router
from .routes.fer_routes import router as fer_router


def create_app() -> FastAPI:
    app = FastAPI(title="Emotion-Aware Adaptive Learning Tutor API", version="0.1.0")

    # CORS for a Next.js frontend (localhost dev and allow credentials). Adjust origins as needed.
    origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://localhost:3000",
        "https://127.0.0.1:3000",
        "*",  # loosen for early development; narrow later
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Initialize database (create tables if they don't exist)
    init_db()

    # Routers
    app.include_router(session_router, prefix="", tags=["session"])  # /start, /session/{id}/stats
    app.include_router(question_router, prefix="", tags=["question"])  # /next, /submit
    app.include_router(ser_router, prefix="", tags=["ser"])  # /ser
    app.include_router(fer_router, prefix="", tags=["fer"])  # /fer

    @app.get("/health")
    def health_check():
        return {"status": "ok"}

    return app


app = create_app()


