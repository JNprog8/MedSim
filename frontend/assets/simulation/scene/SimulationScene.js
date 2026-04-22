import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";

export class SimulationScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe9f0f3);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    this.camera.position.set(0, 1.6, 4.2);
    this.camera.lookAt(0, 1, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.clock = new THREE.Clock();
    this.mixers = [];
    this.container = null;
    this.controls = null;
    this.frameId = null;
    this.cameraChangeCallback = null;
    this.preventContextMenu = (event) => event.preventDefault();

    this.resize = this.resize.bind(this);
    this.render = this.render.bind(this);
    this.emitCameraChange = this.emitCameraChange.bind(this);

    this.setupLights();
    this.setupReferenceFloor();
  }

  mount(container) {
    this.container = container;
    this.container.innerHTML = "";
    this.container.appendChild(this.renderer.domElement);
    this.setupControls();
    window.addEventListener("resize", this.resize);
    this.resize();
  }

  add(object) {
    this.scene.add(object);
  }

  addMixer(mixer) {
    this.mixers.push(mixer);
  }

  onCameraChange(callback) {
    this.cameraChangeCallback = callback;
    this.emitCameraChange();
  }

  getCameraDebugInfo() {
    const target = this.controls?.target || new THREE.Vector3(0, 1, 0);

    return {
      position: this.camera.position.toArray().map((value) => Number(value.toFixed(2))),
      target: target.toArray().map((value) => Number(value.toFixed(2))),
      zoomDistance: Number(this.camera.position.distanceTo(target).toFixed(2)),
    };
  }

  start() {
    if (!this.frameId) {
      this.render();
    }
  }

  dispose() {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    window.removeEventListener("resize", this.resize);
    this.renderer.domElement.removeEventListener("contextmenu", this.preventContextMenu);
    this.controls?.dispose();
    this.renderer.dispose();
  }

  setupLights() {
    const ambientLight = new THREE.HemisphereLight(0xffffff, 0x8aa0aa, 1.7);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(3, 5, 4);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xbdd8ff, 0.9);
    fillLight.position.set(-3, 2, 2);
    this.scene.add(fillLight);
  }

  setupReferenceFloor() {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.9, 48),
      new THREE.MeshStandardMaterial({
        color: 0xd5e0e5,
        roughness: 0.85,
        metalness: 0,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    this.scene.add(floor);
  }

  setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 1.6;
    this.controls.maxDistance = 8;
    this.controls.maxPolarAngle = Math.PI * 0.82;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    this.renderer.domElement.addEventListener("contextmenu", this.preventContextMenu);
    this.controls.addEventListener("change", this.emitCameraChange);
    this.controls.update();
  }

  emitCameraChange() {
    if (this.cameraChangeCallback) {
      this.cameraChangeCallback(this.getCameraDebugInfo());
    }
  }

  resize() {
    if (!this.container) {
      return;
    }

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  render() {
    const delta = this.clock.getDelta();

    for (const mixer of this.mixers) {
      mixer.update(delta);
    }

    this.controls?.update();
    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(this.render);
  }
}
