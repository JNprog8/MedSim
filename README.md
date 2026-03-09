# Documentación Técnica de Arquitectura: Proyecto MedSim


Este documento presenta el análisis detallado y los hallazgos de ingeniería inversa para los módulos principales del proyecto **MedSim** (`medsim-llm` y `stt-tts-api`). La documentación está estructurada considerando su lógica de negocio, arquitectura y deudas técnicas identificadas.


---


## 📁 Directorio: `[MedSim/stt-tts-api/]`


### 1. Resumen de Alto Nivel
* **Propósito:** Esta carpeta funciona como el motor principal de interfaces de voz e inteligencia artificial en tiempo real. Su propósito es orquestar un pipeline conversacional de extremo a extremo, exponiendo modelos de transcripción (Whisper), síntesis de voz (XTTS) y generación de expresiones faciales o "blendshapes" (NeuroSync) a través de un servidor FastAPI. Adicionalmente expone una pequeña inferfaz gráfica y funciona como orquestador conectándose a un LLM externo para simular el paciente.
* **Contexto BackEnd:** Es puramente un servidor backend que expone APIs REST y web sockets/endpoints multimedia. Existe redundancia arquitectónica detectada ya que la aplicación actúa simultáneamente como motor subyacente de inferencia de modelos IA (endpoints `/v1/...`) y como un proxy o backend for frontend (endpoints `/api/...` referenciados en los routers).


