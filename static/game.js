import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

let scene, camera, renderer, controls, gunGroup;
let targets = [];
let score = 0;
let playerHP = 100;
let username = "Player1";
let isGameOver = false;

// Patronlar va holat
let ammo = 30;
const maxAmmo = 30;
let isReloading = false;

// DOM Elementlari
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');
const usernameInput = document.getElementById('username');
const scoreDisplay = document.getElementById('score-display');
const hpDisplay = document.getElementById('hp-display');
const playerNameDisplay = document.getElementById('player-name-display');
const leaderboardList = document.getElementById('leaderboard-list');
const ammoDisplay = document.getElementById('ammo-display');
const reloadMsg = document.getElementById('reload-msg');
const menuTitle = document.getElementById('menu-title');
const gameOverMsg = document.getElementById('game-over-msg');

// 🎵 WEB AUDIO API: Avtonom Ovoz Effektlari
function playShootSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.12);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
}

function playHitSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.08);
}

function playHurtSound() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.5, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.2);
}

// 1. Reytingni yuklash
async function fetchLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();
    leaderboardList.innerHTML = '';

    if (data.length === 0) {
      leaderboardList.innerHTML = '<li>Hali natijalar yo\'q</li>';
      return;
    }

    data.forEach((item, index) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${index + 1}. ${item.username}</span> <strong>${item.score} pt</strong>`;
      leaderboardList.appendChild(li);
    });
  } catch (err) {
    console.error("Reyting yuklanmadi:", err);
  }
}

fetchLeaderboard();

// 2. 3D Qurol Yaratish (Player Gun)
function createGun() {
  gunGroup = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x11111d });

  const barrelGeo = new THREE.BoxGeometry(0.08, 0.08, 0.5);
  const barrel = new THREE.Mesh(barrelGeo, mat);
  barrel.position.set(0, 0, -0.25);
  gunGroup.add(barrel);

  const handleGeo = new THREE.BoxGeometry(0.07, 0.18, 0.08);
  const handleMat = new THREE.MeshLambertMaterial({ color: 0x5c3a21 });
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.position.set(0, -0.1, -0.1);
  handle.rotation.x = -0.2;
  gunGroup.add(handle);

  gunGroup.position.set(0.2, -0.15, -0.3);
  camera.add(gunGroup);
  scene.add(camera);
}

// 3. Xaritadagi Yog'och Yashiklar
function createMapObstacles() {
  const boxGeo = new THREE.BoxGeometry(2.5, 2.5, 2.5);
  const boxMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });

  for (let i = 0; i < 12; i++) {
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.set((Math.random() - 0.5) * 50, 1.25, (Math.random() - 0.5) * 50);
    scene.add(box);
  }
}

// 🪖 4. 3D Animatsiyali Askar Bot Modelini Yaratish
function createSoldierBot() {
  const soldier = new THREE.Group();

  const skinMat = new THREE.MeshLambertMaterial({ color: 0xd2a679 });
  const camoMat = new THREE.MeshLambertMaterial({ color: 0x3b5323 }); // Harbiy yashil
  const vestMat = new THREE.MeshLambertMaterial({ color: 0x1f2421 }); // Taktik nimcha
  const gunMat = new THREE.MeshLambertMaterial({ color: 0x111111 });  // Qurol rangi

  // Bosh va Kaska
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), skinMat);
  head.position.y = 1.55;
  soldier.add(head);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2), camoMat);
  helmet.position.y = 1.58;
  soldier.add(helmet);

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.22), vestMat);
  torso.position.y = 1.1;
  soldier.add(torso);

  // Chap Oyoq
  const leftLegPivot = new THREE.Group();
  leftLegPivot.position.set(-0.12, 0.8, 0);
  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.75), camoMat);
  leftLeg.position.y = -0.375;
  leftLegPivot.add(leftLeg);
  soldier.add(leftLegPivot);

  // O'ng Oyoq
  const rightLegPivot = new THREE.Group();
  rightLegPivot.position.set(0.12, 0.8, 0);
  const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.75), camoMat);
  rightLeg.position.y = -0.375;
  rightLegPivot.add(rightLeg);
  soldier.add(rightLegPivot);

  // Chap Qo'l
  const leftArmPivot = new THREE.Group();
  leftArmPivot.position.set(-0.25, 1.3, 0);
  const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.5), camoMat);
  leftArm.position.set(0, -0.25, 0.1);
  leftArm.rotation.x = -0.6;
  leftArmPivot.add(leftArm);
  soldier.add(leftArmPivot);

  // O'ng Qo'l
  const rightArmPivot = new THREE.Group();
  rightArmPivot.position.set(0.25, 1.3, 0);
  const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.5), camoMat);
  rightArm.position.set(0, -0.25, 0.1);
  rightArm.rotation.x = -0.8;
  rightArmPivot.add(rightArm);
  soldier.add(rightArmPivot);

  // Bot Qo'lidagi Avtomat
  const rifle = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.55), gunMat);
  barrel.position.set(0, 0, -0.25);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.06), gunMat);
  mag.position.set(0, -0.08, -0.1);
  mag.rotation.x = -0.3;
  rifle.add(barrel, mag);

  rifle.position.set(0, -0.4, -0.15);
  rifle.rotation.x = 0.5;
  rightArmPivot.add(rifle);

  // Pivotlarni saqlaymiz (yugurish animatsiyasi uchun)
  soldier.userData = {
    leftLegPivot,
    rightLegPivot,
    leftArmPivot,
    rightArmPivot,
    animTime: Math.random() * 10
  };

  return soldier;
}

function spawnSingleTarget() {
  const soldier = createSoldierBot();
  soldier.position.set((Math.random() - 0.5) * 40, 0, -Math.random() * 30 - 5);
  scene.add(soldier);
  targets.push(soldier);
}

function spawnTargets() {
  for (let i = 0; i < 6; i++) {
    spawnSingleTarget();
  }
}

// 5. O'yinni Initsializatsiya qilish
function initGame() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.y = 1.6;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Yorug'lik
  const light = new THREE.DirectionalLight(0xffffff, 1.2);
  light.position.set(10, 20, 15);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0x555555));

  // Maydon
  const floorGeo = new THREE.PlaneGeometry(80, 80);
  const floorMat = new THREE.MeshLambertMaterial({ color: 0x22222f });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  createGun();
  createMapObstacles();
  spawnTargets();

  controls = new PointerLockControls(camera, document.body);

  controls.addEventListener('unlock', () => {
    if (!isGameOver) {
      overlay.style.display = 'flex';
      saveScoreToDatabase();
      fetchLeaderboard();
    }
  });

  // Otish Mexanikasi (Raycaster bot guruhlarini teshib o'tadi)
  const raycaster = new THREE.Raycaster();
  window.addEventListener('mousedown', () => {
    if (!controls.isLocked || isReloading || isGameOver) return;

    if (ammo <= 0) {
      reloadWeapon();
      return;
    }

    ammo--;
    ammoDisplay.innerText = `${ammo} / ${maxAmmo}`;
    playShootSound();

    // Recoil
    gunGroup.position.z += 0.05;
    setTimeout(() => gunGroup.position.z -= 0.05, 50);

    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.intersectObjects(targets, true); // true = child meshlarni tekshiradi

    if (intersects.length > 0) {
      let hitMesh = intersects[0].object;

      // Askar guruhini topish
      let hitSoldier = hitMesh;
      while (hitSoldier.parent && hitSoldier.parent !== scene) {
        hitSoldier = hitSoldier.parent;
      }

      if (targets.includes(hitSoldier)) {
        playHitSound();

        scene.remove(hitSoldier);
        targets = targets.filter(t => t !== hitSoldier);

        score += 10;
        scoreDisplay.innerText = score;

        setTimeout(() => spawnSingleTarget(), 1200);
      }
    }
  });

  // Qayta o'qlash (R)
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyR' && !isReloading && ammo < maxAmmo && !isGameOver) {
      reloadWeapon();
    }
  });

  setupMovement();
  animate();
}

function reloadWeapon() {
  isReloading = true;
  reloadMsg.style.display = 'inline';

  setTimeout(() => {
    ammo = maxAmmo;
    ammoDisplay.innerText = `${ammo} / ${maxAmmo}`;
    reloadMsg.style.display = 'none';
    isReloading = false;
  }, 1500);
}

// WASD Harakati
let moveF = false, moveB = false, moveL = false, moveR = false;
function setupMovement() {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW') moveF = true;
    if (e.code === 'KeyS') moveB = true;
    if (e.code === 'KeyA') moveL = true;
    if (e.code === 'KeyD') moveR = true;
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') moveF = false;
    if (e.code === 'KeyS') moveB = false;
    if (e.code === 'KeyA') moveL = false;
    if (e.code === 'KeyD') moveR = false;
  });
}

// Game Over va Reset
function handleGameOver() {
  isGameOver = true;
  controls.unlock();

  saveScoreToDatabase();
  fetchLeaderboard();

  menuTitle.innerText = "GAME OVER";
  gameOverMsg.innerText = `Siz mag'lub bo'ldingiz! To'plangan ball: ${score}`;
  gameOverMsg.style.display = 'block';
  startBtn.innerText = "QAYTA BOSHLASH";
  overlay.style.display = 'flex';
}

