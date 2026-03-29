document.addEventListener("DOMContentLoaded", () => {
  console.log("=== Doodle Jump — Telegram Mini App ===");

  // ОТКЛЮЧАЕМ ТРЯСКУ НА ТЕЛЕФОНЕ
  if ("vibrate" in navigator) {
    navigator.vibrate = function () {}; // отключаем вибрацию
  }

  // Плавная прокрутка без рывков
  document.body.style.overflow = "hidden";
  document.body.style.touchAction = "none";

  // Telegram
  let tg = window.Telegram?.WebApp;
  if (tg) {
    tg.expand();
    if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();
  }

  // DOM элементы
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

  canvas.width = 400;
  canvas.height = 600;

  // ==================== РЕЖИМЫ ====================
  let gameMode = "practice";
  let gameRunning = true;
  let score = 0;
  let bestScore = localStorage.getItem("bestScore") || 0;

  // ==================== БАЛАНС И ТУРНИРЫ ====================
  let playerBalance = 0;
  let playerId =
    "player_" +
    (tg?.initDataUnsafe?.user?.id || Math.random().toString(36).substr(2, 8));
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
    if (tg) tg.MainButton.setText(`💰 ${playerBalance}`);
  }

  function addHistory(type, amount, desc) {
    gameHistory.unshift({
      id: Date.now(),
      type,
      amount,
      desc,
      date: new Date().toLocaleString(),
    });
    if (gameHistory.length > 50) gameHistory.pop();
    saveData();
    renderTournaments();
  }

  function deposit() {
    let amount = 100;
    if (tg) {
      tg.showPopup(
        {
          title: "💎 Пополнение",
          message: "Выберите сумму",
          buttons: [
            { id: "100", text: "100" },
            { id: "500", text: "500" },
            { id: "1000", text: "1000" },
            { id: "cancel", text: "Отмена", type: "cancel" },
          ],
        },
        (id) => {
          if (id !== "cancel") {
            amount = parseInt(id);
            playerBalance += amount;
            saveData();
            addHistory("deposit", amount, `Пополнение на ${amount}`);
            if (tg) tg.showAlert(`✅ Баланс пополнен на ${amount}`);
          }
        },
      );
    } else {
      amount = parseInt(prompt("Сумма пополнения:", "100"));
      if (amount > 0) {
        playerBalance += amount;
        saveData();
        addHistory("deposit", amount, `Пополнение на ${amount}`);
        alert(`✅ Баланс пополнен на ${amount}`);
      }
    }
  }

  function withdraw() {
    if (playerBalance < 10) {
      alert("Минимальная сумма вывода: 10");
      return;
    }
    if (tg) {
      tg.showPopup(
        {
          title: "💸 Вывод",
          message: `Вывести ${playerBalance}?`,
          buttons: [
            { id: "confirm", text: "Вывести" },
            { id: "cancel", text: "Отмена", type: "cancel" },
          ],
        },
        (id) => {
          if (id === "confirm") {
            addHistory("withdraw", -playerBalance, `Вывод ${playerBalance}`);
            playerBalance = 0;
            saveData();
            tg.showAlert("✅ Заявка отправлена!");
          }
        },
      );
    } else {
      if (confirm(`Вывести ${playerBalance}?`)) {
        addHistory("withdraw", -playerBalance, `Вывод ${playerBalance}`);
        playerBalance = 0;
        saveData();
        alert("✅ Заявка отправлена!");
      }
    }
  }

  function createTournament(stake, maxPlayers) {
    if (playerBalance < stake) {
      alert(`❌ Не хватает ${stake}`);
      return false;
    }
    playerBalance -= stake;
    const tournament = {
      id: Date.now(),
      stake,
      maxPlayers,
      players: [{ id: playerId, score: 0, finished: false }],
      status: "waiting",
      winner: null,
      prizePool: stake * maxPlayers,
      createdAt: Date.now(),
    };
    tournaments.push(tournament);
    currentTournament = tournament;
    saveData();
    addHistory("create", -stake, `Создан турнир на ${stake}`);
    renderTournaments();
    alert(`✅ Турнир создан! Ожидайте участников`);
    return true;
  }

  window.joinTournament = function (tId) {
    const t = tournaments.find((t) => t.id === tId);
    if (!t || t.status !== "waiting") return alert("Турнир недоступен");
    if (t.players.length >= t.maxPlayers) return alert("Турнир заполнен");
    if (playerBalance < t.stake) return alert(`Не хватает ${t.stake}`);
    if (t.players.some((p) => p.id === playerId))
      return alert("Вы уже участвуете");

    playerBalance -= t.stake;
    t.players.push({ id: playerId, score: 0, finished: false });
    currentTournament = t;
    saveData();
    addHistory("join", -t.stake, `Вступление в турнир на ${t.stake}`);
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

        if (currentTournament.players.every((p) => p.finished)) {
          const winner = currentTournament.players.reduce((max, p) =>
            p.score > max.score ? p : max,
          );
          const commission = Math.floor(currentTournament.prizePool * 0.1);
          const prize = currentTournament.prizePool - commission;
          if (winner.id === playerId) {
            playerBalance += prize;
            addHistory("win", prize, `🏆 Победа! +${prize}`);
            alert(`🏆 ПОБЕДА! Выигрыш: ${prize}`);
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
                <div class="tournament-info">
                    <div class="tournament-stake">💰 ${t.stake}₽</div>
                    <div>👥 ${t.players.length}/${t.maxPlayers}</div>
                    <div class="tournament-prize">🏆 ${t.stake * t.maxPlayers}₽</div>
                </div>
                ${
                  !t.players.some((p) => p.id === playerId)
                    ? `<button class="tournament-btn join" onclick="window.joinTournament(${t.id})">ВСТУПИТЬ</button>`
                    : '<span style="color:#4caf50">✓ Участвуете</span>'
                }
            </div>
        `,
          )
          .join("")
      : '<div class="empty-message">Нет активных турниров</div>';

    const my = tournaments.filter(
      (t) =>
        t.players.some((p) => p.id === playerId) && t.status !== "finished",
    );
    myContainer.innerHTML = my.length
      ? my
          .map(
            (t) => `
            <div class="tournament-card">
                <div class="tournament-info">
                    <div>💰 ${t.stake}₽</div>
                    <div>👥 ${t.players.length}/${t.maxPlayers}</div>
                    <span class="tournament-status">${t.status === "waiting" ? "⏳ Ожидание" : "🎮 Игра"}</span>
                </div>
            </div>
        `,
          )
          .join("")
      : '<div class="empty-message">Вы не участвуете</div>';

    historyContainer.innerHTML =
      gameHistory
        .slice(0, 15)
        .map(
          (h) => `
            <div class="history-item">
                <span>${h.desc}</span>
                <span class="${h.amount > 0 ? "history-win" : h.amount < 0 ? "history-lose" : ""}">${h.amount > 0 ? "+" : ""}${h.amount}</span>
            </div>
        `,
        )
        .join("") || '<div class="empty-message">История пуста</div>';
  }

  // ==================== ИГРОВАЯ ЛОГИКА ====================
  let combo = 0,
    multiplier = 1,
    powerupTimer = 0,
    activePowerup = null;
  let debris = [],
    particles = [],
    targetX = null,
    isDragging = false;
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
  const platformWidth = 65,
    platformHeight = 14,
    platformGap = 78;
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
    for (let i = 0; i < 12; i++)
      trees.push({
        x: Math.random() * canvas.width,
        y: canvas.height - 80 + Math.random() * 100,
        height: 60 + Math.random() * 40,
        width: 20 + Math.random() * 15,
      });
    for (let i = 0; i < 5; i++)
      clouds.push({
        x: Math.random() * canvas.width,
        y: 30 + Math.random() * 150,
        size: 40 + Math.random() * 30,
        speed: 0.2 + Math.random() * 0.3,
      });
    for (let i = 0; i < 30; i++)
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height * 0.5,
        size: 1 + Math.random() * 2,
        twinkle: Math.random() * Math.PI * 2,
      });
    for (let i = 0; i < 8; i++)
      fireflies.push({
        x: Math.random() * canvas.width,
        y: canvas.height - 100 + Math.random() * 150,
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
    for (let i = 0; i < 40; i++) {
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
  }

  function handleDragMove(clientX, clientY) {
    if (!gameRunning) return;
    const rect = canvas.getBoundingClientRect();
    let canvasX = (clientX - rect.left) * (canvas.width / rect.width);
    canvasX = Math.max(0, Math.min(canvas.width, canvasX));
    targetX = canvasX - player.width / 2;
    isDragging = true;
  }

  function handleDragEnd() {
    isDragging = false;
    targetX = null;
  }

  function updateDragMovement() {
    if (!gameRunning) return;
    if (targetX !== null && isDragging) {
      const diff = targetX - player.x;
      const speed = Math.min(Math.abs(diff) * 0.3, 6);
      player.velocityX = Math.sign(diff) * speed;
    } else {
      player.velocityX *= 0.96;
    }
    player.x += player.velocityX;
  }

  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
  });
  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
  });
  canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    handleDragEnd();
  });
  canvas.addEventListener("mousedown", (e) => {
    e.preventDefault();
    handleDragMove(e.clientX, e.clientY);
  });
  canvas.addEventListener("mousemove", (e) => {
    if (isDragging) {
      e.preventDefault();
      handleDragMove(e.clientX, e.clientY);
    }
  });
  canvas.addEventListener("mouseup", (e) => {
    e.preventDefault();
    handleDragEnd();
  });
  canvas.addEventListener("mouseleave", () => handleDragEnd());

  document.addEventListener("keydown", (e) => {
    if ((e.code === "Space" || e.code === "Enter") && !gameRunning) {
      e.preventDefault();
      init();
    }
  });

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
    targetX = null;
    isDragging = false;
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
    for (let i = 1; i < 12; i++)
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

    if (Math.random() < 0.3)
      coins.push({
        x: platform.x + platform.width / 2 - 6,
        y: platform.y - 12,
        width: 12,
        height: 12,
        collected: false,
        rotation: 0,
      });
    if (Math.random() < 0.12 && type !== platformTypes.GOLD)
      powerups.push({
        x: platform.x + platform.width / 2 - 8,
        y: platform.y - 18,
        width: 16,
        height: 16,
        type: ["magnet", "slow", "shield"][Math.floor(Math.random() * 3)],
        collected: false,
        rotation: 0,
      });
    if (Math.random() < 0.1 && y > canvas.height * 0.3)
      obstacles.push({
        x: platform.x + Math.random() * (platform.width - 20),
        y: platform.y - 8,
        width: 12,
        height: 8,
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
      for (let c of coins) {
        if (!c.collected) {
          const dx = player.x + player.width / 2 - (c.x + c.width / 2);
          const dy = player.y + player.height / 2 - (c.y + c.height / 2);
          const dist = Math.hypot(dx, dy);
          if (dist < 80) {
            c.x += dx * 0.1;
            c.y += dy * 0.1;
          }
        }
      }
    }

    player.velocityY += grav;
    player.y += player.velocityY;
    updateDragMovement();
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
          addParticles(p.x + p.width / 2, p.y, "#FFD700", 8);
          p.type = platformTypes.NORMAL;
        } else if (p.type === platformTypes.BOUNCE) {
          power = jump * 1.7;
          addFloatingText("BOUNCE!", p.x + p.width / 2, p.y, "#ff8844");
          p.bounceEffect = 0.8;
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
        addParticles(p.x + p.width / 2, p.y, "#FFFFFF", 5);
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
        addParticles(p.x + p.width / 2, p.y, "#88ff88", 12);
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
        addParticles(c.x + c.width / 2, c.y, "#FFD700", 6);
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
      while (platforms.length < 12) {
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
      ctx.fillStyle = "rgba(255,255,245,0.7)";
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
    for (let i = 0; i < 25; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 18, canvas.height - 28);
      ctx.lineTo(i * 18 + 10, canvas.height - 48);
      ctx.lineTo(i * 18 - 10, canvas.height - 48);
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
      ctx.fillRect(p.x + 5, p.y + off + 3, p.width - 10, 3);
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
      ctx.ellipse(0, 0, 8, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFA500";
      ctx.beginPath();
      ctx.ellipse(0, 0, 4, 4, 0, 0, Math.PI * 2);
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
      ctx.ellipse(0, 0, 10, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#FFF";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        p.type === "magnet" ? "M" : p.type === "slow" ? "S" : "SH",
        0,
        4,
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
    ctx.arc(-6, -4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(6, -4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(-6, -3, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(6, -3, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 2, 8, 0.1, Math.PI - 0.1);
    ctx.strokeStyle = "#FFF";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#FFAAAA";
    ctx.beginPath();
    ctx.ellipse(-9, 1, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(9, 1, 3, 2, 0, 0, Math.PI * 2);
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
      ctx.font = `bold ${Math.floor(14 + 10 * (1 - fn.life))}px system-ui`;
      ctx.textAlign = "center";
      ctx.fillText(fn.text, fn.x, fn.y + fn.vy * (1 - fn.life));
      fn.life -= 0.02;
      fn.y -= 0.8;
    }
    floatingNumbers = floatingNumbers.filter((fn) => fn.life > 0);
    ctx.globalAlpha = 1;

    if (activePowerup && gameRunning) {
      ctx.font = "bold 12px monospace";
      ctx.fillStyle = "#88FFAA";
      ctx.textAlign = "right";
      ctx.fillText(
        `${activePowerup.toUpperCase()} ${Math.ceil(powerupTimer / 60)}s`,
        canvas.width - 10,
        20,
      );
    }

    if (!gameRunning && debris.length < 5) {
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#FFF";
      ctx.font = "bold 32px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 40);
      ctx.fillStyle = "#FFD966";
      ctx.font = "24px system-ui";
      ctx.fillText(
        `${Math.floor(score)}`,
        canvas.width / 2,
        canvas.height / 2 + 20,
      );
      ctx.fillStyle = "#CCC";
      ctx.font = "16px system-ui";
      ctx.fillText(
        `BEST: ${bestScore}`,
        canvas.width / 2,
        canvas.height / 2 + 70,
      );
    }
    ctx.textAlign = "left";
    ctx.restore();
  }

  function updateScore() {
    if (scoreElement) scoreElement.textContent = Math.floor(score);
    if (scoreElement) {
      scoreElement.style.transform = "scale(1.1)";
      setTimeout(() => (scoreElement.style.transform = "scale(1)"), 150);
    }
  }

  function updateCombo() {
    if (multiplier > 1) {
      if (comboBox) comboBox.style.display = "flex";
      if (comboValue) comboValue.textContent = `x${multiplier}`;
      if (comboBox) {
        comboBox.style.animation = "none";
        comboBox.offsetHeight;
        comboBox.style.animation = "comboPulse 0.3s ease";
      }
    } else {
      if (comboBox) comboBox.style.display = "none";
    }
  }

  // Переключение режимов
  function switchMode(mode) {
    gameMode = mode;
    document.querySelectorAll(".mode-btn").forEach((btn) => {
      if (btn.dataset.mode === mode) btn.classList.add("active");
      else btn.classList.remove("active");
    });
    const practice = document.getElementById("practicePanel");
    const tournament = document.getElementById("tournamentPanel");
    if (practice) practice.classList.toggle("active", mode === "practice");
    if (tournament)
      tournament.classList.toggle("active", mode === "tournament");
    if (mode === "practice") currentTournament = null;
    else renderTournaments();
  }

  // Инициализация кнопок с проверкой существования
  const modeBtns = document.querySelectorAll(".mode-btn");
  modeBtns.forEach((btn) => {
    btn.onclick = () => switchMode(btn.dataset.mode);
  });

  const createBtn = document.getElementById("createTournamentBtn");
  if (createBtn) {
    createBtn.onclick = () => {
      const stakeInput = document.getElementById("betAmount");
      const groupSelect = document.getElementById("groupSize");
      const stake = stakeInput ? parseInt(stakeInput.value) : 100;
      const maxPlayers = groupSelect ? parseInt(groupSelect.value) : 2;
      if (stake < 10) {
        alert("Минимальная ставка: 10");
        return;
      }
      createTournament(stake, maxPlayers);
    };
  }

  const refreshBtn = document.getElementById("refreshTournamentBtn");
  if (refreshBtn) refreshBtn.onclick = () => renderTournaments();

  const depositBtn = document.getElementById("depositBtn");
  if (depositBtn) depositBtn.onclick = deposit;

  const withdrawBtn = document.getElementById("withdrawBtn");
  if (withdrawBtn) withdrawBtn.onclick = withdraw;

  if (infoBtn && modal && modalClose) {
    infoBtn.onclick = () => modal.classList.add("active");
    modalClose.onclick = () => modal.classList.remove("active");
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.remove("active");
    };
  }

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

  if (restartButton) restartButton.onclick = () => init();

  if (tg) {
    tg.MainButton.setText(`💰 ${playerBalance}`).show();
    tg.MainButton.onClick(() => {
      if (gameMode === "tournament") deposit();
      else switchMode("tournament");
    });
  }

  console.log("Игра запущена!");
});
