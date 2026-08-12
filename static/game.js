import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

let scene, camera, renderer, controls, gunGroup;
let targets = [];
let score = 0;
let playerHP = 100;
let username = "Player1";
let isGameOver = false;

// O'q va Qayta o'qlash
let ammo = 30;
const maxAmmo = 30;
let isReloading = false;

// Mobil Boshqaruv O'zgaruvchilari
const isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
let touchStartX = 0, touchStartY = 0;
let moveVector = { x: 0, y: 0 };
let lon = 0, lat = 0; // Mobil kamera burchaklari

// DOM Elementlari
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');
const usernameInput = document.getElementById('username');
const scoreDisplay = document.getElementById('score-display');
const hpDisplay = document.getElementById('hp-display');
const ammoDisplay = document.getElementById('ammo-display');
const reloadMsg = document.getElementById('reload-msg');
const menuTitle = document.getElementById('menu-title');
const gameOverMsg = document.getElementById('game-over-msg');
const leaderboardList = document.getElementById('leaderboard-list');

// OVOZ EFFEKTLARI (Web Audio API)
function playShootSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(350, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + 0.1);
}

function playBotShootSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + 0.15);
}

function playHurtSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(); osc.stop(ctx.currentTime + 0.2);
}

// 🧱 HAQIQIY COUNTER-STRIKE (DUST2 USLUBIDAGI) XARITA
function createCSMap() {
  // Qumrang Zamin
  const floorGeo = new THREE.PlaneGeometry(100, 100);
  const floorMat = new THREE.MeshLambertMaterial({ color: 0xc2a649 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const wallMat = new THREE.MeshLambertMaterial({ color: 0x8b7355 }); // Qum devorlar
  const boxMat = new THREE.MeshLambertMaterial({ color: 0x5c4033 });  // Yog'och yashiklar

  // Tashqi CS Devorlari (Border Walls)
  const wallGeoH = new THREE.BoxGeometry(100, 8, 2);
  const wallGeoV = new THREE.BoxGeometry(2, 8, 100);

  const w1 = new THREE.Mesh(wallGeoH, wallMat); w1.position.set(0, 4, -50);
  const w2 = new THREE.Mesh(wallGeoH, wallMat); w2.position.set(0, 4, 50);
  const w3 = new THREE.Mesh(wallGeoV, wallMat); w3.position.set(-50, 4, 0);
  const w4 = new THREE.Mesh(wallGeoV, wallMat); w4.position.set(50, 4, 0);
  scene.add(w1, w2, w3, w4);

  // Ichki Yo'laklar va Bunkerlar (Chokepoints & Cover)
  const obstacleData = [
    { x: -15, z: -10, w: 2, h: 4, d: 20 },
    { x: 15, z: -15, w: 20, h: 4, d: 2 },
    { x: 0, z: 10, w: 12, h: 3, d: 2 },
    { x: -10, z: 20, w: 2, h: 4, d: 15 },
    { x: 20, z: 15, w: 2, h: 4, d: 15 }
  ];

  obstacleData.forEach(data => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(data.w, data.h, data.d), wallMat);
    wall.position.set(data.x, data.h / 2, data.z);
    scene.add(wall);
  });

  // CS Yashiklari
  for (let i = 0; i < 15; i++) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), boxMat);
    box.position.set((Math.random() - 0.5) * 60, 1, (Math.random() - 0.5) * 60);
    scene.add(box);
  }
}

