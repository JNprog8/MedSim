from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_instance = Database()

async def connect_to_mongo():
    db_instance.client = AsyncIOMotorClient(settings.MONGO_URL)
    db_instance.db = db_instance.client[settings.MONGO_DB_NAME]
    print(f"Conectado a MongoDB: {settings.MONGO_URL}")

async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()
    print("Conexión a MongoDB cerrada.")

def get_database():
    return db_instance.db
