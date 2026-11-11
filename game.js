const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const hpFill = document.getElementById('hpFill');
const manaFill = document.getElementById('manaFill');
const xpFill = document.getElementById('xpFill');
const hpText = document.getElementById('hpText');
const manaText = document.getElementById('manaText');
const xpText = document.getElementById('xpText');
const levelValue = document.getElementById('levelValue');
const waveValue = document.getElementById('waveValue');
const minionValue = document.getElementById('minionValue');
const goldValue = document.getElementById('goldValue');
const zoneName = document.getElementById('zoneName');
const messageBox = document.getElementById('messageBox');

const keys = {};
const mouse = { x: canvas.width / 2, y: canvas.height / 2, down: false };

const state = {
  lastTime: 0,
  wave: 1,
  waveTimer: 0,
  spawnClock: 0,
  score: 0,
  gameOver: false,
  time: 0,
  messageTimer: 0,
  difficulty: 1,
};

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: 17,
  speed: 195,
  hp: 180,
  maxHp: 180,
  mana: 70,
  maxMana: 70,
  xp: 0,
  level: 1,
  xpToNext: 70,
  baseDamage: 24,
  damage: 24,
  aimAngle: 0,
  facing: 0,
  attackCooldown: 0,
  skillCooldowns: {
    boneSpear: 0,
    skeletons: 0,
    corpseExplosion: 0,
    boneArmor: 0,
  },
  shield: 0,
  gold: 0,
  autoAttack: true,
};

const enemies = [];
const summons = [];
const projectiles = [];
const particles = [];
const corpses = [];
const lootDrops = [];

const skillButtons = [...document.querySelectorAll('[data-skill]')];

function setMessage(text, duration = 2.7) {
  messageBox.textContent = text;
  state.messageTimer = duration;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function angleTo(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function spawnBurst(x, y, color, count = 12, speed = 110) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = rand(speed * 0.4, speed);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      color,
      life: rand(0.35, 0.8),
      size: rand(2, 5),
      fade: 1,
    });
  }
}

function addLoot(x, y, kind = 'soul') {
  const value = kind === 'gold' ? rand(12, 22) : 1;
  lootDrops.push({
    x,
    y,
    radius: 8,
    kind,
    value,
    life: 8,
    pulse: Math.random() * Math.PI * 2,
  });
}

function spawnEnemy() {
  const edge = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;
  const margin = 60;

  if (edge === 0) {
    x = rand(-15, canvas.width + 15);
    y = -margin;
  } else if (edge === 1) {
    x = canvas.width + margin;
    y = rand(-15, canvas.height + 15);
  } else if (edge === 2) {
    x = rand(-15, canvas.width + 15);
    y = canvas.height + margin;
  } else {
    x = -margin;
    y = rand(-15, canvas.height + 15);
  }

  const waveScale = 1 + state.wave * 0.13;
  const variantRoll = Math.random();
  let type = 'walker';
  if (variantRoll > 0.85 && state.wave > 1) type = 'brute';
  if (variantRoll > 0.96 && state.wave > 3) type = 'ranged';

  const enemy = {
    x,
    y,
    radius: type === 'brute' ? 18 : type === 'ranged' ? 13 : 14,
    type,
    hp: type === 'brute' ? 90 : type === 'ranged' ? 55 : 36,
    maxHp: type === 'brute' ? 90 : type === 'ranged' ? 55 : 36,
    speed: type === 'brute' ? 54 : type === 'ranged' ? 71 : 82,
    damage: type === 'brute' ? 18 : type === 'ranged' ? 14 : 10,
    attackCooldown: 0,
    color: type === 'brute' ? '#d05d6d' : type === 'ranged' ? '#c97cff' : '#d36d57',
    xp: type === 'brute' ? 20 : type === 'ranged' ? 16 : 12,
    goldReward: type === 'brute' ? 18 : type === 'ranged' ? 12 : 8,
    attackRange: type === 'ranged' ? 175 : 32,
  };

  enemy.hp *= waveScale;
  enemy.maxHp *= waveScale;
  enemy.speed *= waveScale;
  enemy.damage *= waveScale;
  enemy.xp *= waveScale;
  enemy.goldReward *= waveScale;
  enemies.push(enemy);
}

