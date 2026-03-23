# 🚀 Cambios Clave en el Nuevo Backend de MedSim

Hemos rediseñado el "cerebro" de MedSim para que sea más rápido, organizado y profesional. Aquí tienes los cambios explicados de forma simple:

### 1. Nueva Estructura (Arquitectura Limpia)
- **Antes:** Todo el código estaba mezclado en pocos archivos.
- **Ahora:** El código está organizado por "carpetas de responsabilidad" (Modelos, Servicios, Base de Datos, API). Esto hace que sea mucho más fácil encontrar errores y agregar funciones nuevas sin romper las viejas.

### 2. Adiós a los Archivos JSON, Hola MongoDB
- **Antes:** El sistema guardaba todo en archivos de texto (.json). Si dos personas hablaban al mismo tiempo, podía haber problemas.
- **Ahora:** Usamos **MongoDB**, una base de datos profesional. Es mucho más rápida y segura para guardar los pacientes, los alumnos y las conversaciones.
- **Importante:** Al arrancar por primera vez, el sistema lee tus archivos JSON actuales y los guarda automáticamente en la base de datos para que no pierdas nada.

### 3. Un Orquestador de IA más Inteligente
- Hemos creado un "Director de Orquesta" (`AudioOrchestrator`) que se encarga de todo el proceso de hablar con el paciente:
  1. Escucha lo que dice el alumno (Audio a Texto).
  2. Le pregunta a la IA qué respondería el paciente (LLM).
  3. Convierte esa respuesta en voz (Texto a Voz).
  4. Guarda todo y lo muestra en pantalla al instante.

### 4. Comunicación en Tiempo Real (WebSockets)
- Se mejoró la forma en que los mensajes viajan al navegador. Ahora, en cuanto el paciente responde, el mensaje aparece "volando" en la pantalla del alumno y del evaluador gracias a un sistema de canales en vivo.

### 5. Configuración Centralizada
- Ahora todo se controla desde un solo lugar (archivo `.env`). Puedes cambiar el modelo de IA, la voz del paciente o la conexión a la base de datos sin tocar una sola línea de código.

---
*El backend anterior ha sido movido a la carpeta `viejo-backend/` por seguridad.*
