#include "MedSimApiSubsystem.h"

#include "Dom/JsonObject.h"
#include "HttpModule.h"
#include "HttpResponseCodes.h"
#include "Interfaces/IHttpResponse.h"
#include "JsonSerializer.h"
#include "MedSimMultipartBuilder.h"
#include "Modules/ModuleManager.h"
#include "WebSocketsModule.h"

void UMedSimApiSubsystem::Deinitialize()
{
    DisconnectEncounterSocket();
    Super::Deinitialize();
}

void UMedSimApiSubsystem::ConfigureApi(const FMedSimApiConfig& InConfig)
{
    Config = InConfig;
}

FMedSimApiConfig UMedSimApiSubsystem::GetApiConfig() const
{
    return Config;
}

void UMedSimApiSubsystem::StartEncounter(const FMedSimStartEncounterRequest& RequestData)
{
    TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
    Request->SetURL(BuildApiUrl(TEXT("/api/encounters/start")));
    Request->SetVerb(TEXT("POST"));
    Request->SetHeader(TEXT("Content-Type"), TEXT("application/json"));

    TSharedPtr<FJsonObject> JsonObject = MakeShared<FJsonObject>();
    JsonObject->SetStringField(TEXT("patient_id"), RequestData.PatientId);
    if (!RequestData.StudentId.IsEmpty())
    {
        JsonObject->SetStringField(TEXT("student_id"), RequestData.StudentId);
    }
    if (!RequestData.EvaluatorName.IsEmpty())
    {
        JsonObject->SetStringField(TEXT("evaluator_name"), RequestData.EvaluatorName);
    }

    FString Body;
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&Body);
    FJsonSerializer::Serialize(JsonObject.ToSharedRef(), Writer);
    Request->SetContentAsString(Body);

    Request->OnProcessRequestComplete().BindUObject(this, &UMedSimApiSubsystem::HandleStartEncounterResponse);
    Request->ProcessRequest();
}

void UMedSimApiSubsystem::SendChatTurn(const FMedSimChatTurnRequest& RequestData)
{
    FMedSimMultipartBuilder Multipart;
    Multipart.AddFormField(TEXT("encounter_id"), RequestData.EncounterId);
    Multipart.AddFormField(TEXT("message"), RequestData.Message);
    Multipart.AddFormField(TEXT("include_tts"), RequestData.bIncludeTts ? TEXT("true") : TEXT("false"));

    TArray<uint8> Payload;
    Multipart.Build(Payload);

    TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
    Request->SetURL(BuildApiUrl(TEXT("/api/chat")));
    Request->SetVerb(TEXT("POST"));
    Request->SetHeader(TEXT("Content-Type"), FString::Printf(TEXT("multipart/form-data; boundary=%s"), *Multipart.GetBoundary()));
    Request->SetContent(Payload);
    Request->OnProcessRequestComplete().BindUObject(this, &UMedSimApiSubsystem::HandleChatTurnResponse);
    Request->ProcessRequest();
}

void UMedSimApiSubsystem::SendWavAudioTurn(const FString& EncounterId, const TArray<uint8>& WavBytes, const FString& FileName)
{
    FMedSimMultipartBuilder Multipart;
    Multipart.AddFormField(TEXT("encounter_id"), EncounterId);
    Multipart.AddFileField(TEXT("file"), FileName, TEXT("audio/wav"), WavBytes);

    TArray<uint8> Payload;
    Multipart.Build(Payload);

    TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
    Request->SetURL(BuildApiUrl(TEXT("/api/audio_turn")));
    Request->SetVerb(TEXT("POST"));
    Request->SetHeader(TEXT("Content-Type"), FString::Printf(TEXT("multipart/form-data; boundary=%s"), *Multipart.GetBoundary()));
    Request->SetContent(Payload);
    Request->OnProcessRequestComplete().BindUObject(this, &UMedSimApiSubsystem::HandleAudioTurnResponse);
    Request->ProcessRequest();
}

void UMedSimApiSubsystem::ConnectEncounterSocket(const FString& EncounterId)
{
    DisconnectEncounterSocket();

    ActiveEncounterId = EncounterId;
    if (!FModuleManager::Get().IsModuleLoaded(TEXT("WebSockets")))
    {
        FModuleManager::Get().LoadModule(TEXT("WebSockets"));
    }

    Socket = FWebSocketsModule::Get().CreateWebSocket(BuildWsUrl(EncounterId));
    BindSocketHandlers(EncounterId);
    Socket->Connect();
}