// 🪖 AVTOMATLI ASKAR BOT MODELI
function createSoldierBot() {
  const soldier = new THREE.Group();

  const skinMat = new THREE.MeshLambertMaterial({ color: 0xd2a679 });
  const camoMat = new THREE.MeshLambertMaterial({ color: 0x3b5323 }); 
  const vestMat = new THREE.MeshLambertMaterial({ color: 0x1f2421 }); 
  const gunMat = new THREE.MeshLambertMaterial({ color: 0x111111 });  

  // Bosh & Kaska
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), skinMat);
  head.position.y = 1.55; soldier.add(head);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12, 0, Math.PI*2, 0, Math.PI/2), camoMat);
  helmet.position.y = 1.58; soldier.add(helmet);

  // Tana
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.22), vestMat);
  torso.position.y = 1.1; soldier.add(torso);

  // Oyoqlar
  const leftLegPivot = new THREE.Group(); leftLegPivot.position.set(-0.12, 0.8, 0);
  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.75), camoMat);
  leftLeg.position.y = -0.375; leftLegPivot.add(leftLeg); soldier.add(leftLegPivot);

  const rightLegPivot = new THREE.Group(); rightLegPivot.position.set(0.12, 0.8, 0);
  const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.75), camoMat);
  rightLeg.position.y = -0.375; rightLegPivot.add(rightLeg); soldier.add(rightLegPivot);

  // Qo'llar va Avtomat
  const rightArmPivot = new THREE.Group(); rightArmPivot.position.set(0.25, 1.3, 0);
  const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.5), camoMat);
  rightArm.position.set(0, -0.25, 0.1); rightArm.rotation.x = -0.8;
  rightArmPivot.add(rightArm); soldier.add(rightArmPivot);

  const rifle = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.6), gunMat);
  barrel.position.set(0, 0, -0.25);
  rifle.add(barrel);
  rifle.position.set(0, -0.4, -0.15); rifle.rotation.x = 0.5;
  rightArmPivot.add(rifle);

  soldier.userData = {
    leftLegPivot, rightLegPivot, rightArmPivot,
    animTime: Math.random() * 10,
    lastShootTime: 0
  };

  return soldier;
}

function spawnSingleTarget() {
  const soldier = createSoldierBot();
  soldier.position.set((Math.random() - 0.5) * 70, 0, -Math.random() * 40 - 10);
  scene.add(soldier);
  targets.push(soldier);
}

function spawnTargets() {
  for (let i = 0; i < 6; i++) spawnSingleTarget();
}

// 🔫 BOT O'YINCHIGA O'Q UZISHI (BOT SHOOTING LOGIC)
function botShootAtPlayer(bot) {
  playBotShootSound();

  // Visual O'q izi (Red Tracer Line)
  const lineMat = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const points = [];
  points.push(bot.position.clone().add(new THREE.Vector3(0, 1.3, 0)));
  points.push(camera.position.clone().add(new THREE.Vector3(0, -0.2, 0)));

  const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
  const tracer = new THREE.Line(lineGeo, lineMat);
  scene.add(tracer);

  setTimeout(() => scene.remove(tracer), 60); // 60ms dan so'ng o'q izi yo'qoladi

  // Ziyon yetkazish (HP kamayishi)
  playerHP -= 8;
  hpDisplay.innerText = playerHP;
  playHurtSound();

  if (playerHP <= 0) handleGameOver();
}

// O'YINNI ISHGA TUSHIRISH
function initGame() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // CS Sky Blue
  scene.fog = new THREE.FogExp2(0x87ceeb, 0.015);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1.6, 20);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Yorug'lik
  const light = new THREE.DirectionalLight(0xffffff, 1.2);
  light.position.set(20, 40, 20);
  scene.add(light, new THREE.AmbientLight(0x777777));

  // Qurol
  gunGroup = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  barrel.position.set(0, 0, -0.25); gunGroup.add(barrel);
  gunGroup.position.set(0.2, -0.15, -0.3);
  camera.add(gunGroup); scene.add(camera);

  createCSMap();
  spawnTargets();

  if (!isMobile) {
    controls = new PointerLockControls(camera, document.body);
    controls.addEventListener('unlock', () => {
      if (!isGameOver) { overlay.style.display = 'flex'; fetchLeaderboard(); }
    });
  } else {
    setupMobileControls();
  }

  // Otish Mexanikasi
  window.addEventListener('click', shootGun);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR') reloadWeapon();
  });

  setupMovement();
  animate();
}

