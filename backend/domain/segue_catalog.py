SEGUE_SECTIONS = [
    {
        "area": "Conectar con el paciente",
        "items": [
            {"id": "1", "label": "Saluda adecuadamente al paciente"},
            {"id": "2", "label": "Establece el motivo de consulta"},
            {"id": "3", "label": "Establece agenda y secuencia de problemas"},
            {"id": "4", "label": "Establece conexion personal con el paciente mas alla de los problemas medicos"},
            {"id": "5", "label": "Genera privacidad. Si va a haber interrupcion, lo anticipa"},
        ],
    },
    {
        "area": "Obtener informacion",
        "items": [
            {"id": "6", "label": "Recoge la perspectiva del paciente respecto a su problema de salud, sus ideas y dudas"},
            {"id": "7", "label": "Explora signos y sintomas, factores fisicos y fisiologicos"},
            {"id": "8", "label": "Explora factores psicosociales, situacion familiar, relaciones y estres"},
            {"id": "9", "label": "Indaga sobre tratamientos previos o historia del padecimiento"},
            {"id": "10", "label": "Indaga como los problemas de salud afectan la vida del paciente"},
            {"id": "11", "label": "Indaga estrategias de prevencion y problemas del estilo de vida"},
            {"id": "12", "label": "Hace preguntas directas. Evita preguntas directivas o capciosas"},
            {"id": "13", "label": "Da tiempo para que el paciente hable, no interrumpe"},
            {"id": "14", "label": "Escucha. Presta toda la atencion al paciente. Parafrasea y/o repregunta"},
            {"id": "15", "label": "Chequea y/o clarifica informacion"},
        ],
    },
    {
        "area": "Dar informacion",
        "items": [
            {"id": "16", "label": "Explica la justificacion del uso de examenes complementarios o procedimientos"},
            {"id": "17", "label": "Ensenia al paciente sobre su propio cuerpo y situacion"},
            {"id": "18", "label": "Alienta al paciente para que realice preguntas"},
            {"id": "19", "label": "Se adapta al nivel de comprension del paciente"},
        ],
    },
    {
        "area": "Comprension de la perspectiva del paciente",
        "items": [
            {"id": "20", "label": "Reconoce los logros, el progreso y los desafios del paciente"},
            {"id": "21", "label": "Reconoce el tiempo de espera"},
            {"id": "22", "label": "Expresa cuidado, preocupacion y empatia"},
            {"id": "23", "label": "Mantiene un tono respetuoso"},
        ],
    },
    {
        "area": "Cierre",
        "items": [
            {"id": "24", "label": "Pregunta si hay algo mas que quiera discutir o preguntar"},
            {"id": "25", "label": "Revisa nuevos pasos a seguir"},
        ],
    },
]

SEGUE_ITEMS = [item for section in SEGUE_SECTIONS for item in section["items"]]