function summonSkeletons() {
  if (player.skillCooldowns.skeletons > 0 || player.mana < 26) return;
  player.mana -= 26;
  player.skillCooldowns.skeletons = 7.2;

  for (let i = 0; i < 3; i++) {
    const angle = (Math.PI * 2 * i) / 3 + Math.random() * 0.8;
    const radius = 30 + i * 14;
    summons.push({
      x: player.x + Math.cos(angle) * radius,
      y: player.y + Math.sin(angle) * radius,
      radius: 10,
      hp: 38,
      maxHp: 38,
      damage: 16 + player.level * 2,
      cooldown: rand(0.2, 0.6),
      color: '#b7d5eb',
      attackRange: 32,
      life: 20,
      target: null,
    });
  }
  setMessage('Esqueletos erguidos da terra!', 1.8);
}

function castBoneSpear(targetX = mouse.x, targetY = mouse.y) {
  if (player.skillCooldowns.boneSpear > 0 || player.mana < 12) return;
  player.mana -= 12;
  player.skillCooldowns.boneSpear = 0.42;

  const dx = targetX - player.x;
  const dy = targetY - player.y;
  const angle = Math.atan2(dy, dx) || player.aimAngle;
  const speed = 420;

  projectiles.push({
    x: player.x,
    y: player.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 5,
    damage: player.damage + 8,
    life: 1.5,
    color: '#d9efff',
    source: 'player',
    pierce: 1,
  });
}

function triggerCorpseExplosion() {
  if (player.skillCooldowns.corpseExplosion > 0 || player.mana < 25) return;
  player.mana -= 25;
  player.skillCooldowns.corpseExplosion = 10;

  let triggered = 0;
  for (const corpse of corpses) {
    const d = dist(corpse, player);
    if (d < 150) {
      triggered++;
      spawnBurst(corpse.x, corpse.y, '#ff9f87', 18, 190);
      for (const enemy of enemies) {
        const enemyDist = dist(corpse, enemy);
        if (enemyDist < 90) {
          enemy.hp -= 42 + player.level * 6;
        }
      }
    }
  }

  corpses.splice(0, corpses.length);
  if (triggered > 0) {
    setMessage('Cadáveres explodem em chamas!', 1.7);
  } else {
    setMessage('Nenhum cadáver por perto...');
  }
}

function castBoneArmor() {
  if (player.skillCooldowns.boneArmor > 0 || player.mana < 20) return;
  player.mana -= 20;
  player.skillCooldowns.boneArmor = 14;
  player.shield = Math.max(player.shield, 35 + player.level * 10);
  spawnBurst(player.x, player.y, '#dfeeff', 24, 120);
  setMessage('Armadura de ossos ativa!', 1.6);
}

function gainXp(amount) {
  player.xp += amount;
  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level += 1;
    player.xpToNext = Math.floor(player.xpToNext * 1.45);
    player.maxHp += 18;
    player.hp = player.maxHp;
    player.maxMana += 7;
    player.mana = player.maxMana;
    player.damage += 4;
    setMessage(`Nível ${player.level}! Potência aumentada.`, 2);
  }
}

function takeDamage(target, amount) {
  if (target === player) {
    const mitigated = amount * (1 - clamp(player.shield / 100, 0, 0.7));
    const finalDamage = Math.max(1, mitigated);
    player.hp -= finalDamage;
    player.shield = Math.max(0, player.shield - amount * 0.35);
    if (player.hp <= 0) {
      player.hp = 0;
      state.gameOver = true;
      setMessage('Você caiu. Pressione R para reiniciar.', 999);
    }
  } else if (target.hp !== undefined) {
    target.hp -= amount;
  }
}

function tryShootNearest() {
  if (player.attackCooldown > 0) return;
  const aliveEnemies = enemies.filter((enemy) => enemy.hp > 0);
  if (!aliveEnemies.length) return;

  const nearest = aliveEnemies.reduce((best, enemy) => {
    const distEnemy = dist(player, enemy);
    return distEnemy < best.distance ? { enemy, distance: distEnemy } : best;
  }, { enemy: aliveEnemies[0], distance: dist(player, aliveEnemies[0]) });

  const dx = nearest.enemy.x - player.x;
  const dy = nearest.enemy.y - player.y;
  const angle = Math.atan2(dy, dx);
  player.aimAngle = angle;
  player.attackCooldown = 0.35;

  projectiles.push({
    x: player.x,
    y: player.y,
    vx: Math.cos(angle) * 420,
    vy: Math.sin(angle) * 420,
    radius: 5,
    damage: player.damage,
    life: 1.0,
    color: '#c8ecff',
    source: 'player',
    pierce: 0,
  });
}