function shootGun() {
  if ((!isMobile && !controls.isLocked) || isReloading || isGameOver) return;
  if (ammo <= 0) { reloadWeapon(); return; }

  ammo--;
  ammoDisplay.innerText = `${ammo} / ${maxAmmo}`;
  playShootSound();

  // Recoil
  gunGroup.position.z += 0.05;
  setTimeout(() => gunGroup.position.z -= 0.05, 50);

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersects = raycaster.intersectObjects(targets, true);

  if (intersects.length > 0) {
    let hitSoldier = intersects[0].object;
    while (hitSoldier.parent && hitSoldier.parent !== scene) hitSoldier = hitSoldier.parent;

    if (targets.includes(hitSoldier)) {
      scene.remove(hitSoldier);
      targets = targets.filter(t => t !== hitSoldier);
      score += 10;
      scoreDisplay.innerText = score;
      setTimeout(() => spawnSingleTarget(), 1500);
    }
  }
}

function reloadWeapon() {
  if (isReloading || ammo === maxAmmo) return;
  isReloading = true;
  reloadMsg.style.display = 'inline';
  setTimeout(() => {
    ammo = maxAmmo;
    ammoDisplay.innerText = `${ammo} / ${maxAmmo}`;
    reloadMsg.style.display = 'none';
    isReloading = false;
  }, 1500);
}

// 📱 MOBIL TOUCH BOSHGARUV KODI
function setupMobileControls() {
  document.getElementById('mobile-controls').style.display = 'block';

  const joystickZone = document.getElementById('joystick-zone');
  const joystickKnob = document.getElementById('joystick-knob');

  // Virtual Joystik
  joystickZone.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    const rect = joystickZone.getBoundingClientRect();
    touchStartX = touch.clientX - (rect.left + rect.width / 2);
    touchStartY = touch.clientY - (rect.top + rect.height / 2);
  });

  joystickZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = joystickZone.getBoundingClientRect();
    let dx = touch.clientX - (rect.left + rect.width / 2);
    let dy = touch.clientY - (rect.top + rect.height / 2);

    const dist = Math.hypot(dx, dy);
    if (dist > 40) { dx *= 40 / dist; dy *= 40 / dist; }

    joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    moveVector.x = dx / 40;
    moveVector.y = -dy / 40;
  });

  joystickZone.addEventListener('touchend', () => {
    joystickKnob.style.transform = `translate(0px, 0px)`;
    moveVector = { x: 0, y: 0 };
  });

  // Ekran orqali kamerani burish (Touch Look)
  let lastTouchX = 0, lastTouchY = 0;
  window.addEventListener('touchstart', (e) => {
    if (e.touches[0].clientX > window.innerWidth / 2) {
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
    }
  });

  window.addEventListener('touchmove', (e) => {
    for (let t of e.touches) {
      if (t.clientX > window.innerWidth / 2) {
        let deltaX = t.clientX - lastTouchX;
        let deltaY = t.clientY - lastTouchY;
        lastTouchX = t.clientX; lastTouchY = t.clientY;

        lon -= deltaX * 0.25;
        lat = Math.max(-85, Math.min(85, lat - deltaY * 0.25));

        let phi = THREE.MathUtils.degToRad(90 - lat);
        let theta = THREE.MathUtils.degToRad(lon);

        let target = new THREE.Vector3();
        target.x = camera.position.x + Math.sin(phi) * Math.sin(theta);
        target.y = camera.position.y + Math.cos(phi);
        target.z = camera.position.z + Math.sin(phi) * Math.cos(theta);
        camera.lookAt(target);
      }
    }
  });

  document.getElementById('btn-shoot').addEventListener('touchstart', (e) => { e.preventDefault(); shootGun(); });
  document.getElementById('btn-reload').addEventListener('touchstart', (e) => { e.preventDefault(); reloadWeapon(); });
}

