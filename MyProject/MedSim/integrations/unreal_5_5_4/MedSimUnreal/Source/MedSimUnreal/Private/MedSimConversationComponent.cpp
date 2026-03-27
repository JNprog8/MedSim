#include "MedSimConversationComponent.h"

#include "Engine/GameInstance.h"
#include "Kismet/GameplayStatics.h"
#include "MedSimApiSubsystem.h"

UMedSimConversationComponent::UMedSimConversationComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

void UMedSimConversationComponent::BeginPlay()
{
    Super::BeginPlay();

    if (UMedSimApiSubsystem* ApiSubsystem = ResolveApiSubsystem())
    {
        ApiSubsystem->OnEncounterStarted.AddDynamic(this, &UMedSimConversationComponent::HandleEncounterStarted);
        ApiSubsystem->OnChatTurnCompleted.AddDynamic(this, &UMedSimConversationComponent::HandleChatCompleted);
        ApiSubsystem->OnAudioTurnCompleted.AddDynamic(this, &UMedSimConversationComponent::HandleAudioCompleted);
        ApiSubsystem->OnRealtimeMessage.AddDynamic(this, &UMedSimConversationComponent::HandleRealtimeEvent);
        ApiSubsystem->OnRequestError.AddDynamic(this, &UMedSimConversationComponent::HandleRequestError);
    }
}

void UMedSimConversationComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (UMedSimApiSubsystem* ApiSubsystem = ResolveApiSubsystem())
    {
        ApiSubsystem->OnEncounterStarted.RemoveDynamic(this, &UMedSimConversationComponent::HandleEncounterStarted);
        ApiSubsystem->OnChatTurnCompleted.RemoveDynamic(this, &UMedSimConversationComponent::HandleChatCompleted);
        ApiSubsystem->OnAudioTurnCompleted.RemoveDynamic(this, &UMedSimConversationComponent::HandleAudioCompleted);
        ApiSubsystem->OnRealtimeMessage.RemoveDynamic(this, &UMedSimConversationComponent::HandleRealtimeEvent);
        ApiSubsystem->OnRequestError.RemoveDynamic(this, &UMedSimConversationComponent::HandleRequestError);
    }

    Super::EndPlay(EndPlayReason);
}

void UMedSimConversationComponent::ConfigureApi(const FMedSimApiConfig& InConfig)
{
    if (UMedSimApiSubsystem* ApiSubsystem = ResolveApiSubsystem())
    {
        ApiSubsystem->ConfigureApi(InConfig);
        OnConversationConfigured.Broadcast(InConfig);
        return;
    }

    OnConversationError.Broadcast(TEXT("No se encontro MedSimApiSubsystem"));
}

void UMedSimConversationComponent::StartConversationEncounter(const FMedSimStartEncounterRequest& Request)
{
    if (UMedSimApiSubsystem* ApiSubsystem = ResolveApiSubsystem())
    {
        ApiSubsystem->StartEncounter(Request);
        return;
    }

    OnConversationError.Broadcast(TEXT("No se encontro MedSimApiSubsystem"));
}

void UMedSimConversationComponent::ConnectRealtimeForActiveEncounter()
{
    if (ActiveEncounterId.IsEmpty())
    {
        OnConversationError.Broadcast(TEXT("No hay EncounterId activo"));
        return;
    }

    if (UMedSimApiSubsystem* ApiSubsystem = ResolveApiSubsystem())
    {
        ApiSubsystem->ConnectEncounterSocket(ActiveEncounterId);
        return;
    }

    OnConversationError.Broadcast(TEXT("No se encontro MedSimApiSubsystem"));
}

void UMedSimConversationComponent::DisconnectRealtime()
{
    if (UMedSimApiSubsystem* ApiSubsystem = ResolveApiSubsystem())
    {
        ApiSubsystem->DisconnectEncounterSocket();
        return;
    }

    OnConversationError.Broadcast(TEXT("No se encontro MedSimApiSubsystem"));
}