void UMedSimApiSubsystem::DisconnectEncounterSocket()
{
    if (Socket.IsValid())
    {
        Socket->Close();
        Socket.Reset();
    }
}

bool UMedSimApiSubsystem::IsSocketConnected() const
{
    return Socket.IsValid() && Socket->IsConnected();
}

FString UMedSimApiSubsystem::BuildApiUrl(const FString& Path) const
{
    const FString TrimmedBase = Config.BaseUrl.EndsWith(TEXT("/")) ? Config.BaseUrl.LeftChop(1) : Config.BaseUrl;
    return TrimmedBase + Path;
}

FString UMedSimApiSubsystem::BuildWsUrl(const FString& EncounterId) const
{
    FString Url = Config.BaseUrl;
    Url = Url.Replace(TEXT("https://"), TEXT("wss://"));
    Url = Url.Replace(TEXT("http://"), TEXT("ws://"));
    if (Url.EndsWith(TEXT("/")))
    {
        Url.LeftChopInline(1);
    }
    return FString::Printf(TEXT("%s/ws/encounters/%s"), *Url, *EncounterId);
}

FString UMedSimApiSubsystem::NormalizeAudioUrl(const FString& MaybeRelativeUrl) const
{
    if (MaybeRelativeUrl.StartsWith(TEXT("http://")) || MaybeRelativeUrl.StartsWith(TEXT("https://")))
    {
        return MaybeRelativeUrl;
    }

    if (MaybeRelativeUrl.StartsWith(TEXT("/")))
    {
        const FString TrimmedBase = Config.BaseUrl.EndsWith(TEXT("/")) ? Config.BaseUrl.LeftChop(1) : Config.BaseUrl;
        return TrimmedBase + MaybeRelativeUrl;
    }

    return MaybeRelativeUrl;
}

void UMedSimApiSubsystem::BroadcastError(const FString& ErrorMessage)
{
    OnRequestError.Broadcast(ErrorMessage);
}

FMedSimAudioTurnResponse UMedSimApiSubsystem::ParseAudioTurnResponse(const FString& ResponseText, bool bWasSuccessful) const
{
    FMedSimAudioTurnResponse Parsed;
    Parsed.bSuccess = bWasSuccessful;

    TSharedPtr<FJsonObject> Root;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(ResponseText);
    if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
    {
        Parsed.bSuccess = false;
        Parsed.ErrorMessage = ResponseText.IsEmpty() ? TEXT("Respuesta invalida del backend") : ResponseText;
        return Parsed;
    }

    Root->TryGetStringField(TEXT("encounter_id"), Parsed.EncounterId);
    Root->TryGetStringField(TEXT("user_text"), Parsed.UserText);
    Root->TryGetStringField(TEXT("reply_text"), Parsed.ReplyText);

    const TSharedPtr<FJsonObject>* AssistantAudioObject = nullptr;
    if (Root->TryGetObjectField(TEXT("assistant_audio"), AssistantAudioObject) && AssistantAudioObject && AssistantAudioObject->IsValid())
    {
        (*AssistantAudioObject)->TryGetStringField(TEXT("audio_url"), Parsed.AssistantAudioUrl);
        (*AssistantAudioObject)->TryGetStringField(TEXT("audio_base64"), Parsed.AssistantAudioBase64);
        (*AssistantAudioObject)->TryGetStringField(TEXT("content_type"), Parsed.AssistantAudioContentType);
        Parsed.AssistantAudioUrl = NormalizeAudioUrl(Parsed.AssistantAudioUrl);
    }

    FString Detail;
    if (Root->TryGetStringField(TEXT("detail"), Detail) && !Detail.IsEmpty())
    {
        Parsed.ErrorMessage = Detail;
        Parsed.bSuccess = false;
    }

    return Parsed;
}

