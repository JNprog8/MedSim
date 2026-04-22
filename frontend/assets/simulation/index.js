import { getPatientDefinition, defaultPatientId } from "./config/patientDefinitions.js";
import { defaultPatientState, patientStates } from "./config/patientStates.js";
import { PatientAvatar } from "./patient/PatientAvatar.js";
import { SimulationScene } from "./scene/SimulationScene.js";

const sceneContainer = document.querySelector("[data-simulation-scene]");
const debugPatient = document.querySelector("[data-debug-patient]");
const debugAsset = document.querySelector("[data-debug-asset]");
const debugStatus = document.querySelector("[data-debug-status]");
const debugError = document.querySelector("[data-debug-error]");
const debugAnimations = document.querySelector("[data-debug-animations]");
const debugClipNames = document.querySelector("[data-debug-clip-names]");
const debugActiveClip = document.querySelector("[data-debug-active-clip]");
const debugPatientState = document.querySelector("[data-debug-patient-state]");
const debugResolvedClip = document.querySelector("[data-debug-resolved-clip]");
const debugResolvedAsset = document.querySelector("[data-debug-resolved-asset]");
const debugAnimationAdjustments = document.querySelector("[data-debug-animation-adjustments]");
const debugFallback = document.querySelector("[data-debug-fallback]");
const debugCamera = document.querySelector("[data-debug-camera]");
const stateSelector = document.querySelector("[data-state-selector]");
const clipSelector = document.querySelector("[data-animation-selector]");

function setDebugState({
  patient,
  status,
  error = "",
  animationCount = null,
  clipNames = null,
  activeClip = null,
  patientState = defaultPatientState,
  resolvedClip = null,
  resolvedAsset = null,
  animationAdjustments = null,
  fallback = null,
  camera = null,
}) {
  debugPatient.textContent = patient?.patientId || "Sin paciente";
  debugAsset.textContent = patient?.modelPath || "Sin asset";
  debugStatus.textContent = status;
  debugStatus.dataset.status = status;
  debugError.textContent = error || "Sin errores";
  debugError.dataset.empty = error ? "false" : "true";
  debugAnimations.textContent =
    animationCount === null ? "Pendiente" : `${animationCount} clip(s) detectado(s)`;
  debugClipNames.textContent = clipNames?.length ? clipNames.join(", ") : "Pendiente";
  debugActiveClip.textContent = activeClip || "Ninguno";
  debugPatientState.textContent = patientState;
  debugResolvedClip.textContent = resolvedClip || "Pendiente";
  debugResolvedAsset.textContent = resolvedAsset || "Pendiente";
  debugAnimationAdjustments.textContent = animationAdjustments
    ? formatAdjustments(animationAdjustments)
    : "Pendiente";
  debugFallback.textContent = fallback?.used
    ? `Si: ${fallback.reason}`
    : "No";
  debugCamera.textContent = camera ? formatCamera(camera) : debugCamera.textContent;
}

function formatAdjustments(adjustments) {
  const offset = adjustments.offset || {};
  return `scale ${offset.scale}; pos [${offset.position?.join(", ") || "0, 0, 0"}]; rot [${offset.rotation?.join(", ") || "0, 0, 0"}]`;
}

function formatCamera(camera) {
  return `pos [${camera.position.join(", ")}]; target [${camera.target.join(", ")}]; dist ${camera.zoomDistance}`;
}

function populateClipSelector(clipNames, activeClip, onSelectClip) {
  clipSelector.innerHTML = "";
  clipSelector.disabled = clipNames.length === 0;

  if (clipNames.length === 0) {
    const option = document.createElement("option");
    option.textContent = "Sin clips disponibles";
    option.value = "";
    clipSelector.append(option);
    return;
  }

  for (const clipName of clipNames) {
    const option = document.createElement("option");
    option.textContent = clipName;
    option.value = clipName;
    option.selected = clipName === activeClip;
    clipSelector.append(option);
  }

  clipSelector.addEventListener("change", () => {
    onSelectClip(clipSelector.value);
  });
}

function syncClipSelector(activeClip) {
  if (activeClip && Array.from(clipSelector.options).some((option) => option.value === activeClip)) {
    clipSelector.value = activeClip;
  }
}

