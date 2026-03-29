document.addEventListener("DOMContentLoaded", () => {
  console.log("=== DOODLE JUMP — GLASS STYLE ===");

  // Telegram
  let tg = null;
  try {
    tg = window.Telegram?.WebApp;
    if (tg) {
      tg.expand();
      tg.ready();
    }
  } catch (e) {}

  // DOM
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const scoreElement = document.getElementById("scoreValue");
  const balanceElement = document.getElementById("balanceValue");
  const comboBox = document.getElementById("comboBox");
  const comboValue = document.getElementById("comboValue");
  const restartButton = document.getElementById("restartButton");
  const infoBtn = document.getElementById("infoBtn");
  const modal = document.getElementById("infoModal");
  const modalClose = document.querySelector(".modal-close");
  const fullscreenBtn = document.getElementById("fullscreenBtn");

  canvas.width = 360;
  canvas.height = 540;

  // Fullscreen
  if (fullscreenBtn) {
    fullscreenBtn.onclick = () => {
      if (canvas.requestFullscreen) canvas.requestFullscreen();
      else if (canvas.webkitRequestFullscreen) canvas.webkitRequestFullscreen();
    };
  }

  // ==================== GAME STATE ====================
  let gameMode = "practice";
  let gameRunning = true;
  let score = 0;
  let bestScore = localStorage.getItem("bestScore") || 0;
  let gamesPlayed = parseInt(localStorage.getItem("gamesPlayed")) || 0;
  let tournamentsPlayed =
    parseInt(localStorage.getItem("tournamentsPlayed")) || 0;
  let combo = 0;
  let multiplier = 1;

  // ==================== BALANCE ====================
  let playerBalance = 0;
  let playerId = "player_" + Math.random().toString(36).substr(2, 8);
  let currentTournament = null;
  let tournaments = [];
  let gameHistory = [];

  function loadData() {
    const savedBalance = localStorage.getItem(`balance_${playerId}`);
    playerBalance = savedBalance ? parseInt(savedBalance) : 100;
    updateBalance();
    const savedTournaments = localStorage.getItem("tournaments");
    if (savedTournaments) tournaments = JSON.parse(savedTournaments);
    const savedHistory = localStorage.getItem(`history_${playerId}`);
    if (savedHistory) gameHistory = JSON.parse(savedHistory);
    renderTournaments();
  }

  function saveData() {
    localStorage.setItem(`balance_${playerId}`, playerBalance);
    localStorage.setItem("tournaments", JSON.stringify(tournaments));
    localStorage.setItem(`history_${playerId}`, JSON.stringify(gameHistory));
    updateBalance();
  }

  function updateBalance() {
    if (balanceElement) balanceElement.textContent = playerBalance;
  }

  function addHistory(type, amount, desc) {
    gameHistory.unshift({
      id: Date.now(),
      type,
      amount,
      desc,
      date: new Date().toLocaleString(),
    });
    if (gameHistory.length > 30) gameHistory.pop();
    saveData();
    renderTournaments();
  }

  function deposit() {
    let amount = 100;
    if (tg && tg.showPopup) {
      tg.showPopup(
        {
          title: "💎 Пополнение",
          message: "Выберите сумму",
          buttons: [
            { id: "100", text: "100⭐" },
            { id: "500", text: "500⭐" },
            { id: "1000", text: "1000⭐" },
            { id: "cancel", text: "Отмена", type: "cancel" },
          ],
        },
        (id) => {
          if (id !== "cancel") {
            amount = parseInt(id);
            playerBalance += amount;
            saveData();
            addHistory("deposit", amount, `Пополнение на ${amount}⭐`);
            if (tg && tg.showAlert)
              tg.showAlert(`✅ Баланс пополнен на ${amount}⭐`);
          }
        },
      );
    } else {
      amount = parseInt(prompt("Сумма пополнения (демо):", "100"));
      if (amount > 0) {
        playerBalance += amount;
        saveData();
        addHistory("deposit", amount, `Пополнение на ${amount}⭐`);
        alert(`✅ Баланс пополнен на ${amount}⭐`);
      }
    }
  }

  function withdraw() {
    if (playerBalance < 10) {
      alert("Минимальная сумма вывода: 10⭐");
      return;
    }
    if (tg && tg.showPopup) {
      tg.showPopup(
        {
          title: "💸 Вывод",
          message: `Вывести ${playerBalance}⭐?`,
          buttons: [
            { id: "confirm", text: "Вывести" },
            { id: "cancel", text: "Отмена", type: "cancel" },
          ],
        },
        (id) => {
          if (id === "confirm") {
            addHistory("withdraw", -playerBalance, `Вывод ${playerBalance}⭐`);
            playerBalance = 0;
            saveData();
            if (tg && tg.showAlert) tg.showAlert("✅ Заявка отправлена!");
          }
        },
      );
    } else {
      if (confirm(`Вывести ${playerBalance}⭐?`)) {
        addHistory("withdraw", -playerBalance, `Вывод ${playerBalance}⭐`);
        playerBalance = 0;
        saveData();
        alert("✅ Заявка отправлена!");
      }
    }
  }

  function createTournament(stake, maxPlayers) {
    if (playerBalance < stake) {
      alert(`❌ Не хватает ${stake}⭐`);
      return false;
    }
    playerBalance -= stake;
    tournaments.push({
      id: Date.now(),
      stake,
      maxPlayers,
      players: [{ id: playerId, score: 0, finished: false }],
      status: "waiting",
      winner: null,
      prizePool: stake * maxPlayers,
      createdAt: Date.now(),
    });
    saveData();
    addHistory("create", -stake, `Создан турнир на ${stake}⭐`);
    renderTournaments();
    alert(`✅ Турнир создан! Ожидайте участников`);
    return true;
  }

  window.joinTournament = function (tId) {
    const t = tournaments.find((t) => t.id === tId);
    if (!t || t.status !== "waiting") return alert("Турнир недоступен");
    if (t.players.length >= t.maxPlayers) return alert("Турнир заполнен");
    if (playerBalance < t.stake) return alert(`Не хватает ${t.stake}⭐`);
    if (t.players.some((p) => p.id === playerId))
      return alert("Вы уже участвуете");
    playerBalance -= t.stake;
    t.players.push({ id: playerId, score: 0, finished: false });
    currentTournament = t;
    saveData();
    addHistory("join", -t.stake, `Вступление в турнир на ${t.stake}⭐`);
    renderTournaments();
    alert(`✅ Вы вступили в турнир!`);
    return true;
  };

  function finishGame(score) {
    if (gameMode === "tournament" && currentTournament) {
      const player = currentTournament.players.find((p) => p.id === playerId);
      if (player && !player.finished) {
        player.score = score;
        player.finished = true;
        saveData();
        tournamentsPlayed++;
        localStorage.setItem("tournamentsPlayed", tournamentsPlayed);
        if (currentTournament.players.every((p) => p.finished)) {
          const winner = currentTournament.players.reduce((max, p) =>
            p.score > max.score ? p : max,
          );
          const commission = Math.floor(currentTournament.prizePool * 0.1);
          const prize = currentTournament.prizePool - commission;
          if (winner.id === playerId) {
            playerBalance += prize;
            addHistory("win", prize, `🏆 Победа! +${prize}⭐`);
            alert(`🏆 ПОБЕДА! Выигрыш: ${prize}⭐`);
          } else {
            addHistory(
              "lose",
              -currentTournament.stake,
              `Проигрыш (счет ${score})`,
            );
            alert(`😔 Поражение. Победитель набрал ${winner.score}`);
          }
          currentTournament = null;
          saveData();
        } else {
          alert(`Игра завершена! Счет: ${score}\nОжидаем остальных`);
        }
      }
    } else {
      gamesPlayed++;
      localStorage.setItem("gamesPlayed", gamesPlayed);
      addHistory("practice", 0, `Тренировка: ${score} очков`);
      if (score > bestScore) {
        bestScore = score;
        localStorage.setItem("bestScore", bestScore);
      }
    }
    renderTournaments();
  }

  function renderTournaments() {
    const container = document.getElementById("tournamentsContainer");
    const myContainer = document.getElementById("myTournamentsContainer");
    const historyContainer = document.getElementById("historyContainer");
    if (!container) return;
    const active = tournaments.filter((t) => t.status === "waiting");
    container.innerHTML = active.length
      ? active
          .map(
            (t) => `
            <div class="tournament-card">
                <div><div class="tournament-stake">💰 ${t.stake}⭐</div><div class="tournament-players">👥 ${t.players.length}/${t.maxPlayers}</div></div>
                ${!t.players.some((p) => p.id === playerId) ? `<button class="tournament-btn join" onclick="window.joinTournament(${t.id})">JOIN</button>` : '<span style="color:#4caf50">✓</span>'}
            </div>
        `,
          )
          .join("")
      : '<div class="empty-message">✨ No active tournaments</div>';
    const my = tournaments.filter(
      (t) =>
        t.players.some((p) => p.id === playerId) && t.status !== "finished",
    );
    myContainer.innerHTML = my.length
      ? my
          .map(
            (t) => `
            <div class="tournament-card"><div>💰 ${t.stake}⭐</div><span>${t.status === "waiting" ? "⏳" : "🎮"}</span></div>
        `,
          )
          .join("")
      : '<div class="empty-message">📭 You are not participating</div>';
    historyContainer.innerHTML =
      gameHistory
        .slice(0, 10)
        .map(
          (h) => `
            <div class="history-item"><span>${h.desc}</span><span class="${h.amount > 0 ? "history-win" : h.amount < 0 ? "history-lose" : ""}">${h.amount > 0 ? "+" : ""}${h.amount}</span></div>
        `,
        )
        .join("") || '<div class="empty-message">📭 No history yet</div>';
  }

  // ==================== GAME LOGIC ====================
  let powerupTimer = 0,
    activePowerup = null;
  let debris = [],
    particles = [];
  let obstacles = [],
    powerups = [];

  const player = {
    x: canvas.width / 2 - 14,
    y: canvas.height - 100,
    width: 28,
    height: 28,
    velocityY: 0,
    velocityX: 0,
    gravity: 0.28,
    jumpPower: -8.5,
    rotation: 0,
  };

  let platforms = [];
  const platformWidth = 60,
    platformHeight = 12,
    platformGap = 80;
  const platformTypes = {
    NORMAL: "normal",
    GOLD: "gold",
    BOUNCE: "bounce",
    MUSHROOM: "mushroom",
    ICE: "ice",
    CLOUD: "cloud",
  };

  let coins = [],
    floatingNumbers = [],
    leaves = [],
    cameraY = 0;
  let trees = [],
    clouds = [],
    stars = [],
    fireflies = [];

  function generateBackground() {
    for (let i = 0; i < 10; i++)
      trees.push({
        x: Math.random() * canvas.width,
        y: canvas.height - 80 + Math.random() * 100,
        height: 50 + Math.random() * 40,
        width: 18 + Math.random() * 12,
      });
    for (let i = 0; i < 4; i++)
      clouds.push({
        x: Math.random() * canvas.width,
        y: 30 + Math.random() * 120,
        size: 35 + Math.random() * 25,
        speed: 0.2 + Math.random() * 0.3,
      });
    for (let i = 0; i < 25; i++)
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.4,
        size: 1 + Math.random() * 2,
        twinkle: Math.random() * Math.PI * 2,
      });
    for (let i = 0; i < 6; i++)
      fireflies.push({
        x: Math.random() * canvas.width,
        y: canvas.height - 100 + Math.random() * 120,
        size: 3 + Math.random() * 2,
        speedX: (Math.random() - 0.5) * 0.5,
        speedY: (Math.random() - 0.5) * 0.3,
        phase: Math.random() * Math.PI * 2,
      });
  }

  function addParticles(x, y, color, count) {
    for (let i = 0; i < count; i++)
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3 - 1,
        life: 0.8,
        size: 2 + Math.random() * 3,
        color,
      });
  }

  function updateParticles() {
    for (let p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life -= 0.02;
    }
    particles = particles.filter((p) => p.life > 0);
  }

  function createExplosion() {
    debris = [];
    for (let i = 0; i < 35; i++)
      debris.push({
        x: player.x + player.width / 2,
        y: player.y + player.height / 2,
        vx: (Math.random() - 0.5) * 7,
        vy: (Math.random() - 0.5) * 7 - 2,
        size: 3 + Math.random() * 4,
        color: `hsl(${320 + Math.random() * 40}, 70%, 60%)`,
        life: 1,
        rotation: Math.random() * Math.PI * 2,
      });
  }

  // TOUCH CONTROLS
  canvas.style.touchAction = "none";
  let touchStartX = 0;
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    touchStartX = (e.touches[0].clientX - rect.left) * scaleX;
  });
  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (!gameRunning) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    let currentX = (e.touches[0].clientX - rect.left) * scaleX;
    let newX = player.x + (currentX - touchStartX);
    newX = Math.max(0, Math.min(canvas.width - player.width, newX));
    player.x = newX;
    touchStartX = currentX;
  });
  canvas.addEventListener("touchend", (e) => e.preventDefault());
  let isDraggingMouse = false;
  canvas.addEventListener("mousedown", (e) => {
    isDraggingMouse = true;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    let mouseX = (e.clientX - rect.left) * scaleX;
    player.x = Math.max(
      0,
      Math.min(canvas.width - player.width, mouseX - player.width / 2),
    );
  });
  canvas.addEventListener("mousemove", (e) => {
    if (!isDraggingMouse || !gameRunning) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    let mouseX = (e.clientX - rect.left) * scaleX;
    player.x = Math.max(
      0,
      Math.min(canvas.width - player.width, mouseX - player.width / 2),
    );
  });
  canvas.addEventListener("mouseup", () => (isDraggingMouse = false));

  function init() {
    gameRunning = true;
    score = 0;
    combo = 0;
    multiplier = 1;
    debris = [];
    particles = [];
    obstacles = [];
    powerups = [];
    powerupTimer = 0;
    activePowerup = null;
    updateScore();
    updateCombo();
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height - 100;
    player.velocityY = 0;
    player.velocityX = 0;
    player.rotation = 0;
    cameraY = 0;
    platforms = [];
    coins = [];
    floatingNumbers = [];
    leaves = [];
    platforms.push({
      x: canvas.width / 2 - platformWidth / 2,
      y: canvas.height - 50,
      width: platformWidth,
      height: platformHeight,
      type: platformTypes.NORMAL,
      bounceEffect: 0,
      wobble: 0,
    });
    for (let i = 1; i < 10; i++)
      addRandomPlatform(canvas.height - 50 - i * platformGap);
    if (restartButton) restartButton.style.display = "none";
  }

  function addRandomPlatform(y) {
    const x = 20 + Math.random() * (canvas.width - platformWidth - 40);
    let type = platformTypes.NORMAL;
    const r = Math.random();
    if (r < 0.08) type = platformTypes.GOLD;
    else if (r < 0.15) type = platformTypes.BOUNCE;
    else if (r < 0.21) type = platformTypes.MUSHROOM;
    else if (r < 0.26) type = platformTypes.ICE;
    else if (r < 0.31) type = platformTypes.CLOUD;
    const platform = {
      x,
      y,
      width: platformWidth,
      height: platformHeight,
      type,
      bounceEffect: 0,
      wobble: 0,
    };
    platforms.push(platform);
    if (Math.random() < 0.25)
      coins.push({
        x: platform.x + platform.width / 2 - 5,
        y: platform.y - 10,
        width: 10,
        height: 10,
        collected: false,
        rotation: 0,
      });
    if (Math.random() < 0.12 && type !== platformTypes.GOLD)
      powerups.push({
        x: platform.x + platform.width / 2 - 7,
        y: platform.y - 15,
        width: 14,
        height: 14,
        type: ["magnet", "slow", "shield"][Math.floor(Math.random() * 3)],
        collected: false,
        rotation: 0,
      });
    if (Math.random() < 0.1 && y > canvas.height * 0.3)
      obstacles.push({
        x: platform.x + Math.random() * (platform.width - 16),
        y: platform.y - 6,
        width: 10,
        height: 6,
        type: "spike",
      });
    if (Math.random() < 0.3)
      leaves.push({
        x: platform.x + Math.random() * platform.width,
        y: platform.y - 3,
        rotation: Math.random() * Math.PI * 2,
      });
  }

  function updatePlayer() {
    let grav = player.gravity,
      jump = player.jumpPower;
    if (activePowerup === "slow") grav = player.gravity * 0.6;
    else if (activePowerup === "magnet") {
      for (let c of coins)
        if (!c.collected) {
          const dx = player.x + player.width / 2 - (c.x + c.width / 2),
            dy = player.y + player.height / 2 - (c.y + c.height / 2),
            dist = Math.hypot(dx, dy);
          if (dist < 70) {
            c.x += dx * 0.1;
            c.y += dy * 0.1;
          }
        }
    }
    player.velocityY += grav;
    player.y += player.velocityY;
    player.rotation += player.velocityX * 0.05;
    player.rotation *= 0.95;
    if (player.x + player.width < 0) player.x = canvas.width;
    if (player.x > canvas.width) player.x = -player.width;
    let onPlatform = false;
    for (let p of platforms) {
      if (
        player.velocityY > 0 &&
        player.y + player.height >= p.y &&
        player.y + player.height <= p.y + p.height + 8 &&
        player.x + player.width > p.x &&
        player.x < p.x + p.width
      ) {
        let power = jump;
        if (p.type === platformTypes.GOLD) {
          power = jump * 0.85;
          addPoints(50, p.x + p.width / 2, p.y);
          addFloatingText("+50", p.x + p.width / 2, p.y, "#ffaa44");
          addParticles(p.x + p.width / 2, p.y, "#FFD700", 6);
          p.type = platformTypes.NORMAL;
        } else if (p.type === platformTypes.BOUNCE) {
          power = jump * 1.65;
          addFloatingText("BOUNCE!", p.x + p.width / 2, p.y, "#ff8844");
          p.bounceEffect = 0.6;
        } else if (p.type === platformTypes.MUSHROOM) {
          power = jump * 0.8;
          addPoints(20, p.x + p.width / 2, p.y);
          addFloatingText("+20", p.x + p.width / 2, p.y, "#88ff88");
          p.type = platformTypes.NORMAL;
        } else if (p.type === platformTypes.ICE) {
          power = jump * 1.1;
          player.velocityX *= 1.15;
          addFloatingText("SLIP!", p.x + p.width / 2, p.y, "#88ccff");
        } else if (p.type === platformTypes.CLOUD) {
          power = jump * 0.9;
          p.wobble = 0.5;
          addFloatingText("POOF!", p.x + p.width / 2, p.y, "#ffffff");
        }
        player.velocityY = power;
        player.y = p.y - player.height;
        onPlatform = true;
        combo++;
        multiplier = 1 + Math.floor(combo / 8);
        if (multiplier > 5) multiplier = 5;
        updateCombo();
        if (multiplier > 1)
          addFloatingText(
            `x${multiplier} COMBO!`,
            player.x + player.width / 2,
            player.y,
            "#ffaa66",
          );
        addParticles(p.x + p.width / 2, p.y, "#FFFFFF", 4);
        break;
      }
    }
    for (let p of platforms) {
      if (p.bounceEffect > 0) p.bounceEffect -= 0.05;
      if (p.wobble > 0) p.wobble -= 0.03;
    }
    for (let o of obstacles) {
      if (
        player.x + player.width > o.x &&
        player.x < o.x + o.width &&
        player.y + player.height > o.y &&
        player.y < o.y + o.height
      ) {
        if (activePowerup !== "shield") {
          gameRunning = false;
          createExplosion();
          finishGame(Math.floor(score));
        }
      }
    }
    if (!onPlatform && player.velocityY > 0) {
      combo = 0;
      multiplier = 1;
      updateCombo();
    }
    if (player.y > canvas.height && gameRunning) {
      gameRunning = false;
      createExplosion();
      finishGame(Math.floor(score));
    }
    if (player.y < 0) {
      player.y = 0;
      if (player.velocityY < 0) player.velocityY = 0;
    }
    if (powerupTimer > 0) {
      powerupTimer--;
      if (powerupTimer <= 0) activePowerup = null;
    }
    if (!gameRunning && restartButton) restartButton.style.display = "block";
  }

  function updatePowerups() {
    for (let p of powerups) {
      p.rotation += 0.1;
      if (
        !p.collected &&
        player.x + player.width > p.x &&
        player.x < p.x + p.width &&
        player.y + player.height > p.y &&
        player.y < p.y + p.height
      ) {
        p.collected = true;
        activePowerup = p.type;
        powerupTimer = 300;
        let text =
          p.type === "magnet"
            ? "MAGNET!"
            : p.type === "slow"
              ? "SLOW MOTION!"
              : "SHIELD!";
        addFloatingText(text, p.x + p.width / 2, p.y, "#88ff88");
        addParticles(p.x + p.width / 2, p.y, "#88ff88", 10);
      }
    }
    powerups = powerups.filter((p) => !p.collected);
  }

  function updateCoins() {
    for (let c of coins) {
      c.rotation += 0.1;
      if (
        !c.collected &&
        player.x + player.width > c.x &&
        player.x < c.x + c.width &&
        player.y + player.height > c.y &&
        player.y < c.y + c.height
      ) {
        c.collected = true;
        addPoints(10, c.x + c.width / 2, c.y);
        addFloatingText("+10", c.x + c.width / 2, c.y, "#ffcc44");
        addParticles(c.x + c.width / 2, c.y, "#FFD700", 5);
      }
    }
    coins = coins.filter((c) => !c.collected);
    for (let l of leaves) {
      l.y += 0.5;
      l.rotation += 0.05;
    }
    leaves = leaves.filter((l) => l.y < canvas.height);
    updateParticles();
  }

  function addPoints(points, x, y) {
    score += points * multiplier;
    updateScore();
    addFloatingText(`+${points * multiplier}`, x, y, "#ffaa66");
  }
  function addFloatingText(text, x, y, color = "#ffffff") {
    floatingNumbers.push({ text, x, y, life: 1, color, vy: -2 });
  }

  function updateCameraAndScore() {
    if (!gameRunning) return;
    if (player.y < canvas.height / 3) {
      const diff = canvas.height / 3 - player.y;
      player.y += diff;
      score += Math.floor(diff * 0.5);
      updateScore();
      for (let p of platforms) p.y += diff;
      for (let c of coins) c.y += diff;
      for (let l of leaves) l.y += diff;
      for (let c of clouds) c.y += diff * 0.3;
      for (let o of obstacles) o.y += diff;
      for (let p of powerups) p.y += diff;
      for (let f of fireflies) f.y += diff * 0.2;
      platforms = platforms.filter((p) => p.y < canvas.height);
      coins = coins.filter((c) => c.y < canvas.height);
      leaves = leaves.filter((l) => l.y < canvas.height);
      obstacles = obstacles.filter((o) => o.y < canvas.height);
      powerups = powerups.filter((p) => p.y < canvas.height);
      while (platforms.length < 10) {
        const highest = Math.min(...platforms.map((p) => p.y));
        addRandomPlatform(highest - platformGap);
      }
    }
    for (let c of clouds) {
      c.x += c.speed;
      if (c.x > canvas.width + 100) c.x = -100;
    }
    for (let f of fireflies) {
      f.x += f.speedX;
      f.y += f.speedY + Math.sin(Date.now() * 0.002 + f.phase) * 0.3;
      if (f.x < -20) f.x = canvas.width + 20;
      if (f.x > canvas.width + 20) f.x = -20;
      if (f.y < 0) f.y = canvas.height;
      if (f.y > canvas.height) f.y = 0;
    }
  }

  function draw() {
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#0a2f3a");
    grad.addColorStop(0.5, "#2c5a4a");
    grad.addColorStop(1, "#4a784a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let s of stars) {
      ctx.fillStyle = `rgba(255,255,200,${0.3 + Math.sin(Date.now() * 0.002 + s.twinkle) * 0.2})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let f of fireflies) {
      ctx.fillStyle = `rgba(255,255,150,${0.5 + Math.sin(Date.now() * 0.005) * 0.3})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let c of clouds) {
      ctx.fillStyle = "rgba(255,255,245,0.6)";
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.size, c.size * 0.6, 0, 0, Math.PI * 2);
      ctx.ellipse(
        c.x + c.size * 0.7,
        c.y - c.size * 0.2,
        c.size * 0.8,
        c.size * 0.5,
        0,
        0,
        Math.PI * 2,
      );
      ctx.ellipse(
        c.x - c.size * 0.5,
        c.y - c.size * 0.1,
        c.size * 0.7,
        c.size * 0.5,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    for (let t of trees) {
      ctx.fillStyle = "#5D3A1A";
      ctx.fillRect(t.x, t.y - t.height + 20, t.width, t.height);
      ctx.fillStyle = "#3A7B2A";
      ctx.beginPath();
      ctx.ellipse(
        t.x + t.width / 2,
        t.y - t.height,
        t.width * 0.8,
        t.height * 0.5,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.fillStyle = "#5A8A5A";
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 20, canvas.height - 28);
      ctx.lineTo(i * 20 + 10, canvas.height - 45);
      ctx.lineTo(i * 20 - 10, canvas.height - 45);
      ctx.fill();
    }
    for (let p of platforms) {
      let color, glow;
      if (p.type === platformTypes.GOLD) {
        color = "#DAA520";
        glow = "#FFD700";
      } else if (p.type === platformTypes.BOUNCE) {
        color = "#C46A3A";
        glow = "#E88A5A";
      } else if (p.type === platformTypes.MUSHROOM) {
        color = "#8B4513";
        glow = "#A55D2A";
      } else if (p.type === platformTypes.ICE) {
        color = "#88CCFF";
        glow = "#AAEEFF";
      } else if (p.type === platformTypes.CLOUD) {
        color = "#EEEEFF";
        glow = "#FFFFFF";
      } else {
        color = "#8B5A2B";
        glow = "#A87A3A";
      }
      let off = 0;
      if (p.bounceEffect > 0)
        off = Math.sin(Date.now() * 0.02) * 3 * p.bounceEffect;
      if (p.wobble > 0) off = Math.sin(Date.now() * 0.03) * 2 * p.wobble;
      ctx.fillStyle = color;
      ctx.fillRect(p.x, p.y + off, p.width, p.height);
      ctx.fillStyle = glow;
      ctx.fillRect(p.x + 4, p.y + off + 3, p.width - 8, 3);
    }
    for (let o of obstacles) {
      ctx.fillStyle = "#AA5544";
      ctx.beginPath();
      ctx.moveTo(o.x, o.y + o.height);
      ctx.lineTo(o.x + o.width / 2, o.y);
      ctx.lineTo(o.x + o.width, o.y + o.height);
      ctx.fill();
    }
    for (let c of coins) {
      ctx.save();
      ctx.translate(c.x + c.width / 2, c.y + c.height / 2);
      ctx.rotate(c.rotation);
      ctx.fillStyle = "#FFD700";
      ctx.beginPath();
      ctx.ellipse(0, 0, 6, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFA500";
      ctx.beginPath();
      ctx.ellipse(0, 0, 3, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    for (let p of powerups) {
      ctx.save();
      ctx.translate(p.x + p.width / 2, p.y + p.height / 2);
      ctx.rotate(p.rotation);
      let col =
        p.type === "magnet"
          ? "#88AAFF"
          : p.type === "slow"
            ? "#AA88FF"
            : "#88FFAA";
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFF";
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        p.type === "magnet" ? "M" : p.type === "slow" ? "S" : "SH",
        0,
        3,
      );
      ctx.restore();
    }
    for (let p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let l of leaves) {
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.rotation);
      ctx.fillStyle = "#6A9E5E";
      ctx.beginPath();
      ctx.ellipse(0, 0, 3, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
    ctx.rotate(player.rotation);
    if (activePowerup === "shield") {
      ctx.beginPath();
      ctx.arc(0, 0, player.width / 2 + 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(136,255,170,0.3)";
      ctx.fill();
    }
    ctx.fillStyle = "#FF69B4";
    ctx.beginPath();
    ctx.ellipse(0, 0, player.width / 2, player.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFF";
    ctx.beginPath();
    ctx.arc(-5, -3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, -3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(-5, -2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5, -2, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 2, 7, 0.1, Math.PI - 0.1);
    ctx.strokeStyle = "#FFF";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#FFAAAA";
    ctx.beginPath();
    ctx.ellipse(-8, 1, 2.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(8, 1, 2.5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (debris.length > 0) {
      for (let d of debris) {
        ctx.globalAlpha = d.life;
        ctx.fillStyle = d.color;
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.rotation);
        ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      for (let d of debris) {
        d.x += d.vx;
        d.y += d.vy;
        d.vy += 0.2;
        d.life -= 0.02;
        d.rotation += 0.1;
      }
      debris = debris.filter((d) => d.life > 0);
    }
    for (let fn of floatingNumbers) {
      ctx.globalAlpha = fn.life;
      ctx.fillStyle = fn.color;
      ctx.font = `bold ${Math.floor(12 + 8 * (1 - fn.life))}px system-ui`;
      ctx.textAlign = "center";
      ctx.fillText(fn.text, fn.x, fn.y + fn.vy * (1 - fn.life));
      fn.life -= 0.02;
      fn.y -= 0.8;
    }
    floatingNumbers = floatingNumbers.filter((fn) => fn.life > 0);
    ctx.globalAlpha = 1;
    if (activePowerup && gameRunning) {
      ctx.font = "bold 10px monospace";
      ctx.fillStyle = "#88FFAA";
      ctx.textAlign = "right";
      ctx.fillText(
        `${activePowerup.toUpperCase()} ${Math.ceil(powerupTimer / 60)}s`,
        canvas.width - 8,
        15,
      );
    }
    if (!gameRunning && debris.length < 5) {
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#FFF";
      ctx.font = "bold 26px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 30);
      ctx.fillStyle = "#FFD966";
      ctx.font = "20px system-ui";
      ctx.fillText(
        `${Math.floor(score)}`,
        canvas.width / 2,
        canvas.height / 2 + 15,
      );
      ctx.fillStyle = "#CCC";
      ctx.font = "13px system-ui";
      ctx.fillText(
        `BEST: ${bestScore}`,
        canvas.width / 2,
        canvas.height / 2 + 55,
      );
    }
    ctx.textAlign = "left";
    ctx.restore();
  }

  function updateScore() {
    if (scoreElement) scoreElement.textContent = Math.floor(score);
  }
  function updateCombo() {
    if (multiplier > 1) {
      if (comboBox) comboBox.style.display = "flex";
      if (comboValue) comboValue.textContent = `x${multiplier}`;
    } else {
      if (comboBox) comboBox.style.display = "none";
    }
  }

  // Navigation - Profile & Season modals
  function showProfile() {
    const level = Math.floor(bestScore / 100) + 1;
    const modalHtml = `
            <div class="modal-content" style="max-width:350px">
                <div class="modal-header"><h2>👤 PROFILE</h2><button class="modal-close" onclick="closeCustomModal()">&times;</button></div>
                <div class="modal-body" style="text-align:center">
                    <div style="font-size:48px">🎮</div>
                    <div style="font-size:24px;font-weight:800;color:#ffd966">LVL ${level}</div>
                    <div style="margin-top:20px">
                        <div class="stat-row"><span>💰 BALANCE</span><span style="color:#ffd966">${playerBalance}⭐</span></div>
                        <div class="stat-row"><span>🏆 BEST SCORE</span><span style="color:#ffd966">${bestScore}</span></div>
                        <div class="stat-row"><span>🎮 GAMES PLAYED</span><span style="color:#ffd966">${gamesPlayed}</span></div>
                        <div class="stat-row"><span>🏆 TOURNAMENTS</span><span style="color:#ffd966">${tournamentsPlayed}</span></div>
                    </div>
                    <button onclick="closeCustomModal()" class="tournament-btn" style="margin-top:20px;width:100%">CLOSE</button>
                </div>
            </div>
        `;
    showModal(modalHtml);
  }

  function showSeason() {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 26);
    endDate.setHours(22, 32, 0, 0);
    const diff = endDate - new Date();
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const modalHtml = `
            <div class="modal-content" style="max-width:350px">
                <div class="modal-header"><h2>📅 SEASON</h2><button class="modal-close" onclick="closeCustomModal()">&times;</button></div>
                <div class="modal-body" style="text-align:center">
                    <div style="background:rgba(0,0,0,0.3);border-radius:40px;padding:12px;margin-bottom:16px">
                        <div style="font-size:11px;color:#b8d4b8">SEASON ENDS IN</div>
                        <div style="font-size:22px;font-weight:800;color:#ffd966">${days}d ${hours}h ${mins}m</div>
                    </div>
                    <div class="rank-badge" style="margin-bottom:16px">
                        <span>🏆 YOUR RANK</span>
                        <div style="font-size:32px;font-weight:800;color:#0a1f0a">#${Math.floor(Math.random() * 50) + 1}</div>
                    </div>
                    <div style="background:rgba(0,0,0,0.25);border-radius:28px;padding:12px;max-height:250px;overflow-y:auto">
                        <div style="font-weight:700;color:#ffd966;margin-bottom:12px">TOP PLAYERS</div>
                        ${["Bearr1025", "Lx", "Robzi here?", "BLACK GHOST", "Эрнест"].map((n, i) => `<div class="leaderboard-item"><span>#${i + 1} ${n}</span><span style="color:#ffd966">${[431, 229, 135, 84, 48][i]}</span></div>`).join("")}
                    </div>
                    <button onclick="closeCustomModal()" class="tournament-btn" style="margin-top:20px;width:100%">CLOSE</button>
                </div>
            </div>
        `;
    showModal(modalHtml);
  }

  function showModal(html) {
    let existingModal = document.getElementById("customModal");
    if (existingModal) existingModal.remove();
    const modalDiv = document.createElement("div");
    modalDiv.id = "customModal";
    modalDiv.className = "modal active";
    modalDiv.innerHTML = html;
    document.body.appendChild(modalDiv);
    window.closeCustomModal = () => modalDiv.remove();
    modalDiv.onclick = (e) => {
      if (e.target === modalDiv) modalDiv.remove();
    };
  }

  // Navigation buttons
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.onclick = () => {
      document
        .querySelectorAll(".nav-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.nav;
      if (tab === "profile") showProfile();
      else if (tab === "season") showSeason();
      else if (tab === "game") {
        document.querySelector(".mode-switch").style.display = "flex";
        document.getElementById("tournamentPanel").classList.remove("active");
        gameMode = "practice";
        document.querySelector('.mode-btn[data-mode="practice"]').click();
      } else if (tab === "tournament") {
        document.querySelector(".mode-switch").style.display = "flex";
        document.getElementById("tournamentPanel").classList.add("active");
        gameMode = "tournament";
        document.querySelector('.mode-btn[data-mode="tournament"]').click();
      }
    };
  });

  function switchMode(mode) {
    gameMode = mode;
    document.querySelectorAll(".mode-btn").forEach((btn) => {
      if (btn.dataset.mode === mode) btn.classList.add("active");
      else btn.classList.remove("active");
    });
    if (mode === "practice") currentTournament = null;
  }
  document
    .querySelectorAll(".mode-btn")
    .forEach((btn) => (btn.onclick = () => switchMode(btn.dataset.mode)));

  const createBtn = document.getElementById("createTournamentBtn");
  if (createBtn)
    createBtn.onclick = () => {
      const stake = parseInt(document.getElementById("betAmount").value);
      const maxPlayers = parseInt(document.getElementById("groupSize").value);
      if (stake < 10) alert("Min stake 10⭐");
      else createTournament(stake, maxPlayers);
    };

  if (infoBtn && modal && modalClose) {
    infoBtn.onclick = () => modal.classList.add("active");
    modalClose.onclick = () => modal.classList.remove("active");
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.remove("active");
    };
  }
  if (restartButton) restartButton.onclick = () => init();

  generateBackground();
  loadData();
  init();
  renderTournaments();
  switchMode("practice");

  function gameLoop() {
    if (gameRunning) {
      updatePlayer();
      updateCoins();
      updatePowerups();
      updateCameraAndScore();
    }
    draw();
    requestAnimationFrame(gameLoop);
  }
  gameLoop();

  console.log("DOODLE JUMP — GLASS STYLE READY");
});
