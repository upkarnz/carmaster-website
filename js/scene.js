/* ============================================================
   Carmaster 3D hero — full car model showroom
   BMW multi-part GLB assembly, self-hosted from
   github.com/anselumjuju/bmw-config. Slow turntable, mouse
   parallax, scroll-driven rotation, soft contact shadow,
   amber showroom ring.
   ============================================================ */
import * as THREE from "three";
import { GLTFLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "https://unpkg.com/three@0.160.0/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "https://unpkg.com/three@0.160.0/examples/jsm/environments/RoomEnvironment.js";

const canvas = document.getElementById("scene");
const fallback = document.getElementById("fallback");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);

function showFallback() {
  if (canvas) canvas.style.display = "none";
  if (fallback) fallback.classList.add("is-active");
}

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isMobile,
    alpha: true,
    powerPreference: "high-performance",
  });
} catch (err) {
  showFallback();
  throw err;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0a0a0d, 0.035); // fade to dark page

// Metals & carpaint need reflections — generated studio env, no HDR download
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
camera.position.set(0, 1.4, 11);

/* ---------------- lighting ---------------- */
scene.add(new THREE.AmbientLight(0x2a2a30, 0.55)); // dim ambient for dark showroom

const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(5, 8, 6);
scene.add(key);

const amberRim = new THREE.PointLight(0xe2233a, 65, 40); // red showroom rim light
amberRim.position.set(-6, 3, -5);
scene.add(amberRim);

const coolFill = new THREE.PointLight(0x8a1a26, 20, 30);
coolFill.position.set(6, -2, 4);
scene.add(coolFill);

/* ---------------- materials (brand showroom spec) ---------------- */
const bodyMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x2a2c30,            // dark metallic carpaint
  metalness: 0.9,
  roughness: 0.4,
  clearcoat: 1.0,
  clearcoatRoughness: 0.03,
});
const glassMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x0c0e11,            // dark tinted glass
  metalness: 0.25,
  roughness: 0.05,
  transparent: true,
  opacity: 0.92,
});

/* ---------------- car group + podium ---------------- */
const carGroup = new THREE.Group();
scene.add(carGroup);

// Red showroom ring under the car
const ring = new THREE.Mesh(
  new THREE.TorusGeometry(3.1, 0.025, 12, 96),
  new THREE.MeshStandardMaterial({
    color: 0xe2233a,
    emissive: 0xe2233a,
    emissiveIntensity: 1.6,
    roughness: 0.4,
  })
);
ring.rotation.x = Math.PI / 2;
ring.position.y = 0.015;
carGroup.add(ring);

// Soft radial contact shadow (canvas-generated, no texture download)
const shadowCanvas = document.createElement("canvas");
shadowCanvas.width = shadowCanvas.height = 256;
const sctx = shadowCanvas.getContext("2d");
const grad = sctx.createRadialGradient(128, 128, 20, 128, 128, 128);
grad.addColorStop(0, "rgba(0,0,0,0.85)");
grad.addColorStop(1, "rgba(0,0,0,0)");
sctx.fillStyle = grad;
sctx.fillRect(0, 0, 256, 256);
const shadowTex = new THREE.CanvasTexture(shadowCanvas);
const contactShadow = new THREE.Mesh(
  new THREE.PlaneGeometry(6.5, 6.5),
  new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
);
contactShadow.rotation.x = -Math.PI / 2;
contactShadow.position.y = 0.01;
contactShadow.renderOrder = 1;
carGroup.add(contactShadow);

/* ---------------- load the car (BMW, 15-part assembly) ----------------
   Model: github.com/anselumjuju/bmw-config — the car ships as separate
   part GLBs (body, frame, tyres, rims…) that share one coordinate
   space. We load them all into one group, then auto-fit: orient the
   long axis along X, sit it on the ground and normalise the size.   */
const manager = new THREE.LoadingManager();
manager.onError = showFallback;

