import logging
import asyncio
import socket
from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

logger = logging.getLogger(__name__)

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_instance = Database()

async def connect_to_mongo():
    """
    Establece la conexión con MongoDB con mecanismo de reintento.
    Usa resolución por nombre de host para estabilidad en Podman.
    """
    max_retries = 20
    retry_delay = 3
    
    # Esperar a que el stack de red se asiente
    await asyncio.sleep(3)
    
    for attempt in range(1, max_retries + 1):
        try:
            # Diagnóstico de red básico
            host = settings.MONGO_URL.split("@")[-1].split(":")[0] if "@" in settings.MONGO_URL else "127.0.0.1"
            logger.info(f"Probando resolución de red para {host}...")
            
            # Intentar abrir un socket para verificar que el puerto responde
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(2)
            result = sock.connect_ex((host, 27017))
            sock.close()
            
            if result != 0:
                logger.warning(f"⚠️ El puerto 27017 en {host} no responde (code {result}).")
            else:
                logger.info(f"✅ Puerto 27017 en {host} abierto.")

            # Limpiamos la URL para el log (sin contraseña)
            safe_url = settings.MONGO_URL.split("@")[-1] if "@" in settings.MONGO_URL else settings.MONGO_URL
            logger.info(f"Conectando a MongoDB en {safe_url} (Intento {attempt}/{max_retries})...")
            
            client = AsyncIOMotorClient(
                settings.MONGO_URL,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000
            )
            
            # Forzar ping de admin para validar autenticación y estado real
            await client.admin.command('ping')
            
            db_instance.client = client
            db_instance.db = client[settings.MONGO_DB_NAME]
            logger.info("✅ Conexión exitosa a MongoDB")
            return
        except Exception as e:
            logger.warning(f"⚠️ Intento {attempt} fallido: {e}. Reintentando en {retry_delay}s...")
            if attempt == max_retries:
                logger.error("❌ Se agotaron los reintentos de conexión a MongoDB.")
                raise
            await asyncio.sleep(retry_delay)

async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()
    logger.info("Conexión a MongoDB cerrada.")

def get_database():
    return db_instance.db