void UMedSimConversationComponent::SendTextToActiveEncounter(const FString& Message, bool bIncludeTts)
{
    if (ActiveEncounterId.IsEmpty())
    {
        OnConversationError.Broadcast(TEXT("No hay EncounterId activo"));
        return;
    }

    if (Message.IsEmpty())
    {
        OnConversationError.Broadcast(TEXT("El mensaje esta vacio"));
        return;
    }

    if (UMedSimApiSubsystem* ApiSubsystem = ResolveApiSubsystem())
    {
        FMedSimChatTurnRequest Request;
        Request.EncounterId = ActiveEncounterId;
        Request.Message = Message;
        Request.bIncludeTts = bIncludeTts;
        ApiSubsystem->SendChatTurn(Request);
        return;
    }

    OnConversationError.Broadcast(TEXT("No se encontro MedSimApiSubsystem"));
}

void UMedSimConversationComponent::SendWavToActiveEncounter(const TArray<uint8>& WavBytes, const FString& FileName)
{
    if (ActiveEncounterId.IsEmpty())
    {
        OnConversationError.Broadcast(TEXT("No hay EncounterId activo"));
        return;
    }

    if (WavBytes.Num() == 0)
    {
        OnConversationError.Broadcast(TEXT("No hay audio para enviar"));
        return;
    }

    if (UMedSimApiSubsystem* ApiSubsystem = ResolveApiSubsystem())
    {
        ApiSubsystem->SendWavAudioTurn(ActiveEncounterId, WavBytes, FileName);
        return;
    }

    OnConversationError.Broadcast(TEXT("No se encontro MedSimApiSubsystem"));
}

void UMedSimConversationComponent::SetActiveEncounterId(const FString& EncounterId)
{
    ActiveEncounterId = EncounterId;
}

FString UMedSimConversationComponent::GetActiveEncounterId() const
{
    return ActiveEncounterId;
}

bool UMedSimConversationComponent::HasActiveEncounter() const
{
    return !ActiveEncounterId.IsEmpty();
}

FMedSimApiConfig UMedSimConversationComponent::GetCurrentConfig() const
{
    if (UMedSimApiSubsystem* ApiSubsystem = CachedSubsystem.Get())
    {
        return ApiSubsystem->GetApiConfig();
    }

    return FMedSimApiConfig();
}

UMedSimApiSubsystem* UMedSimConversationComponent::ResolveApiSubsystem()
{
    if (CachedSubsystem.IsValid())
    {
        return CachedSubsystem.Get();
    }

    UWorld* World = GetWorld();
    if (!World)
    {
        return nullptr;
    }

    UGameInstance* GameInstance = UGameplayStatics::GetGameInstance(World);
    if (!GameInstance)
    {
        return nullptr;
    }

    UMedSimApiSubsystem* ApiSubsystem = GameInstance->GetSubsystem<UMedSimApiSubsystem>();
    CachedSubsystem = ApiSubsystem;
    return ApiSubsystem;
}

void UMedSimConversationComponent::HandleEncounterStarted(const FMedSimStartEncounterResponse& Response)
{
    if (Response.bSuccess && !Response.EncounterId.IsEmpty())
    {
        ActiveEncounterId = Response.EncounterId;
    }

    OnConversationEncounterStarted.Broadcast(Response);
}

void UMedSimConversationComponent::HandleChatCompleted(const FMedSimAudioTurnResponse& Response)
{
    OnConversationChatReply.Broadcast(Response);
}

void UMedSimConversationComponent::HandleAudioCompleted(const FMedSimAudioTurnResponse& Response)
{
    OnConversationAudioReply.Broadcast(Response);
}

void UMedSimConversationComponent::HandleRealtimeEvent(const FMedSimRealtimeEvent& Event)
{
    if (!ActiveEncounterId.IsEmpty() && !Event.EncounterId.IsEmpty() && Event.EncounterId != ActiveEncounterId)
    {
        return;
    }

    OnConversationRealtimeEvent.Broadcast(Event);
}

void UMedSimConversationComponent::HandleRequestError(const FString& ErrorMessage)
{
    OnConversationError.Broadcast(ErrorMessage);
}
