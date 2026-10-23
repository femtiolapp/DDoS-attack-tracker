import asyncio
from contextlib import asynccontextmanager, suppress
from fastapi import FastAPI
from app.config import Settings
from app.models.database import Database
from app.services.collector import Collector
from app.api.routes import router


def create_app(settings=None):
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app):
        app.state.database = Database(settings.database_url)
        collector = app.state.collector = Collector(settings, app.state.database)
        if settings.polling_enabled:
            collector.task = asyncio.create_task(collector.run())
        try:
            yield
        finally:
            if collector.task:
                collector.task.cancel()
                with suppress(asyncio.CancelledError):
                    await collector.task
            await collector.client.close()
            app.state.database.engine.dispose()

    app = FastAPI(title='Global DDoS Monitor — aggregated Radar statistics', lifespan=lifespan)
    app.include_router(router)
    return app


app = create_app()