function populateStateSelector(activeState, onSelectState) {
  stateSelector.innerHTML = "";
  stateSelector.disabled = false;

  for (const patientState of patientStates) {
    const option = document.createElement("option");
    option.textContent = patientState;
    option.value = patientState;
    option.selected = patientState === activeState;
    stateSelector.append(option);
  }

  stateSelector.addEventListener("change", () => {
    onSelectState(stateSelector.value);
  });
}

async function bootSimulation() {
  const patient = getPatientDefinition(defaultPatientId);

  setDebugState({
    patient,
    status: "initializing",
  });

  if (!sceneContainer) {
    throw new Error("No se encontro el contenedor de escena del sandbox.");
  }

  if (!patient) {
    setDebugState({
      status: "error",
      error: `No existe configuracion para el paciente ${defaultPatientId}.`,
    });
    return;
  }

  const simulationScene = new SimulationScene();
  simulationScene.mount(sceneContainer);
  simulationScene.onCameraChange((camera) => {
    debugCamera.textContent = formatCamera(camera);
  });
  simulationScene.start();

  try {
    setDebugState({
      patient,
      status: "loading",
    });

    const avatar = new PatientAvatar(patient);
    const loadedAvatar = await avatar.load();

    simulationScene.add(loadedAvatar.object);

    if (loadedAvatar.mixer) {
      simulationScene.addMixer(loadedAvatar.mixer);
    }

    const initialState = patient.defaultAnimation || defaultPatientState;
    const initialResolution = loadedAvatar.animationController.resolveClipForState(
      patient,
      initialState,
    );
    const activeClip = loadedAvatar.animationController.playDefault(initialResolution.resolvedClip);

    populateClipSelector(loadedAvatar.clipNames, activeClip, (clipName) => {
      const nextActiveClip = loadedAvatar.animationController.playClip(clipName);
      setDebugState({
        patient,
        status: "loaded",
        animationCount: loadedAvatar.animationCount,
        clipNames: loadedAvatar.clipNames,
        activeClip: nextActiveClip,
        patientState: stateSelector.value,
        resolvedClip: nextActiveClip,
        resolvedAsset: loadedAvatar.animationController.activeEntry?.file || "Manual",
        animationAdjustments: loadedAvatar.animationController.lastAppliedAdjustments,
        fallback: {
          used: false,
          reason: "Clip elegido manualmente desde debug.",
        },
      });
    });

    populateStateSelector(initialState, (patientState) => {
      const resolution = loadedAvatar.animationController.resolveClipForState(patient, patientState);
      const nextActiveClip = loadedAvatar.animationController.playClip(resolution.resolvedClip);
      syncClipSelector(nextActiveClip);

      setDebugState({
        patient,
        status: "loaded",
        animationCount: loadedAvatar.animationCount,
        clipNames: loadedAvatar.clipNames,
        activeClip: nextActiveClip,
        patientState,
        resolvedClip: resolution.resolvedClip,
        resolvedAsset: resolution.resolvedAsset,
        animationAdjustments: loadedAvatar.animationController.lastAppliedAdjustments,
        fallback: {
          used: resolution.fallbackUsed,
          reason: resolution.fallbackReason,
        },
      });
    });

    setDebugState({
      patient,
      status: "loaded",
      animationCount: loadedAvatar.animationCount,
      clipNames: loadedAvatar.clipNames,
      activeClip,
      patientState: initialState,
      resolvedClip: initialResolution.resolvedClip,
      resolvedAsset: initialResolution.resolvedAsset,
      animationAdjustments: loadedAvatar.animationController.lastAppliedAdjustments,
      fallback: {
        used: initialResolution.fallbackUsed,
        reason: initialResolution.fallbackReason,
      },
    });
  } catch (error) {
    console.error(error);
    setDebugState({
      patient,
      status: "error",
      error: error.message || "Error desconocido al cargar el paciente.",
    });
  }
}

bootSimulation().catch((error) => {
  console.error(error);
  setDebugState({
    status: "error",
    error: error.message || "Error inesperado al iniciar el sandbox.",
  });
});
