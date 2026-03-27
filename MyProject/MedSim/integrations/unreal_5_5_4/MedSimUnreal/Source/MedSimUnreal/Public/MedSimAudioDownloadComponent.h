#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Interfaces/IHttpRequest.h"
#include "MedSimAudioDownloadComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FMedSimAudioDownloaded, const TArray<uint8>&, AudioBytes, const FString&, ContentType);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FMedSimAudioDownloadFailed, const FString&, ErrorMessage);

UCLASS(ClassGroup=(MedSim), BlueprintType, Blueprintable, meta=(BlueprintSpawnableComponent))
class MEDSIMUNREAL_API UMedSimAudioDownloadComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "MedSim|Audio")
    void DownloadAudio(const FString& AudioUrl);

    UPROPERTY(BlueprintAssignable, Category = "MedSim|Audio")
    FMedSimAudioDownloaded OnAudioDownloaded;

    UPROPERTY(BlueprintAssignable, Category = "MedSim|Audio")
    FMedSimAudioDownloadFailed OnAudioDownloadFailed;

private:
    void HandleAudioResponse(FHttpRequestPtr Request, FHttpResponsePtr Response, bool bWasSuccessful);
};
