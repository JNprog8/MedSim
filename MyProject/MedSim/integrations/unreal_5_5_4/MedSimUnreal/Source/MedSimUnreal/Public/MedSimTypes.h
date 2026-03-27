#pragma once

#include "CoreMinimal.h"
#include "MedSimTypes.generated.h"

USTRUCT(BlueprintType)
struct FMedSimApiConfig
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "MedSim")
    FString BaseUrl = TEXT("http://127.0.0.1:8000");

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "MedSim")
    bool bAutoReconnectSocket = true;
};

USTRUCT(BlueprintType)
struct FMedSimStartEncounterRequest
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "MedSim")
    FString PatientId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "MedSim")
    FString StudentId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "MedSim")
    FString EvaluatorName;
};

USTRUCT(BlueprintType)
struct FMedSimStartEncounterResponse
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "MedSim")
    bool bSuccess = false;

    UPROPERTY(BlueprintReadOnly, Category = "MedSim")
    FString EncounterId;

    UPROPERTY(BlueprintReadOnly, Category = "MedSim")
    FString PatientId;

    UPROPERTY(BlueprintReadOnly, Category = "MedSim")
    FString ErrorMessage;
};

USTRUCT(BlueprintType)
struct FMedSimAudioTurnResponse
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "MedSim")
    bool bSuccess = false;

    UPROPERTY(BlueprintReadOnly, Category = "MedSim")
    FString EncounterId;

    UPROPERTY(BlueprintReadOnly, Category = "MedSim")
    FString UserText;

    UPROPERTY(BlueprintReadOnly, Category = "MedSim")
    FString ReplyText;

    UPROPERTY(BlueprintReadOnly, Category = "MedSim")
    FString AssistantAudioUrl;

    UPROPERTY(BlueprintReadOnly, Category = "MedSim")
    FString AssistantAudioBase64;

    UPROPERTY(BlueprintReadOnly, Category = "MedSim")
    FString AssistantAudioContentType;

    UPROPERTY(BlueprintReadOnly, Category = "MedSim")
    FString ErrorMessage;
};

USTRUCT(BlueprintType)
struct FMedSimChatTurnRequest
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "MedSim")
    FString EncounterId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "MedSim")
    FString Message;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "MedSim")
    bool bIncludeTts = true;
};

USTRUCT(BlueprintType)
struct FMedSimRealtimeEvent
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "MedSim")
    FString Type;

    UPROPERTY(BlueprintReadOnly, Category = "MedSim")
    FString EncounterId;

    UPROPERTY(BlueprintReadOnly, Category = "MedSim")
    FString RawJson;
};
