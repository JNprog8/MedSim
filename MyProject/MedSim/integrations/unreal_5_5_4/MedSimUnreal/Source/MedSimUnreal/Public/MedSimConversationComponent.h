#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "MedSimTypes.h"
#include "MedSimConversationComponent.generated.h"

class UMedSimApiSubsystem;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FMedSimConversationConfigured, const FMedSimApiConfig&, Config);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FMedSimConversationEncounterStarted, const FMedSimStartEncounterResponse&, Response);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FMedSimConversationChatReply, const FMedSimAudioTurnResponse&, Response);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FMedSimConversationAudioReply, const FMedSimAudioTurnResponse&, Response);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FMedSimConversationRealtimeEvent, const FMedSimRealtimeEvent&, Event);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FMedSimConversationError, const FString&, ErrorMessage);

UCLASS(ClassGroup=(MedSim), BlueprintType, Blueprintable, meta=(BlueprintSpawnableComponent))
class MEDSIMUNREAL_API UMedSimConversationComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UMedSimConversationComponent();

    UFUNCTION(BlueprintCallable, Category = "MedSim|Conversation", meta = (DisplayName = "Configure MedSim API"))
    void ConfigureApi(const FMedSimApiConfig& InConfig);

    UFUNCTION(BlueprintCallable, Category = "MedSim|Conversation", meta = (DisplayName = "Start Conversation Encounter"))
    void StartConversationEncounter(const FMedSimStartEncounterRequest& Request);

    UFUNCTION(BlueprintCallable, Category = "MedSim|Conversation", meta = (DisplayName = "Connect Realtime For Active Encounter"))
    void ConnectRealtimeForActiveEncounter();

    UFUNCTION(BlueprintCallable, Category = "MedSim|Conversation", meta = (DisplayName = "Disconnect Realtime"))
    void DisconnectRealtime();

    UFUNCTION(BlueprintCallable, Category = "MedSim|Conversation", meta = (DisplayName = "Send Text To Active Encounter"))
    void SendTextToActiveEncounter(const FString& Message, bool bIncludeTts = true);

    UFUNCTION(BlueprintCallable, Category = "MedSim|Conversation", meta = (DisplayName = "Send WAV To Active Encounter"))
    void SendWavToActiveEncounter(const TArray<uint8>& WavBytes, const FString& FileName = TEXT("speech.wav"));

    UFUNCTION(BlueprintCallable, Category = "MedSim|Conversation", meta = (DisplayName = "Set Active Encounter Id"))
    void SetActiveEncounterId(const FString& EncounterId);

    UFUNCTION(BlueprintPure, Category = "MedSim|Conversation", meta = (DisplayName = "Get Active Encounter Id"))
    FString GetActiveEncounterId() const;

    UFUNCTION(BlueprintPure, Category = "MedSim|Conversation", meta = (DisplayName = "Has Active Encounter"))
    bool HasActiveEncounter() const;

    UFUNCTION(BlueprintPure, Category = "MedSim|Conversation", meta = (DisplayName = "Get Current API Config"))
    FMedSimApiConfig GetCurrentConfig() const;

    UPROPERTY(BlueprintAssignable, Category = "MedSim|Conversation")
    FMedSimConversationConfigured OnConversationConfigured;

    UPROPERTY(BlueprintAssignable, Category = "MedSim|Conversation")
    FMedSimConversationEncounterStarted OnConversationEncounterStarted;

    UPROPERTY(BlueprintAssignable, Category = "MedSim|Conversation")
    FMedSimConversationChatReply OnConversationChatReply;

    UPROPERTY(BlueprintAssignable, Category = "MedSim|Conversation")
    FMedSimConversationAudioReply OnConversationAudioReply;

    UPROPERTY(BlueprintAssignable, Category = "MedSim|Conversation")
    FMedSimConversationRealtimeEvent OnConversationRealtimeEvent;

    UPROPERTY(BlueprintAssignable, Category = "MedSim|Conversation")
    FMedSimConversationError OnConversationError;

protected:
    virtual void BeginPlay() override;
    virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
    UPROPERTY(VisibleAnywhere, Category = "MedSim|Conversation")
    FString ActiveEncounterId;

    TWeakObjectPtr<UMedSimApiSubsystem> CachedSubsystem;

    UMedSimApiSubsystem* ResolveApiSubsystem();

    UFUNCTION()
    void HandleEncounterStarted(const FMedSimStartEncounterResponse& Response);

    UFUNCTION()
    void HandleChatCompleted(const FMedSimAudioTurnResponse& Response);

    UFUNCTION()
    void HandleAudioCompleted(const FMedSimAudioTurnResponse& Response);

    UFUNCTION()
    void HandleRealtimeEvent(const FMedSimRealtimeEvent& Event);

    UFUNCTION()
    void HandleRequestError(const FString& ErrorMessage);
};
