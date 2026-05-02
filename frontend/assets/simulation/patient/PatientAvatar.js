import { PatientAnimationController } from "./PatientAnimationController.js";
import { PatientModelLoader } from "./PatientModelLoader.js";

export class PatientAvatar {
  constructor(patientDefinition) {
    this.patientDefinition = patientDefinition;
    this.loader = new PatientModelLoader();
    this.object = null;
    this.animationController = null;
  }

  async load() {
    const { modelPath, visualDefaults } = this.patientDefinition;
    const loadedModel = await this.loader.load(modelPath);

    this.object = loadedModel.object;
    this.applyVisualDefaults(visualDefaults);
    this.prepareMaterials(this.object);
    const animationEntries = await this.loadAnimationEntries(loadedModel);
    this.animationController = new PatientAnimationController(
      this.object,
      animationEntries,
      visualDefaults,
    );

    return {
      object: this.object,
      mixer: this.animationController.mixer,
      animationController: this.animationController,
      animationCount: animationEntries.length,
      clipNames: this.animationController.clipNames,
    };
  }

  async loadAnimationEntries(baseModel) {
    const entries = [];
    const loadedByFile = new Map([[this.patientDefinition.modelPath, baseModel]]);
    const animations = this.patientDefinition.animations || {};

    for (const [animationKey, animationDefinition] of Object.entries(animations)) {
      const file = animationDefinition.file;

      if (!file) {
        continue;
      }

      let loadedAnimation = loadedByFile.get(file);

      if (!loadedAnimation) {
        loadedAnimation = await this.loader.load(file);
        loadedByFile.set(file, loadedAnimation);
      }

      for (const [index, clip] of loadedAnimation.animations.entries()) {
        const clipName = clip.name || `Clip ${index + 1}`;

        entries.push({
          animationKey,
          file,
          clip,
          clipName,
          label: `${animationKey}: ${clipName}`,
          visualAdjustments: animationDefinition.visualAdjustments || {},
        });
      }
    }

    return entries;
  }

  applyVisualDefaults(visualDefaults) {
    const { scale, position, rotation } = visualDefaults;

    this.object.scale.setScalar(scale);
    this.object.position.set(position[0], position[1], position[2]);
    this.object.rotation.set(rotation[0], rotation[1], rotation[2]);
  }

  prepareMaterials(object) {
    object.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.frustumCulled = false;
      }
    });
  }
}
