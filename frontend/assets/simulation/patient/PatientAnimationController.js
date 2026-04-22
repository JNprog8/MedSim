import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

export class PatientAnimationController {
  constructor(object, animationEntries = [], visualDefaults = {}) {
    this.object = object;
    this.animationEntries = animationEntries;
    this.clips = animationEntries.map((entry) => entry.clip);
    this.clipNames = animationEntries.map((entry) => entry.label);
    this.mixer = animationEntries.length > 0 ? new THREE.AnimationMixer(object) : null;
    this.activeAction = null;
    this.activeClipName = null;
    this.activeEntry = null;
    this.visualDefaults = visualDefaults;
    this.lastAppliedAdjustments = null;
  }

  hasClips() {
    return this.clips.length > 0;
  }

  playClip(clipName) {
    if (!this.mixer || this.clips.length === 0) {
      this.activeClipName = null;
      return null;
    }

    const entry = this.findEntry(clipName) || this.animationEntries[0];

    if (!entry) {
      this.activeClipName = null;
      this.activeEntry = null;
      return null;
    }

    const clip = entry.clip;
    const nextAction = this.mixer.clipAction(clip);

    if (this.activeAction && this.activeAction !== nextAction) {
      this.activeAction.fadeOut(0.2);
    }

    nextAction.enabled = true;
    nextAction.reset().fadeIn(0.2).play();
    this.activeAction = nextAction;
    this.activeClipName = entry.label;
    this.activeEntry = entry;
    this.applyVisualAdjustments(entry.visualAdjustments);

    return this.activeClipName;
  }

  playDefault(defaultClipName = null) {
    return this.playClip(defaultClipName);
  }

  resolveClipForState(patientDefinition, patientState) {
    const idleAnimationKey = patientDefinition?.stateClipMap?.idle || "idle";
    const stateAnimationKey = patientDefinition?.stateClipMap?.[patientState];
    const requestedAnimationKey = stateAnimationKey || idleAnimationKey;
    const preferredClip = patientDefinition?.animations?.[requestedAnimationKey]?.preferredClip;
    const idlePreferredClip = patientDefinition?.animations?.[idleAnimationKey]?.preferredClip;
    const requestedEntry = this.findEntryForAnimation(requestedAnimationKey, preferredClip);

    if (requestedEntry) {
      const fallbackUsed = patientState !== requestedAnimationKey;

      return {
        patientState,
        requestedAnimationKey,
        requestedClip: requestedEntry.label,
        resolvedAnimationKey: requestedEntry.animationKey,
        resolvedClip: requestedEntry.label,
        resolvedAsset: requestedEntry.file,
        visualAdjustments: requestedEntry.visualAdjustments,
        fallbackUsed,
        fallbackReason: fallbackUsed
          ? `${patientState} usa fallback a ${requestedAnimationKey}.`
          : "",
      };
    }

    const idleEntry = this.findEntryForAnimation(idleAnimationKey, idlePreferredClip);

    if (idleEntry) {
      return {
        patientState,
        requestedAnimationKey: requestedAnimationKey || "No configurado",
        requestedClip: preferredClip || "No configurado",
        resolvedAnimationKey: idleEntry.animationKey,
        resolvedClip: idleEntry.label,
        resolvedAsset: idleEntry.file,
        visualAdjustments: idleEntry.visualAdjustments,
        fallbackUsed: requestedAnimationKey !== idleAnimationKey || Boolean(preferredClip),
        fallbackReason: stateAnimationKey
          ? `La animacion configurada para ${patientState} no esta disponible; se usa idle.`
          : `No hay animacion configurada para ${patientState}; se usa idle.`,
      };
    }

    const firstEntry = this.animationEntries[0] || null;

    return {
      patientState,
      requestedAnimationKey: requestedAnimationKey || idleAnimationKey || "No configurado",
      requestedClip: preferredClip || idlePreferredClip || "No configurado",
      resolvedAnimationKey: firstEntry?.animationKey || null,
      resolvedClip: firstEntry?.label || null,
      resolvedAsset: firstEntry?.file || null,
      visualAdjustments: firstEntry?.visualAdjustments || null,
      fallbackUsed: Boolean(firstEntry),
      fallbackReason: firstEntry
        ? "No existe animacion configurada para el estado ni para idle; se usa el primer clip disponible."
        : "No hay clips disponibles para reproducir.",
    };
  }

  findEntry(label) {
    if (!label) {
      return null;
    }

    return this.animationEntries.find((entry) => entry.label === label);
  }

  findEntryForAnimation(animationKey, preferredClip = null) {
    if (!animationKey) {
      return null;
    }

    const entries = this.animationEntries.filter((entry) => entry.animationKey === animationKey);

    if (preferredClip) {
      return entries.find((entry) => entry.clipName === preferredClip || entry.label === preferredClip) || null;
    }

    return entries[0] || null;
  }

  applyVisualAdjustments(adjustments = {}) {
    const defaults = this.visualDefaults || {};
    const scale = (defaults.scale ?? 1) * (adjustments.scale ?? 1);
    const basePosition = defaults.position || [0, 0, 0];
    const baseRotation = defaults.rotation || [0, 0, 0];
    const positionOffset = adjustments.position || [0, 0, 0];
    const rotationOffset = adjustments.rotation || [0, 0, 0];
    const finalPosition = [
      basePosition[0] + positionOffset[0],
      basePosition[1] + positionOffset[1],
      basePosition[2] + positionOffset[2],
    ];
    const finalRotation = [
      baseRotation[0] + rotationOffset[0],
      baseRotation[1] + rotationOffset[1],
      baseRotation[2] + rotationOffset[2],
    ];

    this.object.scale.setScalar(scale);
    this.object.position.set(finalPosition[0], finalPosition[1], finalPosition[2]);
    this.object.rotation.set(finalRotation[0], finalRotation[1], finalRotation[2]);

    this.lastAppliedAdjustments = {
      scale,
      position: finalPosition,
      rotation: finalRotation,
      offset: {
        scale: adjustments.scale ?? 1,
        position: positionOffset,
        rotation: rotationOffset,
      },
    };
  }
}
