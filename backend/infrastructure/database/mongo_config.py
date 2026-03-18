import os
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from backend.infrastructure.persistence.models import (
    PatientDocument, 
    StudentDocument, 
    EncounterDocument
)

async def init_db():
    # Obtener URL de conexión de variables de entorno
    mongo_url = os.getenv("MONGO_URL", "mongodb://admin:secret@localhost:27017/medsim?authSource=admin")
    
    # Crear cliente asíncrono
    client = AsyncIOMotorClient(mongo_url)
    
    # Inicializar Beanie con los modelos
    await init_beanie(
        database=client.medsim, 
        document_models=[
            PatientDocument,
            StudentDocument,
            EncounterDocument
        ]
    )
    print("Database connected and initialized.")
