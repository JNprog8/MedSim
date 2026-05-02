import { FBXLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/FBXLoader.js";

export class PatientModelLoader {
  constructor() {
    this.loader = new FBXLoader();
  }

  load(path) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        path,
        (object) => {
          resolve({
            object,
            animations: object.animations || [],
          });
        },
        undefined,
        (error) => {
          reject(new Error(error?.message || `No se pudo cargar el FBX: ${path}`));
        },
      );
    });
  }
}
