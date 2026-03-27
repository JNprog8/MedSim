#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "MedSimTypes.h"
#include "MedSimPushToTalkComponent.generated.h"

class UMedSimApiSubsystem;
class UMedSimConversationComponent;

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FMedSimPttRecordingStarted);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FMedSimPttRecordingStopped, int32, NumSamples);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FMedSimPttAudioQueued, int32, NumBytes);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FMedSimPttAudioTurnReady, const FMedSimAudioTurnResponse&, Response);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FMedSimPttError, const FString&, ErrorMessage);

UCLASS(ClassGroup=(MedSim), BlueprintType, Blueprintable, meta=(BlueprintSpawnableComponent))
class MEDSIMUNREAL_API UMedSimPushToTalkComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UMedSimPushToTalkComponent();

    UFUNCTION(BlueprintCallable, Category = "MedSim|PushToTalk")
    void StartRecording();

    UFUNCTION(BlueprintCallable, Category = "MedSim|PushToTalk")
    void CancelRecording();

    UFUNCTION(BlueprintCallable, Category = "MedSim|PushToTalk")
    void AddPcm16Samples(const TArray<int16>& InSamples);

    UFUNCTION(BlueprintCallable, Category = "MedSim|PushToTalk")
    void AddSinglePcm16Sample(int32 Sample);

    UFUNCTION(BlueprintCallable, Category = "MedSim|PushToTalk")
    void StopRecording();

    UFUNCTION(BlueprintCallable, Category = "MedSim|PushToTalk")
    void StopRecordingAndSend(const FString& EncounterId);

    UFUNCTION(BlueprintCallable, Category = "MedSim|PushToTalk", meta = (DisplayName = "Stop Recording And Send Using Conversation"))
    void StopRecordingAndSendUsingConversation(UMedSimConversationComponent* ConversationComponent);

    UFUNCTION(BlueprintCallable, Category = "MedSim|PushToTalk")
    void ClearBufferedSamples();

    UFUNCTION(BlueprintPure, Category = "MedSim|PushToTalk")
    bool IsRecording() const;

    UFUNCTION(BlueprintPure, Category = "MedSim|PushToTalk")
    int32 GetBufferedSampleCount() const;

    UFUNCTION(BlueprintPure, Category = "MedSim|PushToTalk")
    TArray<int16> GetBufferedSamplesCopy() const;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "MedSim|PushToTalk")
    int32 SampleRate = 16000;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "MedSim|PushToTalk")
    FString DefaultFileName = TEXT("speech.wav");

    UPROPERTY(BlueprintAssignable, Category = "MedSim|PushToTalk")
    FMedSimPttRecordingStarted OnRecordingStarted;

    UPROPERTY(BlueprintAssignable, Category = "MedSim|PushToTalk")
    FMedSimPttRecordingStopped OnRecordingStopped;

    UPROPERTY(BlueprintAssignable, Category = "MedSim|PushToTalk")
    FMedSimPttAudioQueued OnAudioQueued;

    UPROPERTY(BlueprintAssignable, Category = "MedSim|PushToTalk")
    FMedSimPttAudioTurnReady OnAudioTurnReady;

    UPROPERTY(BlueprintAssignable, Category = "MedSim|PushToTalk")
    FMedSimPttError OnPushToTalkError;

protected:
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
    bool bIsRecording = false;
    bool bPendingSend = false;
    FString PendingEncounterId;
    TArray<int16> BufferedSamples;
    TWeakObjectPtr<UMedSimApiSubsystem> CachedSubsystem;

    UMedSimApiSubsystem* ResolveApiSubsystem();
    UFUNCTION()
    void HandleAudioTurnCompleted(const FMedSimAudioTurnResponse& Response);
    UFUNCTION()
    void HandleRequestError(const FString& ErrorMessage);
};
