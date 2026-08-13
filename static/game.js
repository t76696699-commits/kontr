import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

let scene, camera, renderer, controls, gunGroup;
let allies = [], enemies = [], grenades = [];
let playerHP = 100, playerMoney = 1000, grenadesCount = 3;
let currentWeapon = { name: 'Glock-18', damage: 25, ammo: 20, maxAmmo: 20 };

let ammo = 20, isReloading = false, isShopOpen = false;
let autoAimbot = false;

let moveF = false, moveB = false, moveL = false, moveR = false;
let velocityY = 0, isGrounded = true;
const gravity = -25;
let isJetpackActive = false;

// DOM
const hpDisplay = document.getElementById('hp-display');
const ammoDisplay = document.getElementById('ammo-display');
const grenadeDisplay = document.getElementById('grenade-display');
const moneyDisplay = document.getElementById('money-display');
const alliesDisplay = document.getElementById('allies-display');
const enemiesDisplay = document.getElementById('enemies-display');
const shopMoneyDisplay = document.getElementById('shop-money-display');
const aimbotIndicator = document.getElementById('aimbot-indicator');
const shopModal = document.getElementById('shop-modal');

// RELISTIK ODAM ANATOMIYASI MODELI (O'yinchoq/Multfilm emas!)
function createRealisticHumanoid(isEnemy) {
  const group = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd2a679, roughness: 0.6 });
  const camoMat = new THREE.MeshStandardMaterial({
    color: isEnemy ? 0x8b0000 : 0x1f3a60, // Qizil (Dushman) / Ko'k (Ittifoqchi)
    roughness: 0.5
  });
  const gearMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });

  // Oyoqlar (Legs)
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.8), camoMat);
  legL.position.set(-0.15, 0.4, 0); group.add(legL);
  const legR = legL.clone(); legR.position.x = 0.15; group.add(legR);

  // Gavda va Bronjelet (Torso & Tactical Vest)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.65, 0.22), camoMat);
  torso.position.y = 1.1; group.add(torso);
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.45, 0.26), gearMat);
  vest.position.y = 1.15; group.add(vest);

  // Qo'llar (Arms)
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.65), camoMat);
  armL.position.set(-0.28, 1.1, 0); group.add(armL);
  const armR = armL.clone(); armR.position.x = 0.28; group.add(armR);

  // Bosh va Dubulg'a (Head & Helmet)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), skinMat);
  head.position.y = 1.58; head.name = "HEAD"; group.add(head);

  const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.12), gearMat);
  helmet.position.y = 1.64; group.add(helmet);

  // 🚀 HAR BIR ODAMDA JETPACK (QANOTLI RYUKZAK)
  const jetpack = new THREE.Group();
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.35, 0.12), gearMat);
  pack.position.set(0, 1.15, -0.18);
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.2), gearMat);
  wingL.position.set(-0.35, 1.2, -0.18);
  const wingR = wingL.clone(); wingR.position.x = 0.35;
  jetpack.add(pack, wingL, wingR);
  group.add(jetpack);

  group.userData = { hp: 100, isEnemy, lastShoot: 0, isFly: false, velocityY: 0 };
  return group;
}

// MAP & TERRAIN
function getTerrainHeight(x, z) {
  return Math.sin(x * 0.03) * Math.cos(z * 0.03) * 6;
}

function createMap() {
  const geo = new THREE.PlaneGeometry(300, 300, 80, 80);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, getTerrainHeight(pos.getX(i), pos.getZ(i)));
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ color: 0x4b5320, roughness: 0.8 });
  const map = new THREE.Mesh(geo, mat);
  scene.add(map);
}

