#pragma once

#include "CoreMinimal.h"

class MEDSIMUNREAL_API FMedSimMultipartBuilder
{
public:
    FMedSimMultipartBuilder();

    void AddFormField(const FString& Name, const FString& Value);
    void AddFileField(const FString& Name, const FString& FileName, const FString& ContentType, const TArray<uint8>& Data);

    FString GetBoundary() const;
    void Build(TArray<uint8>& OutPayload) const;

private:
    struct FPart
    {
        FString Headers;
        TArray<uint8> Data;
    };

    FString Boundary;
    TArray<FPart> Parts;
};
