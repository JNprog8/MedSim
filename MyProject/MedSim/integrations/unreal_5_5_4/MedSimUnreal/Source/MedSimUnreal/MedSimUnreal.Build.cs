using UnrealBuildTool;

public class MedSimUnreal : ModuleRules
{
    public MedSimUnreal(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(
            new[]
            {
                "Core",
                "CoreUObject",
                "Engine",
                "DeveloperSettings",
                "HTTP",
                "Json",
                "JsonUtilities",
                "WebSockets"
            }
        );

        PrivateDependencyModuleNames.AddRange(
            new[]
            {
                "Projects"
            }
        );
    }
}
