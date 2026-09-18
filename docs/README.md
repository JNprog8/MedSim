# Documentación de MedSim

Este directorio es la entrada única a la documentación del proyecto. Está organizado para tres audiencias: desarrollo, operación/administración y evaluación técnica por futuros compradores.

## Estado documental

- **Vigente**: verificado contra el código actual.
- **En revisión**: existe información, pero todavía debe contrastarse con el código o con una decisión del equipo.
- **Planificado**: página incluida en el alcance, todavía no redactada.
- **Histórico**: material útil para comprender decisiones anteriores; no describe necesariamente el sistema actual.
- **TBD**: depende de una decisión o dato todavía no confirmado.

El código del repositorio es la autoridad para describir lo implementado. El material de Google Drive aporta contexto, requisitos e historia, pero nunca reemplaza la verificación contra el código.

## Índices por sección

| Orden | Sección | Pregunta que responde |
|---:|---|---|
| 00 | [Gobernanza documental](00-gobernanza/README.md) | ¿Qué entra, qué queda fuera y cómo se mantiene la documentación? |
| 01 | [Producto](01-producto/README.md) | ¿Qué es MedSim, para quién existe y cuáles son sus límites? |
| 02 | [Flujos funcionales](02-flujos-funcionales/README.md) | ¿Qué hacen el evaluador y el estudiante de principio a fin? |
| 03 | [Arquitectura](03-arquitectura/README.md) | ¿Cómo se organiza el sistema y cómo se comunican sus componentes? |
| 04 | [Backend, API y datos](04-backend-api-datos/README.md) | ¿Qué servicios, endpoints, modelos y persistencia existen? |
| 05 | [Frontend](05-frontend/README.md) | ¿Qué pantallas, rutas, estados e integraciones ofrece la web? |
| 06 | [IA, audio y Oculus](06-ia-audio-oculus/README.md) | ¿Cómo funcionan LLM, STT, TTS, tiempo real y el cliente VR? |
| 07 | [Evaluación SEGUE](07-evaluacion-segue/README.md) | ¿Cómo se evalúa la comunicación clínica y se genera el PDF? |
| 08 | [Seguridad y privacidad](08-seguridad-privacidad/README.md) | ¿Qué riesgos, controles y restricciones sobre datos existen? |
| 09 | [Despliegue y operación](09-despliegue-operacion/README.md) | ¿Cómo se instala, configura, despliega, opera y recupera? |
| 10 | [Calidad y contribución](10-calidad-contribucion/README.md) | ¿Cómo se prueba, valida y modifica el sistema de forma segura? |
| 11 | [Trazabilidad y referencias](11-trazabilidad-referencias/README.md) | ¿Qué fuente respalda cada afirmación y qué está pendiente? |

## Recorridos sugeridos

### Para desarrollo

1. [Arquitectura](03-arquitectura/README.md)
2. [Backend, API y datos](04-backend-api-datos/README.md)
3. [Frontend](05-frontend/README.md)
4. [IA, audio y Oculus](06-ia-audio-oculus/README.md)
5. [Calidad y contribución](10-calidad-contribucion/README.md)

### Para operación y administración

1. [Producto](01-producto/README.md)
2. [Flujos funcionales](02-flujos-funcionales/README.md)
3. [Seguridad y privacidad](08-seguridad-privacidad/README.md)
4. [Despliegue y operación](09-despliegue-operacion/README.md)

### Para evaluación técnica o comercial

1. [Producto](01-producto/README.md)
2. [Arquitectura](03-arquitectura/README.md)
3. [Evaluación SEGUE](07-evaluacion-segue/README.md)
4. [Seguridad y privacidad](08-seguridad-privacidad/README.md)
5. [Trazabilidad y referencias](11-trazabilidad-referencias/README.md)

## Restricciones confirmadas

- MedSim usa exclusivamente pacientes simulados.
- Está prohibido introducir datos de pacientes reales.
- No es un dispositivo médico y no sustituye el criterio profesional.
- El objetivo principal es entrenar y evaluar entrevista y comunicación clínica mediante SEGUE.
- El diagnóstico, el plan terapéutico y las indicaciones son complementarios; no son el foco pedagógico principal.
- Los roles funcionales actuales son **evaluador** y **estudiante**.
- La autenticación actual es provisoria y no debe presentarse como control listo para producción.
- La autoevaluación mediante IA está parcialmente codificada, pero no está expuesta por API ni interfaz; se considera experimental/futura.
- No se documentan precios, estimaciones económicas ni condiciones comerciales.
- No se incorpora información académica sensible, credenciales, datos personales, firmas ni actas.

[Siguiente: Gobernanza documental →](00-gobernanza/README.md)
