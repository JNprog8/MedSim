#include "MedSimMultipartBuilder.h"

FMedSimMultipartBuilder::FMedSimMultipartBuilder()
{
    Boundary = FString::Printf(TEXT("----MedSimBoundary%08x%08x"), FMath::Rand(), FMath::Rand());
}

void FMedSimMultipartBuilder::AddFormField(const FString& Name, const FString& Value)
{
    FPart Part;
    Part.Headers = FString::Printf(
        TEXT("--%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n"),
        *Boundary,
        *Name
    );

    FTCHARToUTF8 Converter(*Value);
    Part.Data.Append(reinterpret_cast<const uint8*>(Converter.Get()), Converter.Length());
    Parts.Add(MoveTemp(Part));
}

void FMedSimMultipartBuilder::AddFileField(const FString& Name, const FString& FileName, const FString& ContentType, const TArray<uint8>& Data)
{
    FPart Part;
    Part.Headers = FString::Printf(
        TEXT("--%s\r\nContent-Disposition: form-data; name=\"%s\"; filename=\"%s\"\r\nContent-Type: %s\r\n\r\n"),
        *Boundary,
        *Name,
        *FileName,
        *ContentType
    );
    Part.Data = Data;
    Parts.Add(MoveTemp(Part));
}

FString FMedSimMultipartBuilder::GetBoundary() const
{
    return Boundary;
}

void FMedSimMultipartBuilder::Build(TArray<uint8>& OutPayload) const
{
    OutPayload.Reset();

    for (const FPart& Part : Parts)
    {
        FTCHARToUTF8 HeaderUtf8(*Part.Headers);
        OutPayload.Append(reinterpret_cast<const uint8*>(HeaderUtf8.Get()), HeaderUtf8.Length());
        OutPayload.Append(Part.Data);
        const char* Separator = "\r\n";
        OutPayload.Append(reinterpret_cast<const uint8*>(Separator), 2);
    }

    const FString EndBoundary = FString::Printf(TEXT("--%s--\r\n"), *Boundary);
    FTCHARToUTF8 EndUtf8(*EndBoundary);
    OutPayload.Append(reinterpret_cast<const uint8*>(EndUtf8.Get()), EndUtf8.Length());
}
