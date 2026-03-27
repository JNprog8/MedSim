#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "MedSimWavLibrary.generated.h"

UCLASS()
class MEDSIMUNREAL_API UMedSimWavLibrary : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "MedSim|Audio")
    static TArray<uint8> BuildWavFromPcm16Mono(const TArray<int16>& Samples, int32 SampleRate = 16000);
};