// Parts use two compression schemes: body/rims are Draco, the rest Meshopt
const draco = new DRACOLoader(manager);
draco.setDecoderPath("https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/gltf/");

const loader = new GLTFLoader(manager);
loader.setDRACOLoader(draco);
loader.setMeshoptDecoder(MeshoptDecoder);

let carLoaded = false;
const carModel = new THREE.Group();

const PARTS = [
  "body", "frame", "tyre", "rim1", "brakedisc", "calipers",
  "exhaust", "exhaustcover", "headlightglasses", "headlights",
  "logos", "numberplate", "taillight", "undertray", "window",
];

// Custom number-plate texture — the model's plate is blank geometry,
// so we paint "202102" onto its white base panel.
const PLATE_TEXT = "202102";
function makePlateTexture(text) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const x = c.getContext("2d");
  x.fillStyle = "#f4f6f8";
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = "#10151b";
  x.font = 'bold 88px "Space Grotesk", Arial, sans-serif';
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(text, c.width / 2, c.height / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.flipY = false;             // glTF UV convention
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
PARTS.forEach(function (name) {
  loader.load("assets/bmw/" + name + ".glb", function (gltf) {
    const part = gltf.scene;
    if (name === "body") {
      part.traverse(function (o) { if (o.isMesh) o.material = bodyMaterial; });
    }
    if (name === "window" || name === "headlightglasses") {
      part.traverse(function (o) { if (o.isMesh) o.material = glassMaterial; });
    }
    if (name === "numberplate") {
      // The model plate spells "JJA434" in 3D letter geometry, so we
      // hide it and lay our own "202102" plate over the same spot.
      part.updateWorldMatrix(true, true);
      const pbox = new THREE.Box3().setFromObject(part);
      if (!pbox.isEmpty()) {
        const psize = pbox.getSize(new THREE.Vector3());
        const pcenter = pbox.getCenter(new THREE.Vector3());
        part.visible = false;

        // Smallest extent = the axis the plate faces
        const axes = [["x", psize.x], ["y", psize.y], ["z", psize.z]]
          .sort(function (a, b) { return a[1] - b[1]; });
        const faceAxis = axes[0][0];
        const depth = axes[0][1];
        const w = axes[2][1];
        const h = axes[1][1];

        const t = makePlateTexture(PLATE_TEXT);
        t.flipY = true; // PlaneGeometry convention
        const plate = new THREE.Mesh(
          new THREE.PlaneGeometry(w * 1.02, h * 1.02),
          new THREE.MeshStandardMaterial({
            map: t, roughness: 0.5, metalness: 0.0, side: THREE.DoubleSide,
          })
        );
        plate.position.copy(pcenter);
        const sign = Math.sign(pcenter[faceAxis]) || -1;
        plate.position[faceAxis] += sign * (depth / 2 + 0.004);
        if (faceAxis === "z") plate.rotation.y = sign < 0 ? Math.PI : 0;
        else if (faceAxis === "x") plate.rotation.y = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
        else plate.rotation.x = sign > 0 ? -Math.PI / 2 : Math.PI / 2;
        carModel.add(plate);
      }
    }
    carModel.add(part);
  }, undefined, showFallback);
});

function finalizeCar() {
  // Long axis along X (matches the turntable staging)
  let box = new THREE.Box3().setFromObject(carModel);
  const size = box.getSize(new THREE.Vector3());
  if (size.z > size.x) carModel.rotation.y = Math.PI / 2;

  // Re-measure after rotation: centre on origin, wheels on the ground
  box = new THREE.Box3().setFromObject(carModel);
  const center = box.getCenter(new THREE.Vector3());
  carModel.position.x -= center.x;
  carModel.position.z -= center.z;
  carModel.position.y -= box.min.y;

  // Normalise footprint to ~4.6 units long, like the previous model
  const scale = 4.6 / Math.max(size.x, size.z);
  const wrap = new THREE.Group();
  wrap.scale.setScalar(scale);
  wrap.add(carModel);
  carGroup.add(wrap);

  carLoaded = true;
  carGroup.scale.setScalar(0.001); // entrance: scale up from tiny
}

/* ---------------- particles (workshop dust) ---------------- */
const COUNT = isMobile ? 80 : 200;
const positions = new Float32Array(COUNT * 3);
for (let i = 0; i < COUNT; i++) {
  positions[i * 3] = (Math.random() - 0.5) * 26;
  positions[i * 3 + 1] = Math.random() * 8;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 16 - 2;
}
const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
const particles = new THREE.Points(
  particleGeo,
  new THREE.PointsMaterial({
    color: 0xe2233a,
    size: 0.04,
    transparent: true,
    opacity: 0.5,
    sizeAttenuation: true,
    depthWrite: false,
  })
);
scene.add(particles);

/* ---------------- responsive layout ---------------- */
let targetScale = 1;
function layout() {
  const w = canvas.parentElement.clientWidth;
  const h = canvas.parentElement.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  if (w > 980) {
    carGroup.position.set(2.7, -1.45, 0.5);
    targetScale = 1.12;
  } else if (w > 640) {
    carGroup.position.set(0, 0.6, -1.5);
    targetScale = 0.85;
  } else {
    // Mobile: the canvas is now its own fixed-height block below the
    // hero text (see the @media rule on .hero__canvas-wrap), not an
    // overlay fighting for space with it — so the car just needs to
    // sit centered and well-framed within that shorter box.
    carGroup.position.set(0, 0.05, -0.4);
    targetScale = 1.35;
  }
}
layout();
window.addEventListener("resize", layout);

/* ---------------- interaction ---------------- */
let mouseX = 0;
let mouseY = 0;
let scrollT = 0;

window.addEventListener("pointermove", (e) => {
  mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
  mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
}, { passive: true });

window.addEventListener("scroll", () => {
  scrollT = window.scrollY / window.innerHeight;
}, { passive: true });

/* ---------------- render loop ---------------- */
const clock = new THREE.Clock();
let heroVisible = true;

new IntersectionObserver(([entry]) => {
  heroVisible = entry.isIntersecting;
}, { threshold: 0 }).observe(canvas.parentElement);

const BASE_YAW = 2.55; // 3/4 front view

function tick() {
  requestAnimationFrame(tick);
  if (!heroVisible) return;

  const t = clock.getElapsedTime();

  if (!prefersReducedMotion) {
    // Turntable: slow idle spin + scroll-driven rotation + mouse steer
    carGroup.rotation.y = BASE_YAW + t * 0.12 + scrollT * Math.PI * 0.9 + mouseX * 0.18;

    // Entrance scale ease-in after load
    if (carLoaded && carGroup.scale.x < targetScale) {
      carGroup.scale.addScalar((targetScale - carGroup.scale.x) * 0.08);
    } else if (carLoaded) {
      carGroup.scale.setScalar(targetScale);
    }

    // Showroom ring pulse
    ring.material.emissiveIntensity = 1.4 + Math.sin(t * 1.6) * 0.5;

    particles.rotation.y = t * 0.015;

    // Camera parallax
    camera.position.x += (mouseX * 0.45 - camera.position.x) * 0.03;
    camera.position.y += (1.4 - mouseY * 0.3 - camera.position.y) * 0.03;
    camera.lookAt(carGroup.position.x * 0.5, 0.1, 0);
  }

  renderer.render(scene, camera);
}

// All parts loaded → assemble, then either animate or render one frame
manager.onLoad = () => {
  finalizeCar();
  if (prefersReducedMotion) {
    carGroup.rotation.y = BASE_YAW;
    carGroup.scale.setScalar(targetScale);
    camera.lookAt(carGroup.position.x * 0.5, 0.1, 0);
    renderer.render(scene, camera);
  }
};

if (!prefersReducedMotion) {
  tick();
}
