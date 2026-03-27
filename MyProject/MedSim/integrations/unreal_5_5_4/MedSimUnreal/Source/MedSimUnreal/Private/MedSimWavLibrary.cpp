#include "MedSimWavLibrary.h"

namespace
{
    template <typename T>
    void AppendValue(TArray<uint8>& Bytes, T Value)
    {
        const uint8* Ptr = reinterpret_cast<const uint8*>(&Value);
        Bytes.Append(Ptr, sizeof(T));
    }

    void AppendAscii(TArray<uint8>& Bytes, const ANSICHAR* Text)
    {
        const int32 Length = FCStringAnsi::Strlen(Text);
        Bytes.Append(reinterpret_cast<const uint8*>(Text), Length);
    }
}

TArray<uint8> UMedSimWavLibrary::BuildWavFromPcm16Mono(const TArray<int16>& Samples, int32 SampleRate)
{
    TArray<uint8> Bytes;

    const int16 NumChannels = 1;
    const int16 BitsPerSample = 16;
    const int32 ByteRate = SampleRate * NumChannels * (BitsPerSample / 8);
    const int16 BlockAlign = NumChannels * (BitsPerSample / 8);
    const int32 DataSize = Samples.Num() * sizeof(int16);
    const int32 ChunkSize = 36 + DataSize;

    Bytes.Reserve(44 + DataSize);

    AppendAscii(Bytes, "RIFF");
    AppendValue<int32>(Bytes, ChunkSize);
    AppendAscii(Bytes, "WAVE");

    AppendAscii(Bytes, "fmt ");
    AppendValue<int32>(Bytes, 16);
    AppendValue<int16>(Bytes, 1);
    AppendValue<int16>(Bytes, NumChannels);
    AppendValue<int32>(Bytes, SampleRate);
    AppendValue<int32>(Bytes, ByteRate);
    AppendValue<int16>(Bytes, BlockAlign);
    AppendValue<int16>(Bytes, BitsPerSample);

    AppendAscii(Bytes, "data");
    AppendValue<int32>(Bytes, DataSize);

    if (Samples.Num() > 0)
    {
        Bytes.Append(reinterpret_cast<const uint8*>(Samples.GetData()), DataSize);
    }

    return Bytes;
}
