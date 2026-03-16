import time

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from api import router as api_router

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": time.time()}


@app.get("/")
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


app.include_router(api_router)
