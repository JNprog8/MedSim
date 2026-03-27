#include "MedSimAudioDownloadComponent.h"

#include "HttpModule.h"
#include "HttpResponseCodes.h"
#include "Interfaces/IHttpResponse.h"

void UMedSimAudioDownloadComponent::DownloadAudio(const FString& AudioUrl)
{
    if (AudioUrl.IsEmpty())
    {
        OnAudioDownloadFailed.Broadcast(TEXT("AudioUrl vacia"));
        return;
    }

    TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Request = FHttpModule::Get().CreateRequest();
    Request->SetURL(AudioUrl);
    Request->SetVerb(TEXT("GET"));
    Request->OnProcessRequestComplete().BindUObject(this, &UMedSimAudioDownloadComponent::HandleAudioResponse);
    Request->ProcessRequest();
}

void UMedSimAudioDownloadComponent::HandleAudioResponse(FHttpRequestPtr Request, FHttpResponsePtr Response, bool bWasSuccessful)
{
    if (!bWasSuccessful || !Response.IsValid())
    {
        OnAudioDownloadFailed.Broadcast(TEXT("No hubo respuesta al descargar audio"));
        return;
    }

    if (!EHttpResponseCodes::IsOk(Response->GetResponseCode()))
    {
        OnAudioDownloadFailed.Broadcast(Response->GetContentAsString());
        return;
    }

    const TArray<uint8>& AudioBytes = Response->GetContent();
    const FString ContentType = Response->GetHeader(TEXT("Content-Type"));
    OnAudioDownloaded.Broadcast(AudioBytes, ContentType);
}