### 2. Archivos Principales y Lógica
* **[main.py](file:///home/joaco/Documentos/MedSim/stt-tts-api/main.py)**:
 * **Responsabilidad:** Inicializa y configura el servidor FastAPI, y maneja la carga en memoria de los modelos pesados de IA (Whisper, XTTS, NeuroSync). Exponiendo endpoints directos para su consumo.
 * **Funciones/Clases Críticas:**
   * [get_whisper_model_faster()](file:///home/joaco/Documentos/MedSim/stt-tts-api/main.py#66-79) / [get_tts_model()](file:///home/joaco/Documentos/MedSim/stt-tts-api/main.py#100-130): Manejan la instanciación de los modelos acelerados por hardware en GPU/CPU con políticas de caché temporal.
   * `@app.post('/v1/audio/transcriptions')`: Recibe audio crudo y retorna secuencias transcritas mediante Whisper con precisión de timestamps.
   * `@app.post("/v1/audio_to_blendshapes")`: Transforma buffers de audio en información kinésica (blendshapes) vía NeuroSync para animar avatares 3D.
* **[Dockerfile](file:///home/joaco/Documentos/MedSim/stt-tts-api/Dockerfile) y [docker-compose.yml](file:///home/joaco/Documentos/MedSim/stt-tts-api/docker-compose.yml)**:
 * **Responsabilidad:** Encapsulamiento del servidor y dependencias con soporte para NVIDIA GPUs, asegurando que los modelos residan en volúmenes persistentes (`models_cache`).
* **[setup.sh](file:///home/joaco/Documentos/MedSim/stt-tts-api/setup.sh)**:
 * **Responsabilidad:** Automatización de la instalación local, preparación del entorno virtual (venv) y descarga condicionada de modelos para desarrollo.


### 3. Flujo de Datos e Integración
* **Entradas (Inputs):** Recibe archivos binarios de audio (`.wav`) cargados usualmente desde un cliente frontal o micrófono en los endpoints de STT. Recibe texto crudo (`str`) y audios de referencia de hablantes en endpoints de TTS.
* **Salidas (Outputs):** JSON con transcripciones literales. Flujos binarios de audios sintetizados (`audio/wav`) y matrices de secuencias JSON para expresiones faciales (Blendshapes).
* **Dependencias Externas:**
 * Modelos de HuggingFace (OpenAI Whisper, XTTS-v2, NeuroSync).
 * Aceleración CUDA subyacente y Flash Attention.


### 4. Hallazgos de Código Heredado (Legacy Quirks)
* **Deuda Técnica:**
 * El modelo de concurrencia actual de [main.py](file:///home/joaco/Documentos/MedSim/stt-tts-api/main.py) carga modelos pesados globalmente y procesa las peticiones de STT/TTS de forma bloqueante o semi-sincrónicamente, lo que podría agotar la memoria VRAM de la GPU ante múltiples requests concurrentes (falta un administrador/pooler de inferencia robusto o colas estilo Celery/Redis).
* **Riesgos Potenciales:**
 * Inyección y falta de sanitización: Los endpoints de subida de archivos como transcripción asumen ciegamente que el formato es compatible y extraen el buffer a disco (`/tmp/[filename]`) sin validación de seguridad de extensión, abriendo puertas a ataques de escritura o saturación de disco.




---


## 📁 Directorio: `[MedSim/stt-tts-api/routers/]`


### 1. Resumen de Alto Nivel
* **Propósito:** Actúa como una capa de abstracción o "Backend for Frontend" (BFF) dirigida específicamente a la interfaz gráfica local del proyecto. Se encarga de formatear la comunicación con LLMs provistos por OpenAI (o localmente vía Ollama) y de enrutar llamadas hacia los endpoints locales subyacentes definidos en [main.py](file:///home/joaco/Documentos/MedSim/stt-tts-api/main.py).
* **Contexto BackEnd:** Capa de enrutamiento y proxy reverso. Separa la lógica de comunicación con los servicios del LLM de la lógica pura de procesamiento de audio profundo.


### 2. Archivos Principales y Lógica
* **[audio_router.py](file:///home/joaco/Documentos/MedSim/stt-tts-api/routers/audio_router.py)**:
 * **Responsabilidad:** Integra la conexión asincrónica con el LLM (sea OpenAI u Ollama), mantiene la memoria conversacional temporal mediante un diccionario en RAM y redirige peticiones de audio al modelo core.
 * **Funciones/Clases Críticas:**
   * [chat_completion()](file:///home/joaco/Documentos/MedSim/stt-tts-api/routers/audio_router.py#123-189): Intercepta mensajes del usuario, inyecta un System Prompt riguroso (`PATIENT_SIM_SYSTEM_PROMPT`) definiendo el rol de un paciente con variables (Ansiedad, Confusión, Nivel de Lenguaje) y consulta a `llama3.2:1b` (vía un entorno Docker de Ollama en `host.docker.internal`).
   * [transcribe_audio()](file:///home/joaco/Documentos/MedSim/stt-tts-api/routers/audio_router.py#69-98) / [text_to_speech()](file:///home/joaco/Documentos/MedSim/stt-tts-api/routers/audio_router.py#190-223): Actúan como un proxy que re-envía llamadas HTTP internamente a `BACKEND_URL` (`localhost:8080/v1/...`).


### 3. Flujo de Datos e Integración
* **Entradas (Inputs):** Peticiones POST desde el frontend o la interfaz simplificada, incluyendo texto de chat o audios de micrófono.
* **Salidas (Outputs):** JSONs de las respuestas del "paciente virtual" generadas por el modelo, tiempos de respuesta (latencias), y proxying de archivos `.wav`.
* **Dependencias Externas:** API de OpenAI/Ollama (comunicación asincrónica a través de `aiohttp` y `openai.AsyncOpenAI`).


### 4. Hallazgos de Código Heredado (Legacy Quirks)
* **Deuda Técnica:**
 * Almacenamiento de estado in-memory: El historial de chat (`chat_histories`) se guarda en un diccionario global en RAM utilizando un hash estático del host remoto (`session_id = str(hash(request.client.host))`). Esto fallará estrepitosamente en entornos multiproceso (ej. múltiples workers de Uvicorn/FastAPI) o tras reinicios, provocando pérdida de contexto. Debería migrarse a Redis o una base de datos.
 * Inicialización espuria de credenciales: La API key de OpenAI se mockea en duro con `= "none"` para priorizar el uso local de Ollama.
* **Riesgos Potenciales:** Cuello de botella temporal si el contenedor Ollama no responde, lo que bloquearía el router temporalmente. Fugas de memoria eventuales por no limpiar keys viejas en el diccionario `chat_histories`.




---


## 📁 Directorio: `[MedSim/medsim-llm/]`


### 1. Resumen de Alto Nivel
* **Propósito:** Esta carpeta alberga el entorno de investigación y entrenamiento iterativo (Fine-Tuning) diseñado para especializar modelos de lenguaje ligeros (SLMs, como Llama-3.2-1B) en el rol de "pacientes médicos". Su finalidad es afinar los pesos de los modelos para que actúen en interacciones médico-paciente en base a perfiles demográficos.
* **Contexto BackEnd:** Lógica de scripts para entrenamiento y experimentación de Machine Learning e Inteligencia artificial (MLOps). No es un servicio expuesto a la red activamente, sino herramientas de línea de comandos para producción de artefactos `.pth`/modelos.


### 2. Archivos Principales y Lógica
* **[config-Llama-3-1B.yaml](file:///home/joaco/Documentos/MedSim/medsim-llm/config-Llama-3-1B.yaml) / `config-bitnet-...yaml`**:
 * **Responsabilidad:** Ficheros de estado de hyper-parámetros donde se definen configuraciones de entrenamiento tales como ratios de aprendizaje (learning rates), tamaño de LORA y rutas físicas de almacenamiento.
* **[README.md](file:///home/joaco/Documentos/MedSim/medsim-llm/README.md)**:
 * **Responsabilidad:** Documentación descriptiva del pipeline de ejecución local de fine-tuning y comandos para previsualizar el modelo con vLLM.


### 3. Flujo de Datos e Integración
* **Entradas (Inputs):** Modelos pre-entrenados base descargados desde HuggingFace y datasets locales en `data/raw/` (JSONL).
* **Salidas (Outputs):** Pesos adaptados ([models/](file:///home/joaco/Documentos/MedSim/stt-tts-api/routers/audio_router.py#99-107)), configuraciones de plantillas ([template.jinja](file:///home/joaco/Documentos/MedSim/medsim-llm/src/template.jinja)) y ficheros fusionados de PEFT (Parameter-Efficient Fine-Tuning).
* **Dependencias Externas:** Require hardware GPU intensivo. Descansa fuertemente sobre el ecosistema HuggingFace (`transformers`, `peft`, `trl`).


### 4. Hallazgos de Código Heredado (Legacy Quirks)
* **Deuda Técnica:** Multiplicidad de ficheros de configuración (`config-*.yaml`) hardcodeados en vez de contar con un sistema paramétrico de CLI fluido vía Hydra o OmegaConf.
* **Riesgos Potenciales:** Fuerte anclaje a las versiones absolutas de las librerías CUDA. Podría romper el entrenamiento si se actualiza el runtime de PyTorch erróneamente.




---


## 📁 Directorio: `[MedSim/medsim-llm/src/]`


### 1. Resumen de Alto Nivel
* **Propósito:** Es el núcleo algorítmico del pipeline de IA que materializa la generación sintética de datos (Data prep), el entrenamiento iterativo vía PEFT/LoRA, y la validación y "mergeo" lógico del modelo resultante del paciente.
* **Contexto BackEnd:** Scripts operacionales internos. Manejo intenso de operaciones matriciales (Tensors), transformaciones estructuradas estáticas y gestión de disco.


### 2. Archivos Principales y Lógica
* **[train.py](file:///home/joaco/Documentos/MedSim/medsim-llm/src/train.py)**:
 * **Responsabilidad:** Actúa como entry point primario para afinar el modelo de lenguaje. Estructura el loop de entrenamiento.
 * **Funciones/Clases Críticas:**
   * [create_patient_dataset()](file:///home/joaco/Documentos/MedSim/medsim-llm/src/train.py#122-284): Transforma pares de diálogo (médico-paciente) e inyecta context tags especiales (`<|script|>`, `<|doctor|>`, `<|patient|>`) que el LLM usará espacialmente para estructurar su atención.
   * [main()](file:///home/joaco/Documentos/MedSim/medsim-llm/src/train.py#286-521): Aprovisiona el hardware quantizado de Llama en 4-bit (NF4), aloca el adaptador LoRA (`get_peft_model`) y ejectua el bucle de optimización utilizando el componente `Trainer` de HuggingFace.
* **[schemas.py](file:///home/joaco/Documentos/MedSim/medsim-llm/src/schemas.py)**:
 * **Responsabilidad:** Estandarizar estructuras formales esperadas, como "Fichas de pacientes" (Patient Cards) y validaciones de turnos de diálogo.
 * **Funciones/Clases Críticas:** Utiliza Pydantic models (ej. [PatientScript](file:///home/joaco/Documentos/MedSim/medsim-llm/src/schemas.py#67-75), [MedicalHistory](file:///home/joaco/Documentos/MedSim/medsim-llm/src/schemas.py#37-42)) que definen cómo luce e interactúa matemáticamente la historia del individuo bajo un esquema de JSON forzado; junto con diccionarios prefabricados de "enfermedades y síntomas de la vida real" y nombres argentinos comunes.
* **[evaluate_patient_model.py](file:///home/joaco/Documentos/MedSim/medsim-llm/src/evaluate_patient_model.py) / [validation.py](file:///home/joaco/Documentos/MedSim/medsim-llm/src/validation.py)**:
 * **Responsabilidad:** Miden la confiabilidad del modelo generado iterando contra benchmarks de "Adherencia al personaje", "Consistencia del Rol" y midiendo la probabilidad de alucinación médica.


### 3. Flujo de Datos e Integración
* **Entradas (Inputs):**
 * Data cruda generada por simulaciones (estructurada en dicts u objetos JSON definidos en [schemas.py](file:///home/joaco/Documentos/MedSim/medsim-llm/src/schemas.py)).
* **Salidas (Outputs):**
 * Pesos finos exportados al directorio [models/](file:///home/joaco/Documentos/MedSim/stt-tts-api/routers/audio_router.py#99-107) y métricas estadísticas en logs del terminal.
* **Dependencias Externas:** Dependencia fuerte de `Pydantic` para estructuración, y componentes del Trainer de `HuggingFace` (`BitsAndBytesConfig`, `AutoModelForCausalLM`).


### 4. Hallazgos de Código Heredado (Legacy Quirks)
* **Deuda Técnica:**
 * Enlazado de constantes pesadas en código (Hardcoding): [schemas.py](file:///home/joaco/Documentos/MedSim/medsim-llm/src/schemas.py) contiene listas encadenadas gigantescas de dolencias médicas e informaciones nominales (`illneses`, `argentinian_names`). Esto rompe el principio de separación de preocupaciones al no ser importado de un CSV/JSON de base de datos genérico.
 * Configuración Multi-GPU capada: En [train.py](file:///home/joaco/Documentos/MedSim/medsim-llm/src/train.py), línea 376 detalla un escape (`os.environ["CUDA_VISIBLE_DEVICES"] = str(device_id)`) limitando intencionalmente a la primera GPU encontrada y matando la escalabilidad DataParallel.
* **Riesgos Potenciales:**
 * Corrupción de pre-procesamiento: [create_patient_dataset](file:///home/joaco/Documentos/MedSim/medsim-llm/src/train.py#122-284) asume que el JSONL siempre estará sano. Un fallo en el parseo por un salto de línea ignora silenciósamente el bloque a nivel bucle en la lectura (`except json.JSONDecodeError... continue`).


