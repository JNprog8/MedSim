#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "Interfaces/IHttpRequest.h"
#include "IWebSocket.h"
#include "MedSimTypes.h"
#include "MedSimApiSubsystem.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FMedSimEncounterStarted, const FMedSimStartEncounterResponse&, Response);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FMedSimAudioTurnCompleted, const FMedSimAudioTurnResponse&, Response);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FMedSimChatTurnCompleted, const FMedSimAudioTurnResponse&, Response);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FMedSimRealtimeMessage, const FMedSimRealtimeEvent&, Event);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FMedSimRequestError, const FString&, ErrorMessage);

UCLASS(BlueprintType)
class MEDSIMUNREAL_API UMedSimApiSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    virtual void Deinitialize() override;

    UFUNCTION(BlueprintCallable, Category = "MedSim")
    void ConfigureApi(const FMedSimApiConfig& InConfig);

    UFUNCTION(BlueprintPure, Category = "MedSim")
    FMedSimApiConfig GetApiConfig() const;

    UFUNCTION(BlueprintCallable, Category = "MedSim")
    void StartEncounter(const FMedSimStartEncounterRequest& Request);

    UFUNCTION(BlueprintCallable, Category = "MedSim")
    void SendChatTurn(const FMedSimChatTurnRequest& Request);

    UFUNCTION(BlueprintCallable, Category = "MedSim")
    void SendWavAudioTurn(const FString& EncounterId, const TArray<uint8>& WavBytes, const FString& FileName = TEXT("speech.wav"));

    UFUNCTION(BlueprintCallable, Category = "MedSim")
    void ConnectEncounterSocket(const FString& EncounterId);

    UFUNCTION(BlueprintCallable, Category = "MedSim")
    void DisconnectEncounterSocket();

    UFUNCTION(BlueprintPure, Category = "MedSim")
    bool IsSocketConnected() const;

    UPROPERTY(BlueprintAssignable, Category = "MedSim")
    FMedSimEncounterStarted OnEncounterStarted;

    UPROPERTY(BlueprintAssignable, Category = "MedSim")
    FMedSimAudioTurnCompleted OnAudioTurnCompleted;

    UPROPERTY(BlueprintAssignable, Category = "MedSim")
    FMedSimChatTurnCompleted OnChatTurnCompleted;

    UPROPERTY(BlueprintAssignable, Category = "MedSim")
    FMedSimRealtimeMessage OnRealtimeMessage;

    UPROPERTY(BlueprintAssignable, Category = "MedSim")
    FMedSimRequestError OnRequestError;

private:
    FMedSimApiConfig Config;
    FString ActiveEncounterId;
    TSharedPtr<IWebSocket> Socket;

    FString BuildApiUrl(const FString& Path) const;
    FString BuildWsUrl(const FString& EncounterId) const;
    FString NormalizeAudioUrl(const FString& MaybeRelativeUrl) const;
    void BroadcastError(const FString& ErrorMessage);

    FMedSimAudioTurnResponse ParseAudioTurnResponse(const FString& ResponseText, bool bWasSuccessful) const;
    void BindSocketHandlers(const FString& EncounterId);

    void HandleStartEncounterResponse(FHttpRequestPtr Request, FHttpResponsePtr Response, bool bWasSuccessful);
    void HandleChatTurnResponse(FHttpRequestPtr Request, FHttpResponsePtr Response, bool bWasSuccessful);
    void HandleAudioTurnResponse(FHttpRequestPtr Request, FHttpResponsePtr Response, bool bWasSuccessful);
};