// WASD Harakati (PC uchun)
let moveF = false, moveB = false, moveL = false, moveR = false;
function setupMovement() {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW') moveF = true; if (e.code === 'KeyS') moveB = true;
    if (e.code === 'KeyA') moveL = true; if (e.code === 'KeyD') moveR = true;
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') moveF = false; if (e.code === 'KeyS') moveB = false;
    if (e.code === 'KeyA') moveL = false; if (e.code === 'KeyD') moveR = false;
  });
}

function handleGameOver() {
  isGameOver = true;
  if (!isMobile && controls) controls.unlock();
  saveScoreToDatabase(); fetchLeaderboard();

  menuTitle.innerText = "GAME OVER";
  gameOverMsg.innerText = `Siz mag'lub bo'ldingiz! Ball: ${score}`;
  gameOverMsg.style.display = 'block';
  startBtn.innerText = "QAYTA BOSHLASH";
  overlay.style.display = 'flex';
}

function resetGame() {
  score = 0; playerHP = 100; ammo = maxAmmo; isGameOver = false;
  scoreDisplay.innerText = score; hpDisplay.innerText = playerHP; ammoDisplay.innerText = `${ammo} / ${maxAmmo}`;
  targets.forEach(t => scene.remove(t)); targets = [];
  spawnTargets(); camera.position.set(0, 1.6, 20);
}

async function saveScoreToDatabase() {
  if (score === 0) return;
  try {
    await fetch('/api/score', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, score: score })
    });
  } catch (err) {}
}

async function fetchLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();
    leaderboardList.innerHTML = '';
    data.forEach((item, index) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${index + 1}. ${item.username}</span> <strong>${item.score} pt</strong>`;
      leaderboardList.appendChild(li);
    });
  } catch (err) {}
}

fetchLeaderboard();

// GAME LOOP
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  if (!isGameOver && scene) {
    // 1. O'yinchi Harakati (PC va Mobil)
    if (!isMobile && controls && controls.isLocked) {
      const speed = 12 * delta;
      if (moveF) controls.moveForward(speed);
      if (moveB) controls.moveForward(-speed);
      if (moveL) controls.moveRight(-speed);
      if (moveR) controls.moveRight(speed);
    } else if (isMobile) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
      const sideDir = new THREE.Vector3(-dir.z, 0, dir.x);

      camera.position.addScaledVector(dir, moveVector.y * 10 * delta);
      camera.position.addScaledVector(sideDir, moveVector.x * 10 * delta);
    }

    // 2. 🤖 BOT INTELLEKTI VA MASOFADAN OTISHI (RANGED BOT AI)
    targets.forEach(target => {
      target.lookAt(camera.position.x, target.position.y, camera.position.z);
      const dist = camera.position.distanceTo(target.position);

      // Agar bot o'yinchidan 12 metrdan uzoq bo'lsa - yaqinlashadi
      if (dist > 12) {
        target.translateZ(2.2 * delta);
        if (target.userData.leftLegPivot) {
          target.userData.animTime += delta * 8;
          const swing = Math.sin(target.userData.animTime) * 0.5;
          target.userData.leftLegPivot.rotation.x = swing;
          target.userData.rightLegPivot.rotation.x = -swing;
        }
      } 
      // Agar o'yinchi botga juda yaqin kelib qolsa - bot orqaga chekinadi
      else if (dist < 6) {
        target.translateZ(-1.5 * delta);
      }

      // MASOFADAN O'Q UZISH (Har 2-3 soniyada otadi)
      if (dist < 30 && time - target.userData.lastShootTime > 2.2 + Math.random()) {
        target.userData.lastShootTime = time;
        botShootAtPlayer(target);
      }
    });
  }

  if (renderer) renderer.render(scene, camera);
}

startBtn.addEventListener('click', () => {
  username = usernameInput.value.trim() || 'Player1';
  overlay.style.display = 'none';

  if (!scene) initGame();
  else if (isGameOver) resetGame();

  if (!isMobile && controls) controls.lock();
});