void UMedSimApiSubsystem::BindSocketHandlers(const FString& EncounterId)
{
    if (!Socket.IsValid())
    {
        return;
    }

    Socket->OnConnected().AddLambda([this]()
    {
    });

    Socket->OnConnectionError().AddLambda([this](const FString& Error)
    {
        BroadcastError(FString::Printf(TEXT("WebSocket error: %s"), *Error));
    });

    Socket->OnClosed().AddLambda([this, EncounterId](int32 StatusCode, const FString& Reason, bool bWasClean)
    {
        if (Config.bAutoReconnectSocket && !EncounterId.IsEmpty())
        {
            BroadcastError(FString::Printf(TEXT("WebSocket cerrado (%d): %s"), StatusCode, *Reason));
        }
    });

    Socket->OnMessage().AddLambda([this](const FString& Message)
    {
        FMedSimRealtimeEvent Event;
        Event.RawJson = Message;

        TSharedPtr<FJsonObject> Root;
        TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Message);
        if (FJsonSerializer::Deserialize(Reader, Root) && Root.IsValid())
        {
            Root->TryGetStringField(TEXT("type"), Event.Type);
            Root->TryGetStringField(TEXT("encounter_id"), Event.EncounterId);
        }

        OnRealtimeMessage.Broadcast(Event);
    });
}

void UMedSimApiSubsystem::HandleStartEncounterResponse(FHttpRequestPtr Request, FHttpResponsePtr Response, bool bWasSuccessful)
{
    FMedSimStartEncounterResponse Parsed;
    Parsed.bSuccess = bWasSuccessful && Response.IsValid() && EHttpResponseCodes::IsOk(Response->GetResponseCode());

    if (!Response.IsValid())
    {
        Parsed.ErrorMessage = TEXT("No hubo respuesta del backend");
        OnEncounterStarted.Broadcast(Parsed);
        BroadcastError(Parsed.ErrorMessage);
        return;
    }

    TSharedPtr<FJsonObject> Root;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Response->GetContentAsString());
    if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
    {
        Parsed.bSuccess = false;
        Parsed.ErrorMessage = TEXT("No se pudo parsear la respuesta");
        OnEncounterStarted.Broadcast(Parsed);
        BroadcastError(Parsed.ErrorMessage);
        return;
    }

    Root->TryGetStringField(TEXT("encounter_id"), Parsed.EncounterId);
    Root->TryGetStringField(TEXT("patient_id"), Parsed.PatientId);

    if (!Parsed.bSuccess)
    {
        Root->TryGetStringField(TEXT("detail"), Parsed.ErrorMessage);
        if (Parsed.ErrorMessage.IsEmpty())
        {
            Parsed.ErrorMessage = Response->GetContentAsString();
        }
        BroadcastError(Parsed.ErrorMessage);
    }

    OnEncounterStarted.Broadcast(Parsed);
}

void UMedSimApiSubsystem::HandleChatTurnResponse(FHttpRequestPtr Request, FHttpResponsePtr Response, bool bWasSuccessful)
{
    const bool bOk = bWasSuccessful && Response.IsValid() && EHttpResponseCodes::IsOk(Response->GetResponseCode());
    const FString ResponseText = Response.IsValid() ? Response->GetContentAsString() : TEXT("");
    FMedSimAudioTurnResponse Parsed = ParseAudioTurnResponse(ResponseText, bOk);
    if (!Parsed.bSuccess)
    {
        BroadcastError(Parsed.ErrorMessage.IsEmpty() ? TEXT("Error enviando chat turn") : Parsed.ErrorMessage);
    }
    OnChatTurnCompleted.Broadcast(Parsed);
}

void UMedSimApiSubsystem::HandleAudioTurnResponse(FHttpRequestPtr Request, FHttpResponsePtr Response, bool bWasSuccessful)
{
    const bool bOk = bWasSuccessful && Response.IsValid() && EHttpResponseCodes::IsOk(Response->GetResponseCode());
    const FString ResponseText = Response.IsValid() ? Response->GetContentAsString() : TEXT("");
    FMedSimAudioTurnResponse Parsed = ParseAudioTurnResponse(ResponseText, bOk);
    if (!Parsed.bSuccess)
    {
        BroadcastError(Parsed.ErrorMessage.IsEmpty() ? TEXT("Error enviando audio turn") : Parsed.ErrorMessage);
    }
    OnAudioTurnCompleted.Broadcast(Parsed);
}
