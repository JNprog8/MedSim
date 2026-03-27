# Uso rapido en Unreal 5.5.4

## 1. Instalar plugin

Copia:

```text
integrations/unreal_5_5_4/MedSimUnreal
```

dentro de:

```text
TuProyecto/Plugins/MedSimUnreal
```

## 2. Activar modulos

El plugin ya declara:

- `HTTP`
- `Json`
- `JsonUtilities`
- `WebSockets`

## 3. Configurar backend

Desde Blueprint o C++:

- Obtiene `GameInstanceSubsystem`
- castea a `MedSimApiSubsystem`
- llama a `ConfigureApi`

Ejemplo:

- `BaseUrl = http://127.0.0.1:8000`

## 4. Crear una sesion

Si quieres Blueprints mas ordenados, usa primero `UMedSimConversationComponent`.

Llama a `Start Conversation Encounter` con:

- `PatientId`
- opcional `StudentId`
- opcional `EvaluatorName`

La respuesta trae:

- `EncounterId`

## 5. Conectar WebSocket

Llama a:

- `Connect Realtime For Active Encounter`

Eventos recibidos:

- snapshot inicial
- `message_added`
- `encounter_finished`
- `encounter_reopened`

## 6. Enviar audio

Cuando ya tengas muestras PCM16 mono:

1. conviertes a WAV con `BuildWavFromPcm16Mono`
2. llamas a `Send WAV To Active Encounter`

Parametros:

- `EncounterId`
- `WavBytes`
- `FileName`

## 7. Leer respuesta

En `OnConversationAudioReply` recibes:

- `UserText`
- `ReplyText`
- `AssistantAudioUrl`
- `AssistantAudioBase64`
- `AssistantAudioContentType`

## 8. Reproducir audio

Tienes dos caminos:

- descargar `AssistantAudioUrl` con otro request HTTP y reproducirlo
- decodificar `AssistantAudioBase64` y crear un `USoundWave` en runtime

## 9. Opcion mas simple: componente Push To Talk

Tambien puedes usar `UMedSimPushToTalkComponent`.

Flujo:

1. `StartRecording()`
2. vas agregando muestras con `AddPcm16Samples()`
3. `StopRecordingAndSend(EncounterId)`
4. escuchas `OnAudioTurnReady`

Este componente no captura microfono por si solo.
Su objetivo es desacoplar la captura del envio al backend.

Eso te deja conectar cualquier fuente de audio de UE 5.5.4 sin rehacer el cliente HTTP.

## 11. Blueprint limpio recomendado

Componentes:

- `MedSimConversationComponent`
- `MedSimPushToTalkComponent`
- `MedSimAudioDownloadComponent`

Distribucion sugerida del Blueprint:

- columna izquierda: botones y eventos UI
- centro: nodos del `MedSimConversationComponent`
- derecha: actualizacion de widgets, subtitulos y audio

Secuencia sugerida:

1. `BeginPlay -> Configure MedSim API`
2. `Boton Iniciar -> Start Conversation Encounter`
3. `OnConversationEncounterStarted -> Connect Realtime For Active Encounter`
4. `Boton Enviar Texto -> Send Text To Active Encounter`
5. `Presionar Hablar -> StartRecording`
6. `Soltar Hablar -> StopRecordingAndSend`
7. `OnConversationAudioReply -> DownloadAudio`

## 10. Descargar audio devuelto

Si prefieres usar URL en lugar de base64:

1. agrega `UMedSimAudioDownloadComponent`
2. llama `DownloadAudio(AssistantAudioUrl)`
3. procesa `OnAudioDownloaded`

La respuesta entrega:

- `AudioBytes`
- `ContentType`

## Recomendacion de implementacion

Para una primera version:

- Push-to-talk
- grabar 2 a 8 segundos
- enviar WAV
- esperar respuesta
- reproducir audio

Eso encaja perfecto con el backend actual.
