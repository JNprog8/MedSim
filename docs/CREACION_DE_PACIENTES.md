# Creación de pacientes simulados

MedSim prioriza la entrevista y la comunicación clínica evaluadas con SEGUE. El profesor diseña una persona capaz de sostener una conversación coherente, no solo una lista de síntomas y un diagnóstico. Utilizar exclusivamente datos ficticios.

## Recorrido del formulario

1. **Situación inicial:** nombre, edad, motivo en lenguaje del paciente y motivo breve de triage que verá el estudiante. «Sexo asignado al nacer» es un dato clínico obligatorio con tres opciones: masculino, femenino e intersexual. «Cómo se refiere a sí mismo» ofrece hombre, mujer y no binario. Hombre y mujer seleccionan inicialmente la voz correspondiente; no binario conserva la voz actual. La voz siempre puede cambiarse manualmente.
2. **La persona:** su preocupación, impacto en la vida y expectativa de la consulta. La personalidad, el lenguaje, la memoria y el estado cognitivo modifican cómo responde, no los hechos del caso.
3. **La entrevista:** historia subjetiva completa y tres niveles de revelación. Lo espontáneo aparece al comienzo; lo abierto, ante «contame más»; lo condicional, solo ante la pregunta concreta correspondiente. Registrar respuestas negativas explícitas donde importen.
4. **Detalles del caso:** datos administrativos, antecedentes, medicación y estudios que verá el estudiante en la ficha clínica lateral. La resolución final es para el evaluador. El formulario incluye una vista de esa ficha.

**Hábitos y contexto personal** es un campo libre para información que el paciente conoce pero el estudiante debe descubrir conversando. Se pueden escribir frases simples, sin etiquetas ni botón «Agregar». El texto no aparece en la ficha lateral; los perfiles anteriores con líneas «Tema: respuesta» siguen siendo compatibles.

El asterisco marca los siete datos obligatorios: nombre, edad, motivo en palabras del paciente, sexo asignado al nacer, forma de hablar de sí, preocupación y experiencia subjetiva completa. Cada paso se continúa con «Siguiente»; «Guardar paciente» aparece en el último. Si falta un campo obligatorio, el formulario abre su paso, lo enfoca y lo marca.

## Ejemplo de revelación

| Nivel | Lucas, 21 años |
| --- | --- |
| Inicio | «Desde ayer me duele mucho la panza y hoy está peor.» |
| Pregunta abierta | «Empezó cerca del ombligo y después se corrió a la derecha.» |
| Pregunta específica | «Si preguntan por vómitos: no tuve.» |

No poner un dato en el nivel inicial si se espera que el estudiante lo descubra preguntando. Un campo vacío significa que el dato no fue definido; no equivale a una respuesta negativa.

## Qué recibe cada participante

El paciente virtual recibe los hechos vividos y los antecedentes que puede conocer, junto con la perspectiva y las reglas de revelación. Siempre usa español argentino con voseo; no hay selector de variante. El diagnóstico real y el plan de resolución quedan fuera de su prompt. La ficha clínica lateral del estudiante incluye identificación, triage, historia clínica institucional y estudios recientes. No incluye la experiencia subjetiva completa, preocupación ni información de resolución. Los endpoints de administración de pacientes aún devuelven los perfiles completos, por lo que esta separación de vistas no constituye por sí misma una autorización por rol.

## Validación recomendada

Probar cada caso con un saludo, una pregunta abierta, preguntas específicas, una pregunta repetida, una palabra médica que el paciente no comprenda y una pregunta sobre sus preocupaciones. Verificar que no adelante datos, no invente información y reaccione de forma humana sin cambiar la verdad del caso.
