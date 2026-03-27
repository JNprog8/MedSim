# MedSim Unreal 5.5.4 Integration
cd "C:\Users\Maxi\Documents\Unreal Projects\MyProject\MedSim"
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000

Esta carpeta contiene una base separada para integrar Unreal Engine 5.5.4 con el backend actual de MedSim.

## Que incluye

- Plugin C++ `MedSimUnreal`
- Cliente HTTP para:
  - iniciar `encounter`
  - enviar audio WAV a `/api/audio_turn`
  - enviar texto a `/api/chat`
  - descargar audio desde `/api/audio/{audio_id}`
- Cliente WebSocket para escuchar eventos de una sesion
- Tipos Blueprint-friendly para usarlo desde UI o gameplay
- Componente `Conversation` para Blueprints mas ordenados
- Utilidad para construir WAV mono PCM16
- Componente `PushToTalk` para acumular PCM16 y enviar audio por turno
- Componente de descarga de audio de respuesta

## Estructura

```text
integrations/unreal_5_5_4/
|- README.md
`- MedSimUnreal/
   |- MedSimUnreal.uplugin
   `- Source/
      `- MedSimUnreal/
         |- MedSimUnreal.Build.cs
         |- Public/
         `- Private/
```

## Como usarlo

1. Copia la carpeta `MedSimUnreal/` dentro de `Plugins/` de tu proyecto Unreal.
2. Activa el plugin desde el editor.
3. Reinicia el proyecto.
4. Configura la URL del backend, por ejemplo `http://127.0.0.1:8000`.
5. Usa `UMedSimApiSubsystem` desde Blueprints o C++.

## Flujo recomendado

1. `ConfigureApi`
2. `StartEncounter`
3. `ConnectEncounterSocket`
4. Capturar audio del microfono en Unreal
5. Convertirlo a WAV mono PCM16
6. `SendWavAudioTurn`
7. Mostrar `ReplyText`
8. Reproducir `AssistantAudioUrl` o decodificar `AssistantAudioBase64`

## Componentes extra incluidos

- `UMedSimConversationComponent`
  - guarda el `EncounterId` activo
  - expone nodos mas limpios para Blueprints
  - centraliza texto, audio y realtime
- `UMedSimPushToTalkComponent`
  - arranca y frena grabacion logica
  - recibe muestras PCM16 desde cualquier fuente
  - construye WAV
  - envia el turno al backend
- `UMedSimAudioDownloadComponent`
  - descarga bytes desde `AssistantAudioUrl`
  - devuelve el `Content-Type`

## Backend esperado

El plugin apunta a los endpoints actuales del backend:

- `POST /api/encounters/start`
- `POST /api/audio_turn`
- `POST /api/chat`
- `GET /api/audio/{audio_id}`
- `WS /ws/encounters/{encounter_id}`

## Notas practicas

- El backend actual trabaja por turnos, no por streaming de audio.
- Lo mas simple es que Unreal grabe unos segundos, envie el WAV y espere la respuesta.
- Si luego quieres streaming real, habria que ampliar el backend para aceptar chunks por WebSocket.

## Integracion de captura de audio

Esta base deja resuelto el cliente hacia MedSim. La captura de microfono en Unreal puede conectarse con:

- `AudioCapture`
- un plugin propio que entregue PCM16
- una capa C++ que junte muestras y las convierta a WAV con `UMedSimWavLibrary`

La forma de usarlo es:

1. cuando el jugador mantenga pulsado un boton, llamar `StartRecording`
2. mientras grabas, empujar muestras PCM16 con `AddPcm16Samples`
3. al soltar, llamar `StopRecordingAndSend`
4. escuchar `OnAudioTurnReady`

## Estructura Blueprint recomendada

Para que en Unreal se vea ordenado:

1. agrega `UMedSimConversationComponent` a tu Actor o Widget Controller
2. agrega `UMedSimPushToTalkComponent` si vas a usar voz
3. agrega `UMedSimAudioDownloadComponent` si reproduciras audio desde URL
4. usa `ConversationComponent` como nodo central

Grafo sugerido:

- `BeginPlay`
  - `Configure MedSim API`
- boton `Iniciar`
  - `Start Conversation Encounter`
- evento `OnConversationEncounterStarted`
  - guardar UI state
  - `Connect Realtime For Active Encounter`
- boton `Enviar Texto`
  - `Send Text To Active Encounter`
- boton `PTT Pressed`
  - `StartRecording`
- boton `PTT Released`
  - `Stop Recording And Send Using Conversation`
- evento `OnConversationAudioReply`
  - actualizar subtitulos
  - descargar/reproducir audio

## Limitaciones de esta base

- No incluye un mapa ni widgets de Unreal ya armados.
- No compila dentro de este repo porque aqui no existe un proyecto `.uproject`.
- El codigo esta preparado para copiarse dentro de un proyecto UE 5.5.4 y compilar ahi.
