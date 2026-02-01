import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let currentRenderer;
export function setPerformanceMode(isModalOpen) {
    if (!currentRenderer) return;
    // [사파리 최적화] 모달 오픈 시 픽셀 밀도를 1로 낮춰 부하를 최소화
    const ratio = isModalOpen ? 1 : Math.min(window.devicePixelRatio, 2);
    currentRenderer.setPixelRatio(ratio);
}

let isOpening = true; let openingStartTime = null;
let globalPulseValue = 0;
let targetPulseValue = 0;

const INITIAL_CAM_Z = 2.5; const FINAL_CAM_Z = 45; const ZOOM_DURATION = 4.5;
const COLOR_BLUE = '#0000ff';
let hoveredObject = null; let clickedObject = null;
let isDragging = false;
let selectedGroupForDrag = null;
let potentialObjectForDrag = null;
let mouseDownPosition = { x: 0, y: 0 };
const CLICK_THRESHOLD = 5;

const ORBIT_GROUPS = [
    { radius: 10, planets: ['painting', 'drawing'], speed: 0.003 },
    { radius: 18, planets: ['graphic', 'video', 'web'], speed: 0.006 },
    { radius: 26, planets: ['show', 'construct'], speed: 0.012 }
];

const MODAL_MAP = {
    '정진성': 'profile', 'painting': 'painting', 'drawing': 'drawing',
    'graphic': 'graphic', 'video': 'video', 'web': 'web',
    'construct': 'construct', 'show': 'show'
};

function createDotTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d'); ctx.beginPath(); ctx.arc(32, 32, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'black'; ctx.fill(); return new THREE.CanvasTexture(canvas);
}
const dotTexture = createDotTexture();

function createPlanetMaterials(name, color = 'black', isInverted = false) {
    const fontSize = (name === '정진성') ? 133 : 200;
    const size = 1024; const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size; const ctx = canvas.getContext('2d');

    ctx.beginPath(); ctx.arc(size / 2, size / 2, (size / 2) - 20, 0, Math.PI * 2);
    ctx.fillStyle = isInverted ? color : 'white';
    ctx.fill();

    ctx.lineWidth = (name === '정진성') ? 20 : 30;
    ctx.strokeStyle = color;
    ctx.stroke();

    ctx.fillStyle = isInverted ? 'white' : color;
    ctx.font = `bold ${fontSize}px "nanumgothiccoding"`;
    ctx.textBaseline = 'middle';

    let displayName = name === 'profile' ? '정진성' : name.toLowerCase();
    if (displayName === 'painting') displayName = 'paint-ing';
    if (displayName === 'construct') displayName = 'con-struct';

    if (displayName.includes('-')) {
        const parts = displayName.split('-');
        const line1 = parts[0] + '-'; const line2 = parts[1];
        const maxWidth = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width);
        const startX = (size - maxWidth) / 2;
        ctx.textAlign = 'left';
        ctx.fillText(line1, startX, size / 2 - fontSize * 0.55);
        ctx.fillText(line2, startX, size / 2 + fontSize * 0.55);
    } else {
        ctx.textAlign = 'center'; ctx.fillText(displayName, size / 2, size / 2 + fontSize * 0.05);
    }
    const tex = new THREE.CanvasTexture(canvas); tex.anisotropy = 16;

    return new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        alphaTest: 0.001,
        sizeAttenuation: false
    });
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// [사파리 최적화] 렌더러 설정 강화
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance" // 고성능 모드 명시
});
currentRenderer = renderer;

// [사파리 최적화] 픽셀 밀도를 최대 2로 제한 (사파리의 3~4배 밀도 방지)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
// 투명 물체 정렬 강제 (사파리 겹침 노이즈 방지)
renderer.sortObjects = true;

document.body.appendChild(renderer.domElement);

const clickableObjects = []; const planetsUpdateFns = []; let controls;
const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2();

function initSystem() {
    camera.position.z = INITIAL_CAM_Z;

    const createPlanetPair = (name, scale, isSun = false) => {
        const matK = createPlanetMaterials(name, 'black', false);
        const matB = createPlanetMaterials(name, COLOR_BLUE, isSun);

        const base = new THREE.Sprite(matK);
        base.scale.set(scale, scale, 1);
        base.name = name;
        base.renderOrder = 10;

        const overlay = new THREE.Sprite(matB);
        overlay.material.opacity = 0;
        overlay.renderOrder = 11;
        base.add(overlay);

        base.userData = { overlay, currentOpacity: 0 };
        return base;
    };

    const sun = createPlanetPair('정진성', 0.18, true);
    scene.add(sun); clickableObjects.push(sun);

    ORBIT_GROUPS.forEach(group => {
        const systemGroup = new THREE.Group();
        systemGroup.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
        scene.add(systemGroup);

        const orbitPoints = new THREE.Points(
            new THREE.BufferGeometry().setFromPoints(new THREE.EllipseCurve(0, 0, group.radius, group.radius).getPoints(group.radius * 10)),
            new THREE.PointsMaterial({ color: 0x000000, map: dotTexture, size: 0.35, transparent: true, depthWrite: false })
        );
        orbitPoints.renderOrder = 0;
        systemGroup.add(orbitPoints);

        group.planets.forEach((name, i) => {
            const planet = createPlanetPair(name, 0.12, false);
            planet.userData.parentGroup = systemGroup;
            systemGroup.add(planet);
            clickableObjects.push(planet);

            const angle = (i / group.planets.length) * Math.PI * 2;
            planetsUpdateFns.push(() => {
                planet.position.set(
                    Math.cos(angle + Date.now() * 0.001 * group.speed * 10) * group.radius,
                    Math.sin(angle + Date.now() * 0.001 * group.speed * 10) * group.radius,
                    0
                );
            });
        });
    });

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.autoRotate = true; controls.autoRotateSpeed = 0.2;
    setupInteractions();
}