// 👥 5v5 JAMOA FORMALASH
function spawnTeams() {
  // 4 ta Do'st (Jamoa)
  for (let i = 0; i < 4; i++) {
    const ally = createRealisticHumanoid(false);
    ally.position.set(-10 - i * 3, getTerrainHeight(-10, 10), 10);
    scene.add(ally); allies.push(ally);
  }

  // 5 ta Dushman
  for (let i = 0; i < 5; i++) {
    const enemy = createRealisticHumanoid(true);
    const ex = (Math.random() - 0.5) * 150;
    const ez = -50 - Math.random() * 50;
    enemy.position.set(ex, getTerrainHeight(ex, ez), ez);
    scene.add(enemy); enemies.push(enemy);
  }
}

// 💣 BOMBA (GRENADA) OTISH
function throwGrenade() {
  if (grenadesCount <= 0) return;
  grenadesCount--;
  grenadeDisplay.innerText = grenadesCount;

  const grenade = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 })
  );

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  grenade.position.copy(camera.position).add(dir.clone().multiplyScalar(1.5));

  grenade.userData = {
    velocity: dir.multiplyScalar(22),
    life: 2.5 // 2.5 soniyada portlaydi
  };

  scene.add(grenade);
  grenades.push(grenade);
}

// 💥 PORTLASH EFFEKTI
function explodeGrenade(pos) {
  const light = new THREE.PointLight(0xff5500, 10, 15);
  light.position.copy(pos);
  scene.add(light);
  setTimeout(() => scene.remove(light), 300);

  // Radiusdagi dushmanlarga zarar yetkazish
  enemies.forEach(enemy => {
    if (enemy.position.distanceTo(pos) < 12) {
      enemy.userData.hp -= 80;
      if (enemy.userData.hp <= 0) killAgent(enemy);
    }
  });
}

function killAgent(agent) {
  scene.remove(agent);
  if (agent.userData.isEnemy) {
    enemies = enemies.filter(e => e !== agent);
    enemiesDisplay.innerText = enemies.length;
    playerMoney += 800;
    moneyDisplay.innerText = playerMoney;
    shopMoneyDisplay.innerText = playerMoney;
  } else {
    allies = allies.filter(a => a !== agent);
    alliesDisplay.innerText = allies.length;
  }
}

// 💥 OTISH
function shootGun() {
  if (ammo <= 0 || isShopOpen) return;
  ammo--;
  ammoDisplay.innerText = `${ammo} / ${currentWeapon.maxAmmo}`;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const intersects = raycaster.intersectObjects(enemies, true);

  if (intersects.length > 0) {
    let hitObj = intersects[0].object;
    let isHead = (hitObj.name === "HEAD");
    while (hitObj.parent && hitObj.parent !== scene) hitObj = hitObj.parent;

    if (enemies.includes(hitObj)) {
      hitObj.userData.hp -= isHead ? currentWeapon.damage * 2 : currentWeapon.damage;
      if (hitObj.userData.hp <= 0) killAgent(hitObj);
    }
  }
}

// DO'KON MECHANIC
window.buyWeapon = function(name, price, damage, maxAmmo) {
  if (playerMoney >= price) {
    playerMoney -= price;
    currentWeapon = { name, price, damage, maxAmmo };
    ammo = maxAmmo;
    moneyDisplay.innerText = playerMoney;
    shopMoneyDisplay.innerText = playerMoney;
    ammoDisplay.innerText = `${ammo} / ${maxAmmo}`;
    toggleShop();
  }
};

function toggleShop() {
  isShopOpen = !isShopOpen;
  shopModal.style.display = isShopOpen ? 'flex' : 'none';
  if (controls) {
    if (isShopOpen) controls.unlock(); else controls.lock();
  }
}

