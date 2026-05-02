const PATIENT_IDLE_FBX =
  "/frontend-assets/simulation/patients/male-01/animations/patient_sitting_idle.fbx";
const PATIENT_TALKING_FBX =
  "/frontend-assets/simulation/patients/male-01/animations/patient_talking.fbx";

export const patientDefinitions = [
  {
    patientId: "male-01",
    displayName: "Paciente masculino 01",
    gender: "male",
    modelPath: PATIENT_IDLE_FBX,
    animations: {
      idle: {
        file: PATIENT_IDLE_FBX,
        preferredClip: null,
        visualAdjustments: {
          scale: 1,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
        },
      },
      talking: {
        file: PATIENT_TALKING_FBX,
        preferredClip: null,
        visualAdjustments: {
          scale: 1,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
        },
      },
    },
    stateClipMap: {
      idle: "idle",
      listening: "idle",
      thinking: "idle",
      talking: "talking",
    },
    defaultAnimation: "idle",
    voice: {
      provider: "tts",
      voiceId: "male-default",
    },
    visualDefaults: {
      scale: 0.01,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
    },
  },
];

export const defaultPatientId = "male-01";

export function getPatientDefinition(patientId = defaultPatientId) {
  return patientDefinitions.find((patient) => patient.patientId === patientId);
}