function updatePlayer(dt) {
  const moveX = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const moveY = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);

  const len = Math.hypot(moveX, moveY) || 1;
  player.x += (moveX / len) * player.speed * dt;
  player.y += (moveY / len) * player.speed * dt;

  player.x = clamp(player.x, 24, canvas.width - 24);
  player.y = clamp(player.y, 24, canvas.height - 24);

  const aimX = mouse.x || canvas.width / 2;
  const aimY = mouse.y || canvas.height / 2;
  player.aimAngle = Math.atan2(aimY - player.y, aimX - player.x);
  player.facing = player.aimAngle;

  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  for (const skill of Object.keys(player.skillCooldowns)) {
    player.skillCooldowns[skill] = Math.max(0, player.skillCooldowns[skill] - dt);
  }

  player.mana = clamp(player.mana + dt * 9, 0, player.maxMana);
  player.shield = Math.max(0, player.shield - dt * 5);

  if (mouse.down || keys.Space) {
    tryShootNearest();
  }

  if (keys.KeyQ) {
    castBoneSpear(mouse.x, mouse.y);
    keys.KeyQ = false;
  }
  if (keys.KeyE) {
    summonSkeletons();
    keys.KeyE = false;
  }
  if (keys.KeyR) {
    triggerCorpseExplosion();
    keys.KeyR = false;
  }
  if (keys.KeyF) {
    castBoneArmor();
    keys.KeyF = false;
  }
}

function updateSummons(dt) {
  for (let i = summons.length - 1; i >= 0; i--) {
    const summon = summons[i];
    summon.life -= dt;
    if (summon.life <= 0) {
      summons.splice(i, 1);
      continue;
    }

    let target = null;
    let minDistance = Infinity;
    for (const enemy of enemies) {
      const d = dist(summon, enemy);
      if (d < minDistance) {
        minDistance = d;
        target = enemy;
      }
    }

    if (target) {
      const angle = Math.atan2(target.y - summon.y, target.x - summon.x);
      const speed = 110;
      summon.x += Math.cos(angle) * speed * dt;
      summon.y += Math.sin(angle) * speed * dt;
      summon.cooldown -= dt;
      if (summon.cooldown <= 0 && dist(summon, target) < summon.attackRange + target.radius) {
        target.hp -= summon.damage;
        summon.cooldown = 0.75;
        spawnBurst(summon.x, summon.y, '#b7d5eb', 6, 80);
      }
    }
  }
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;
    proj.life -= dt;

    if (
      proj.x < -20 ||
      proj.y < -20 ||
      proj.x > canvas.width + 20 ||
      proj.y > canvas.height + 20 ||
      proj.life <= 0
    ) {
      projectiles.splice(i, 1);
      continue;
    }

    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];
      if (dist(proj, enemy) < proj.radius + enemy.radius) {
        enemy.hp -= proj.damage;
        spawnBurst(proj.x, proj.y, proj.color, 10, 90);
        if (proj.pierce <= 0) {
          projectiles.splice(i, 1);
        } else {
          proj.pierce -= 1;
          proj.damage *= 0.7;
        }
        break;
      }
    }
  }
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    if (enemy.hp <= 0) {
      if (Math.random() < 0.45) {
        addLoot(enemy.x, enemy.y, Math.random() < 0.22 ? 'gold' : 'soul');
      }
      spawnBurst(enemy.x, enemy.y, enemy.color, 18, 150);
      const corpse = { x: enemy.x, y: enemy.y, radius: 12, life: 14 };
      corpses.push(corpse);
      gainXp(enemy.xp);
      player.gold += enemy.goldReward;
      enemies.splice(i, 1);
      continue;
    }

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    const dirX = dx / distance;
    const dirY = dy / distance;

    if (enemy.type === 'ranged') {
      if (distance > 140) {
        enemy.x += dirX * enemy.speed * dt;
        enemy.y += dirY * enemy.speed * dt;
      } else {
        enemy.x -= dirX * enemy.speed * 0.4 * dt;
        enemy.y -= dirY * enemy.speed * 0.4 * dt;
      }

      enemy.attackCooldown -= dt;
      if (distance < 200 && enemy.attackCooldown <= 0) {
        const projAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        projectiles.push({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(projAngle) * 240,
          vy: Math.sin(projAngle) * 240,
          radius: 5,
          damage: enemy.damage,
          life: 2,
          color: '#d8a8ff',
          source: 'enemy',
          pierce: 0,
        });
        enemy.attackCooldown = 1.6;
      }
    } else {
      enemy.x += dirX * enemy.speed * dt;
      enemy.y += dirY * enemy.speed * dt;
      if (distance < enemy.radius + player.radius + 6) {
        player.hp -= enemy.damage * dt * 1.3;
      }
    }

    if (distance < enemy.radius + player.radius + 4) {
      player.hp -= enemy.damage * dt * 0.8;
    }
  }
}

