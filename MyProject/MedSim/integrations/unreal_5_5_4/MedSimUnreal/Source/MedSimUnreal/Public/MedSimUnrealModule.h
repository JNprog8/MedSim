#pragma once

#include "Modules/ModuleManager.h"

class FMedSimUnrealModule : public IModuleInterface
{
public:
    virtual void StartupModule() override;
    virtual void ShutdownModule() override;
};
