# Sugerencias para Mejorar MedSim

Como resultado de un análisis de código, se proponen las siguientes mejoras para elevar la calidad técnica y la
seguridad del simulador:

## 1. Seguridad de Secretos

- **Mover el almacenamiento de claves del Frontend al Backend:** Actualmente, las claves se guardan en el `localStorage`
  del navegador. Se sugiere una opción para persistirlas en el servidor (cifradas) o solo cargarlas desde el archivo
  `.env` para evitar que queden expuestas en el cliente.
- **Implementar OAuth2 / JWT:** Si el proyecto se escala a múltiples usuarios, es vital añadir una capa de autenticación
  para que cada médico tenga su propio historial y configuraciones.

## 2. Arquitectura de Código

- **Patrón Repository para el Acceso a Datos:** Aunque `PatientService` ahora tiene caché, se recomienda separar la
  lógica de carga de archivos de la lógica de negocio usando un patrón *Repository*.
- **Inyección de Dependencias (DI):** Considerar el uso de un framework de DI (como `dependency-injector`) para
  gestionar el ciclo de vida de los servicios de forma más declarativa que el actual `ServiceContainer`.
- **Manejo Global de Errores:** Implementar un Middleware de FastAPI para capturar excepciones no controladas y devolver
  respuestas JSON consistentes.

## 3. Infraestructura y Rendimiento

- **Migración a Base de Datos de Producción:** Si el número de encuentros crece, PostgreSQL sería más adecuado que
  SQLite para manejar concurrencia.
- **Worker para Audio:** Actualmente el procesamiento de STT y TTS bloquea el hilo de ejecución asíncrono. Se podría
  usar Celery con Redis para procesar audios pesados en segundo plano.
- **Monitoreo con Prometheus/Grafana:** Añadir métricas para rastrear el tiempo de respuesta de los LLM y la tasa de
  errores de las APIs externas.

## 4. Experiencia de Usuario (UX)

- **Feedback Visual de Carga:** Añadir indicadores de progreso (spinners) mientras se procesa el audio o se genera la
  respuesta del LLM.
- **Modo Offline:** Implementar modelos locales de STT (Whisper.cpp) y TTS (Piper) para que el simulador funcione sin
  depender de APIs de pago en entornos restringidos.