function updateCorpses(dt) {
  for (let i = corpses.length - 1; i >= 0; i--) {
    const corpse = corpses[i];
    corpse.life -= dt;
    if (corpse.life <= 0) corpses.splice(i, 1);
  }
}

function updateLoot(dt) {
  for (let i = lootDrops.length - 1; i >= 0; i--) {
    const drop = lootDrops[i];
    drop.life -= dt;
    const dx = player.x - drop.x;
    const dy = player.y - drop.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 28) {
      if (drop.kind === 'gold') {
        player.gold += drop.value;
      } else {
        player.mana = clamp(player.mana + 12, 0, player.maxMana);
        player.hp = clamp(player.hp + 10, 0, player.maxHp);
      }
      spawnBurst(drop.x, drop.y, drop.kind === 'gold' ? '#ffcf66' : '#8fe7ff', 12, 90);
      lootDrops.splice(i, 1);
      continue;
    }
    if (drop.life <= 0) lootDrops.splice(i, 1);
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function updateWave(dt) {
  state.waveTimer += dt;
  state.spawnClock -= dt;
  const desiredSpawn = Math.max(0.44, 1.25 - state.wave * 0.06);

  if (state.spawnClock <= 0) {
    spawnEnemy();
    state.spawnClock = desiredSpawn;
  }

  if (state.waveTimer > 18) {
    state.wave += 1;
    state.waveTimer = 0;
    setMessage(`Onda ${state.wave}! A escuridão avança.`, 2.2);
    player.maxHp += 12;
    player.hp = player.maxHp;
    player.maxMana += 5;
  }
}

function resolveCollisions() {
  for (const projectile of projectiles) {
    if (projectile.source === 'enemy' && dist(projectile, player) < projectile.radius + player.radius) {
      takeDamage(player, projectile.damage);
      projectile.life = 0;
    }
  }
}

function drawBackground() {
  ctx.fillStyle = '#0a1017';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let x = 0; x < canvas.width; x += 40) {
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.fillStyle = (x + y) % 80 === 0 ? 'rgba(152, 172, 210, 0.04)' : 'rgba(255,255,255,0.02)';
      ctx.fillRect(x, y, 40, 40);
    }
  }

  const glow = ctx.createRadialGradient(
    canvas.width / 2,
    canvas.height / 2,
    40,
    canvas.width / 2,
    canvas.height / 2,
    360
  );
  glow.addColorStop(0, 'rgba(121, 67, 184, 0.24)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.aimAngle);

  ctx.fillStyle = '#a6b2c8';
  ctx.fillRect(-3, -10, 6, 18);

  ctx.fillStyle = '#dfe8ff';
  ctx.fillRect(8, -3, 18, 6);

  if (player.shield > 0) {
    ctx.strokeStyle = 'rgba(148, 208, 255, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius + 7, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#5b4c76';
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1d1a29';
  ctx.fillRect(-8, -4, 16, 8);
  ctx.restore();
}

function drawEnemies() {
  for (const enemy of enemies) {
    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(enemy.x - 18, enemy.y - enemy.radius - 10, 36, 4);
    ctx.fillStyle = '#d8f4ff';
    ctx.fillRect(enemy.x - 18, enemy.y - enemy.radius - 10, 36 * (enemy.hp / enemy.maxHp), 4);
  }
}

function drawSummons() {
  for (const summon of summons) {
    ctx.fillStyle = '#dfe9ff';
    ctx.beginPath();
    ctx.arc(summon.x, summon.y, summon.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(summon.x - 14, summon.y - 16, 28, 4);
    ctx.fillStyle = '#7ef1ad';
    ctx.fillRect(summon.x - 14, summon.y - 16, 28 * (summon.hp / summon.maxHp), 4);
  }
}

function drawProjectiles() {
  for (const projectile of projectiles) {
    ctx.fillStyle = projectile.color;
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCorpses() {
  for (const corpse of corpses) {
    ctx.fillStyle = 'rgba(142, 136, 135, 0.75)';
    ctx.beginPath();
    ctx.arc(corpse.x, corpse.y, corpse.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLoot() {
  for (const drop of lootDrops) {
    const color = drop.kind === 'gold' ? '#ffd166' : '#7be3ff';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(drop.x, drop.y, drop.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life * 1.2);
    ctx.fillRect(p.x, p.y, p.size, p.size);
    ctx.globalAlpha = 1;
  }
}

function drawCrosshair() {
  const x = mouse.x;
  const y = mouse.y;
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 7, y);
  ctx.lineTo(x + 7, y);
  ctx.moveTo(x, y - 7);
  ctx.lineTo(x, y + 7);
  ctx.stroke();
}

function updateHUD() {
  const hpRatio = player.hp / player.maxHp;
  const manaRatio = player.mana / player.maxMana;
  const xpRatio = player.xp / player.xpToNext;

  hpFill.style.width = `${(hpRatio * 100).toFixed(1)}%`;
  manaFill.style.width = `${(manaRatio * 100).toFixed(1)}%`;
  xpFill.style.width = `${(xpRatio * 100).toFixed(1)}%`;

  hpText.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
  manaText.textContent = `${Math.ceil(player.mana)} / ${player.maxMana}`;
  xpText.textContent = `${Math.floor(player.xp)} / ${player.xpToNext}`;
  levelValue.textContent = String(player.level);
  waveValue.textContent = String(state.wave);
  minionValue.textContent = String(summons.length);
  goldValue.textContent = String(player.gold);
  zoneName.textContent = state.wave > 5 ? 'Ciclo do Espectro' : state.wave > 2 ? 'Necrotério Profundo' : 'Cemitério de Lich';
}

function update(dt) {
  if (state.gameOver) {
    if (keys.KeyR) {
      window.location.reload();
    }
    return;
  }

  state.time += dt;
  if (state.messageTimer > 0) {
    state.messageTimer -= dt;
    if (state.messageTimer <= 0) {
      messageBox.textContent = 'Mova-se, mate as hordas e sustente a noite.';
    }
  }

  updatePlayer(dt);
  updateSummons(dt);
  updateProjectiles(dt);
  updateEnemies(dt);
  updateCorpses(dt);
  updateLoot(dt);
  updateParticles(dt);
  updateWave(dt);
  resolveCollisions();
  updateHUD();
}

function draw() {
  drawBackground();
  drawCorpses();
  drawLoot();
  drawSummons();
  drawEnemies();
  drawProjectiles();
  drawParticles();
  drawPlayer();
  drawCrosshair();
}

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - state.lastTime) / 1000 || 0.016, 0.033);
  state.lastTime = timestamp;
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', (event) => {
  keys[event.code] = true;
  if (event.code === 'KeyQ') castBoneSpear(mouse.x, mouse.y);
  if (event.code === 'KeyE') summonSkeletons();
  if (event.code === 'KeyR') triggerCorpseExplosion();
  if (event.code === 'KeyF') castBoneArmor();
  if (event.code === 'Space') {
    event.preventDefault();
    mouse.down = true;
  }
});

window.addEventListener('keyup', (event) => {
  keys[event.code] = false;
  if (event.code === 'Space') mouse.down = false;
});

canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  mouse.x = (event.clientX - rect.left) * scaleX;
  mouse.y = (event.clientY - rect.top) * scaleY;
});

canvas.addEventListener('mousedown', () => {
  mouse.down = true;
  castBoneSpear(mouse.x, mouse.y);
});

window.addEventListener('mouseup', () => {
  mouse.down = false;
});

skillButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const skill = button.dataset.skill;
    if (skill === 'boneSpear') castBoneSpear(mouse.x, mouse.y);
    if (skill === 'skeletons') summonSkeletons();
    if (skill === 'corpseExplosion') triggerCorpseExplosion();
    if (skill === 'boneArmor') castBoneArmor();
  });
});

requestAnimationFrame(gameLoop);
updateHUD();
setMessage('Mova-se, mate as hordas e sustente a noite.');
