document.addEventListener("DOMContentLoaded", () => {
  console.log("=== DOODLE JUMP — GLASS STYLE v4 ===");

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

  if (fullscreenBtn) {
    fullscreenBtn.onclick = () => {
      if (canvas.requestFullscreen) canvas.requestFullscreen();
      else if (canvas.webkitRequestFullscreen) canvas.webkitRequestFullscreen();
    };
  }

  let gameMode = "practice";
  let gameRunning = true;
  let score = 0;
  let bestScore = localStorage.getItem("bestScore") || 0;
  let gamesPlayed = parseInt(localStorage.getItem("gamesPlayed")) || 0;
  let combo = 0;
  let multiplier = 1;

  let playerBalance = 100;
  let playerId = "player_" + Math.random().toString(36).substr(2, 8);
  let tournaments = [];
  let gameHistory = [];

  function updateBalance() {
    if (balanceElement) balanceElement.textContent = playerBalance;
  }

  function addHistory(desc) {
    gameHistory.unshift({ desc, date: new Date().toLocaleString() });
    if (gameHistory.length > 20) gameHistory.pop();
    renderTournaments();
  }

  function finishGame(score) {
    gamesPlayed++;
    localStorage.setItem("gamesPlayed", gamesPlayed);
    addHistory(`Тренировка: ${score} очков`);
    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem("bestScore", bestScore);
    }
  }

  function renderTournaments() {
    const container = document.getElementById("tournamentsContainer");
    const historyContainer = document.getElementById("historyContainer");
    if (!container) return;
    container.innerHTML =
      '<div class="empty-message">✨ No active tournaments</div>';
    historyContainer.innerHTML =
      gameHistory
        .slice(0, 10)
        .map(
          (h) => `
            <div class="history-item"><span>${h.desc}</span></div>
        `,
        )
        .join("") || '<div class="empty-message">📭 No history yet</div>';
  }

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
  const platformTypes = { NORMAL: "normal", GOLD: "gold", BOUNCE: "bounce" };

  let coins = [],
    floatingNumbers = [],
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
  }

  function addParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {}
  }

  function createExplosion() {}

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
    updateScore();
    updateCombo();
    player.x = canvas.width / 2 - player.width / 2;
    player.y = canvas.height - 100;
    player.velocityY = 0;
    player.velocityX = 0;
    cameraY = 0;
    platforms = [];
    coins = [];
    floatingNumbers = [];
    platforms.push({
      x: canvas.width / 2 - platformWidth / 2,
      y: canvas.height - 50,
      width: platformWidth,
      height: platformHeight,
      type: platformTypes.NORMAL,
    });
    for (let i = 1; i < 8; i++)
      addRandomPlatform(canvas.height - 50 - i * platformGap);
    if (restartButton) restartButton.style.display = "none";
  }

  function addRandomPlatform(y) {
    const x = 20 + Math.random() * (canvas.width - platformWidth - 40);
    let type = platformTypes.NORMAL;
    const r = Math.random();
    if (r < 0.1) type = platformTypes.GOLD;
    else if (r < 0.2) type = platformTypes.BOUNCE;
    platforms.push({
      x,
      y,
      width: platformWidth,
      height: platformHeight,
      type,
    });
    if (Math.random() < 0.3)
      coins.push({
        x: x + platformWidth / 2 - 5,
        y: y - 10,
        width: 10,
        height: 10,
        collected: false,
        rotation: 0,
      });
  }

  function updatePlayer() {
    player.velocityY += player.gravity;
    player.y += player.velocityY;
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
        let power = player.jumpPower;
        if (p.type === platformTypes.GOLD) {
          power = player.jumpPower * 0.85;
          score += 50 * multiplier;
          updateScore();
          addFloatingText("+50", p.x + p.width / 2, p.y, "#ffaa44");
          p.type = platformTypes.NORMAL;
        } else if (p.type === platformTypes.BOUNCE) {
          power = player.jumpPower * 1.65;
          addFloatingText("BOUNCE!", p.x + p.width / 2, p.y, "#ff8844");
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
        break;
      }
    }
    if (!onPlatform && player.velocityY > 0) {
      combo = 0;
      multiplier = 1;
      updateCombo();
    }
    if (player.y > canvas.height && gameRunning) {
      gameRunning = false;
      finishGame(Math.floor(score));
    }
    if (player.y < 0) {
      player.y = 0;
      if (player.velocityY < 0) player.velocityY = 0;
    }
    if (!gameRunning && restartButton) restartButton.style.display = "block";
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
        score += 10 * multiplier;
        updateScore();
        addFloatingText("+10", c.x + c.width / 2, c.y, "#ffcc44");
      }
    }
    coins = coins.filter((c) => !c.collected);
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
      for (let c of clouds) c.y += diff * 0.3;
      platforms = platforms.filter((p) => p.y < canvas.height);
      coins = coins.filter((c) => c.y < canvas.height);
      while (platforms.length < 8) {
        const highest = Math.min(...platforms.map((p) => p.y));
        addRandomPlatform(highest - platformGap);
      }
    }
    for (let c of clouds) {
      c.x += c.speed;
      if (c.x > canvas.width + 100) c.x = -100;
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
    for (let p of platforms) {
      let color =
        p.type === platformTypes.GOLD
          ? "#DAA520"
          : p.type === platformTypes.BOUNCE
            ? "#C46A3A"
            : "#8B5A2B";
      ctx.fillStyle = color;
      ctx.fillRect(p.x, p.y, p.width, p.height);
      ctx.fillStyle =
        p.type === platformTypes.GOLD
          ? "#FFD700"
          : p.type === platformTypes.BOUNCE
            ? "#E88A5A"
            : "#A87A3A";
      ctx.fillRect(p.x + 4, p.y + 3, p.width - 8, 3);
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
    ctx.save();
    ctx.translate(player.x + player.width / 2, player.y + player.height / 2);
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
    ctx.restore();
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
    if (!gameRunning) {
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

  function showProfile() {
    const level = Math.floor(bestScore / 100) + 1;
    alert(
      `👤 PROFILE\n\n💰 BALANCE: ${playerBalance}⭐\n🏆 BEST SCORE: ${bestScore}\n🎮 GAMES PLAYED: ${gamesPlayed}\n⭐ LEVEL: ${level}`,
    );
  }

  function showSeason() {
    alert(
      `📅 SEASON 1\n\n🏆 TOP PLAYERS:\n1. Bearr1025 - 431\n2. Lx - 229\n3. Robzi here? - 135\n\n🏆 YOUR RANK: #${Math.floor(Math.random() * 50) + 1}`,
    );
  }

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
      } else if (tab === "tournament") {
        document.querySelector(".mode-switch").style.display = "flex";
        document.getElementById("tournamentPanel").classList.add("active");
      }
    };
  });

  function switchMode(mode) {
    gameMode = mode;
    document.querySelectorAll(".mode-btn").forEach((btn) => {
      if (btn.dataset.mode === mode) btn.classList.add("active");
      else btn.classList.remove("active");
    });
  }
  document
    .querySelectorAll(".mode-btn")
    .forEach((btn) => (btn.onclick = () => switchMode(btn.dataset.mode)));

  if (infoBtn && modal && modalClose) {
    infoBtn.onclick = () => modal.classList.add("active");
    modalClose.onclick = () => modal.classList.remove("active");
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.remove("active");
    };
  }
  if (restartButton) restartButton.onclick = () => init();

  generateBackground();
  init();
  renderTournaments();
  switchMode("practice");
  updateBalance();

  function gameLoop() {
    if (gameRunning) {
      updatePlayer();
      updateCoins();
      updateCameraAndScore();
    }
    draw();
    requestAnimationFrame(gameLoop);
  }
  gameLoop();

  console.log("DOODLE JUMP — GLASS STYLE READY");
});