function setupInteractions() {
    window.addEventListener('pointerdown', (e) => {
        if (document.querySelector('canvas').classList.contains('modal-active')) return;
        if (isOpening) { isOpening = false; camera.position.z = FINAL_CAM_Z; }

        mouseDownPosition = { x: e.clientX, y: e.clientY };
        isDragging = false;

        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(clickableObjects);
        if (intersects.length > 0) {
            potentialObjectForDrag = intersects[0].object;
        } else {
            potentialObjectForDrag = null;
        }
    });

    window.addEventListener('pointermove', (e) => {
        if (document.querySelector('canvas').classList.contains('modal-active')) return;
        const dist = Math.hypot(e.clientX - mouseDownPosition.x, e.clientY - mouseDownPosition.y);

        if (!isDragging && potentialObjectForDrag && dist > CLICK_THRESHOLD) {
            isDragging = true;
            controls.enabled = false;
            selectedGroupForDrag = potentialObjectForDrag.userData.parentGroup;
        }

        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(clickableObjects);
        if (intersects.length > 0) {
            document.body.style.cursor = 'pointer';
            hoveredObject = intersects[0].object;
        } else {
            document.body.style.cursor = 'default';
            hoveredObject = null;
        }

        if (isDragging && selectedGroupForDrag) {
            selectedGroupForDrag.rotation.y += e.movementX * 0.005;
            selectedGroupForDrag.rotation.x += e.movementY * 0.005;
        }
    });

    window.addEventListener('pointerup', (e) => {
        if (document.querySelector('canvas').classList.contains('modal-active')) return;
        const finalDist = Math.hypot(e.clientX - mouseDownPosition.x, e.clientY - mouseDownPosition.y);

        if (!isDragging && finalDist < CLICK_THRESHOLD) {
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(clickableObjects);

            if (intersects.length > 0) {
                const obj = intersects[0].object;
                const target = MODAL_MAP[obj.name];
                if (window.openModal && target) window.openModal(target);
                clickedObject = obj;
                controls.autoRotate = false;
            } else {
                clickedObject = null;
                controls.autoRotate = true;
                targetPulseValue = 1;
                setTimeout(() => { targetPulseValue = 0; }, 600);
            }
        }
        isDragging = false; selectedGroupForDrag = null; potentialObjectForDrag = null; controls.enabled = true;
    });
}

function animate() {
    requestAnimationFrame(animate);

    globalPulseValue = THREE.MathUtils.lerp(globalPulseValue, targetPulseValue, 0.1);

    clickableObjects.forEach(obj => {
        const isHovered = (obj === hoveredObject || obj === clickedObject);
        const combinedTarget = Math.max(isHovered ? 1 : 0, globalPulseValue);

        // [사파리 부드러움 개선] 보간 속도를 더 미세하게 조정
        obj.userData.currentOpacity = THREE.MathUtils.lerp(obj.userData.currentOpacity, combinedTarget, 0.06);

        if (obj.userData.overlay) {
            obj.userData.overlay.material.opacity = obj.userData.currentOpacity;
            // 0에 가깝다면 렌더링 제외하여 성능 확보
            obj.userData.overlay.visible = obj.userData.currentOpacity > 0.001;
        }
    });

    if (isOpening && openingStartTime) {
        const elapsed = (Date.now() - openingStartTime) / 1000 - 0.5;
        if (elapsed > 0) {
            let t = Math.min(elapsed / ZOOM_DURATION, 1);
            const ease = t < 0.5 ? 16 * t ** 5 : 1 - (-2 * t + 2) ** 5 / 2;
            camera.position.z = INITIAL_CAM_Z + (FINAL_CAM_Z - INITIAL_CAM_Z) * ease;
            if (t === 1) isOpening = false;
        }
    }

    planetsUpdateFns.forEach(fn => fn());
    controls.update();
    renderer.render(scene, camera);
}

async function startApp() {
    try { await document.fonts.load('bold 1rem "nanumgothiccoding"'); } catch (e) { }
    document.getElementById('loading').style.opacity = 0;
    initSystem();
    openingStartTime = Date.now();
    animate();
    setTimeout(() => { if (renderer.domElement) renderer.domElement.style.opacity = 1; }, 100);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

startApp();