function resetGame() {
  score = 0;
  playerHP = 100;
  ammo = maxAmmo;
  isGameOver = false;

  scoreDisplay.innerText = score;
  hpDisplay.innerText = playerHP;
  ammoDisplay.innerText = `${ammo} / ${maxAmmo}`;

  targets.forEach(t => scene.remove(t));
  targets = [];
  spawnTargets();

  camera.position.set(0, 1.6, 0);
}

// API orqali Ballni Bazaga Saqlash
async function saveScoreToDatabase() {
  if (score === 0) return;

  try {
    await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, score: score })
    });
  } catch (err) {
    console.error("Ballni saqlashda xato:", err);
  }
}

// O'yin Sikli (Game Loop & Animation)
const velocity = new THREE.Vector3();
let prevTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  if (controls && controls.isLocked && !isGameOver) {
    const time = performance.now();
    const delta = (time - prevTime) / 1000;

    // Player Harakati
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;

    const dirZ = Number(moveF) - Number(moveB);
    const dirX = Number(moveR) - Number(moveL);

    if (moveF || moveB) velocity.z -= dirZ * 32.0 * delta;
    if (moveL || moveR) velocity.x -= dirX * 32.0 * delta;

    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);

    // 🏃‍♂️ Botlar harakati, Yugurish Animatsiyasi va Hujumi
    targets.forEach(target => {
      target.lookAt(camera.position.x, target.position.y, camera.position.z);
      target.translateZ(2.5 * delta);

      // Procedural Limb Swing Animation
      if (target.userData.leftLegPivot) {
        target.userData.animTime += delta * 9;
        const swing = Math.sin(target.userData.animTime) * 0.6;

        target.userData.leftLegPivot.rotation.x = swing;
        target.userData.rightLegPivot.rotation.x = -swing;
        target.userData.leftArmPivot.rotation.x = -swing * 0.4;
        target.userData.rightArmPivot.rotation.x = swing * 0.4;
      }

      // Hujum / Damag
      const dist = camera.position.distanceTo(target.position);
      if (dist < 1.5) {
        playerHP -= 10;
        hpDisplay.innerText = playerHP;
        playHurtSound();

        target.position.set((Math.random() - 0.5) * 40, 0, -Math.random() * 30 - 5);

        if (playerHP <= 0) {
          handleGameOver();
        }
      }
    });

    prevTime = time;
  }

  if (renderer) renderer.render(scene, camera);
}

// Boshlash Tugmasi
startBtn.addEventListener('click', () => {
  username = usernameInput.value.trim() || 'Player1';
  playerNameDisplay.innerText = username;
  overlay.style.display = 'none';

  if (!scene) {
    initGame();
  } else if (isGameOver) {
    resetGame();
  }

  controls.lock();
});