// INIT
function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x73a5c5);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 5, 10);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(50, 100, 50);
  scene.add(sun, new THREE.AmbientLight(0x777777));

  // Player Gun
  gunGroup = new THREE.Group();
  const gMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.4), new THREE.MeshStandardMaterial({ color: 0x111 }));
  gMesh.position.set(0.2, -0.15, -0.3);
  gunGroup.add(gMesh); camera.add(gunGroup); scene.add(camera);

  createMap();
  spawnTeams();

  controls = new PointerLockControls(camera, document.body);
  document.body.addEventListener('click', () => { if (!isShopOpen) controls.lock(); });

  window.addEventListener('click', shootGun);

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyW') moveF = true;
    if (e.code === 'KeyS') moveB = true;
    if (e.code === 'KeyA') moveL = true;
    if (e.code === 'KeyD') moveR = true;
    if (e.code === 'KeyE' || e.code === 'ShiftLeft') isJetpackActive = true;
    if (e.code === 'KeyG') throwGrenade();
    if (e.code === 'KeyB') toggleShop();
    if (e.code === 'KeyF') {
      autoAimbot = !autoAimbot;
      aimbotIndicator.style.display = autoAimbot ? 'block' : 'none';
    }
    if (e.code === 'Space' && isGrounded) { velocityY = 10; isGrounded = false; }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'KeyW') moveF = false;
    if (e.code === 'KeyS') moveB = false;
    if (e.code === 'KeyA') moveL = false;
    if (e.code === 'KeyD') moveR = false;
    if (e.code === 'KeyE' || e.code === 'ShiftLeft') isJetpackActive = false;
  });

  document.getElementById('close-shop-btn').onclick = toggleShop;
  animate();
}

// ANIMATION LOOP
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (scene && !isShopOpen) {
    const px = camera.position.x;
    const pz = camera.position.z;
    const groundY = getTerrainHeight(px, pz) + 1.6;

    // Player Jetpack
    if (isJetpackActive) {
      velocityY += 25 * delta;
      if (velocityY > 12) velocityY = 12;
    } else {
      velocityY += gravity * delta;
    }

    camera.position.y += velocityY * delta;
    if (camera.position.y < groundY) {
      camera.position.y = groundY; velocityY = 0; isGrounded = true;
    }

    if (controls.isLocked) {
      const spd = 12 * delta;
      if (moveF) controls.moveForward(spd);
      if (moveB) controls.moveForward(-spd);
      if (moveL) controls.moveRight(-spd);
      if (moveR) controls.moveRight(spd);
    }

    // 🎯 AUTO AIMBOT
    if (autoAimbot && enemies.length > 0) {
      let closest = enemies[0];
      let minDist = camera.position.distanceTo(closest.position);
      enemies.forEach(e => {
        let d = camera.position.distanceTo(e.position);
        if (d < minDist) { minDist = d; closest = e; }
      });
      camera.lookAt(closest.position.x, closest.position.y + 1.5, closest.position.z);
    }

    // 💣 GRENADE PHYSICS
    grenades.forEach((g, idx) => {
      g.position.addScaledVector(g.userData.velocity, delta);
      g.userData.velocity.y += gravity * delta;
      g.userData.life -= delta;

      if (g.position.y <= getTerrainHeight(g.position.x, g.position.z)) {
        g.userData.velocity.set(0, 0, 0);
      }

      if (g.userData.life <= 0) {
        explodeGrenade(g.position);
        scene.remove(g);
        grenades.splice(idx, 1);
      }
    });

    // BOTS AI & UCHISH (HAMMA UCHA OLADI)
    [...allies, ...enemies].forEach(bot => {
      // Ba'zan botlar ham uchadi
      if (Math.random() < 0.01) bot.userData.isFly = true;
      if (Math.random() < 0.02) bot.userData.isFly = false;

      if (bot.userData.isFly) {
        bot.userData.velocityY = 5;
        bot.position.y += bot.userData.velocityY * delta;
        if (bot.position.y > 15) bot.position.y = 15;
      } else {
        const bGy = getTerrainHeight(bot.position.x, bot.position.z);
        if (bot.position.y > bGy) bot.position.y += gravity * delta;
        else bot.position.y = bGy;
      }
    });
  }

  renderer.render(scene, camera);
}

document.getElementById('start-btn').addEventListener('click', () => {
  document.getElementById('overlay').style.display = 'none';
  if (!scene) init();
});