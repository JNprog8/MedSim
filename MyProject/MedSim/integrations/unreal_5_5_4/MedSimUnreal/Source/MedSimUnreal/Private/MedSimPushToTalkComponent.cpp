#include "MedSimPushToTalkComponent.h"

#include "Engine/GameInstance.h"
#include "Kismet/GameplayStatics.h"
#include "MedSimApiSubsystem.h"
#include "MedSimConversationComponent.h"
#include "MedSimWavLibrary.h"

UMedSimPushToTalkComponent::UMedSimPushToTalkComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

void UMedSimPushToTalkComponent::BeginPlay()
{
    Super::BeginPlay();

    if (UMedSimApiSubsystem* ApiSubsystem = ResolveApiSubsystem())
    {
        ApiSubsystem->OnAudioTurnCompleted.AddDynamic(this, &UMedSimPushToTalkComponent::HandleAudioTurnCompleted);
        ApiSubsystem->OnRequestError.AddDynamic(this, &UMedSimPushToTalkComponent::HandleRequestError);
    }
}

void UMedSimPushToTalkComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (UMedSimApiSubsystem* ApiSubsystem = ResolveApiSubsystem())
    {
        ApiSubsystem->OnAudioTurnCompleted.RemoveDynamic(this, &UMedSimPushToTalkComponent::HandleAudioTurnCompleted);
        ApiSubsystem->OnRequestError.RemoveDynamic(this, &UMedSimPushToTalkComponent::HandleRequestError);
    }

    Super::EndPlay(EndPlayReason);
}

void UMedSimPushToTalkComponent::StartRecording()
{
    BufferedSamples.Reset();
    bPendingSend = false;
    PendingEncounterId.Reset();
    bIsRecording = true;
    OnRecordingStarted.Broadcast();
}

void UMedSimPushToTalkComponent::CancelRecording()
{
    bIsRecording = false;
    bPendingSend = false;
    PendingEncounterId.Reset();
    BufferedSamples.Reset();
}

void UMedSimPushToTalkComponent::AddPcm16Samples(const TArray<int16>& InSamples)
{
    if (!bIsRecording || InSamples.Num() == 0)
    {
        return;
    }

    BufferedSamples.Append(InSamples);
}

void UMedSimPushToTalkComponent::AddSinglePcm16Sample(int32 Sample)
{
    if (!bIsRecording)
    {
        return;
    }

    const int16 Clamped = static_cast<int16>(FMath::Clamp(Sample, -32768, 32767));
    BufferedSamples.Add(Clamped);
}

void UMedSimPushToTalkComponent::StopRecording()
{
    if (!bIsRecording)
    {
        return;
    }

    bIsRecording = false;
    OnRecordingStopped.Broadcast(BufferedSamples.Num());
}

void UMedSimPushToTalkComponent::StopRecordingAndSend(const FString& EncounterId)
{
    StopRecording();

    if (EncounterId.IsEmpty())
    {
        OnPushToTalkError.Broadcast(TEXT("EncounterId vacio"));
        return;
    }

    if (BufferedSamples.Num() == 0)
    {
        OnPushToTalkError.Broadcast(TEXT("No hay muestras de audio para enviar"));
        return;
    }

    UMedSimApiSubsystem* ApiSubsystem = ResolveApiSubsystem();
    if (!ApiSubsystem)
    {
        OnPushToTalkError.Broadcast(TEXT("No se encontro MedSimApiSubsystem"));
        return;
    }

    const TArray<uint8> WavBytes = UMedSimWavLibrary::BuildWavFromPcm16Mono(BufferedSamples, SampleRate);
    bPendingSend = true;
    PendingEncounterId = EncounterId;
    OnAudioQueued.Broadcast(WavBytes.Num());
    ApiSubsystem->SendWavAudioTurn(EncounterId, WavBytes, DefaultFileName);
}

void UMedSimPushToTalkComponent::StopRecordingAndSendUsingConversation(UMedSimConversationComponent* ConversationComponent)
{
    if (!ConversationComponent)
    {
        OnPushToTalkError.Broadcast(TEXT("ConversationComponent invalido"));
        return;
    }

    StopRecording();

    if (BufferedSamples.Num() == 0)
    {
        OnPushToTalkError.Broadcast(TEXT("No hay muestras de audio para enviar"));
        return;
    }

    const TArray<uint8> WavBytes = UMedSimWavLibrary::BuildWavFromPcm16Mono(BufferedSamples, SampleRate);
    bPendingSend = true;
    PendingEncounterId = ConversationComponent->GetActiveEncounterId();
    OnAudioQueued.Broadcast(WavBytes.Num());
    ConversationComponent->SendWavToActiveEncounter(WavBytes, DefaultFileName);
}

void UMedSimPushToTalkComponent::ClearBufferedSamples()
{
    BufferedSamples.Reset();
}

bool UMedSimPushToTalkComponent::IsRecording() const
{
    return bIsRecording;
}

int32 UMedSimPushToTalkComponent::GetBufferedSampleCount() const
{
    return BufferedSamples.Num();
}

TArray<int16> UMedSimPushToTalkComponent::GetBufferedSamplesCopy() const
{
    return BufferedSamples;
}

UMedSimApiSubsystem* UMedSimPushToTalkComponent::ResolveApiSubsystem()
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

void UMedSimPushToTalkComponent::HandleAudioTurnCompleted(const FMedSimAudioTurnResponse& Response)
{
    if (!bPendingSend)
    {
        return;
    }

    if (!PendingEncounterId.IsEmpty() && Response.EncounterId != PendingEncounterId)
    {
        return;
    }

    bPendingSend = false;
    PendingEncounterId.Reset();
    OnAudioTurnReady.Broadcast(Response);
}

void UMedSimPushToTalkComponent::HandleRequestError(const FString& ErrorMessage)
{
    if (bPendingSend)
    {
        bPendingSend = false;
        PendingEncounterId.Reset();
        OnPushToTalkError.Broadcast(ErrorMessage);
    }
}
