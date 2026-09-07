const nationalDayTarget = "2026-10-01T00:00:00+08:00";

export const landingService = {
  getNationalDayCountdownHtml() {
    return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#08090b" />
    <title>2026 国庆假期倒计时</title>
    <style>
      :root {
        color-scheme: dark;
        --ink: #08090b;
        --panel: #121417;
        --line: #3a3d42;
        --paper: #f7f1df;
        --muted: #a5a6a3;
        --red: #e4002b;
        --gold: #e7bd62;
      }

      * { box-sizing: border-box; }

      html, body { min-height: 100%; }

      body {
        margin: 0;
        min-width: 320px;
        background: var(--ink);
        color: var(--paper);
        font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
      }

      #fireworks {
        position: fixed;
        inset: 0;
        z-index: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }

      .page {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-rows: auto 1fr auto;
        min-height: 100svh;
        overflow: hidden;
      }

      .masthead,
      .footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        padding: 24px 32px;
        border-color: var(--line);
      }

      .masthead { border-bottom: 1px solid var(--line); }
      .footer { border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; }

      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--paper);
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0;
      }

      .brand-mark {
        width: 12px;
        height: 12px;
        background: var(--red);
        box-shadow: 16px 0 0 var(--gold);
      }

      .date {
        color: var(--gold);
        font-size: 13px;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0;
      }

      main {
        display: grid;
        align-content: center;
        width: min(1180px, calc(100% - 64px));
        margin: 0 auto;
        padding: 72px 0;
      }

      .eyebrow {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 0 0 22px;
        color: var(--gold);
        font-size: 13px;
        font-weight: 700;
      }

      .eyebrow::before {
        width: 40px;
        height: 1px;
        background: currentColor;
        content: "";
      }

      h1 {
        max-width: 720px;
        margin: 0;
        font-size: 38px;
        font-weight: 700;
        line-height: 1.16;
        letter-spacing: 0;
      }

      .target {
        margin: 18px 0 44px;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.6;
      }

      .target time {
        color: var(--paper);
        font-variant-numeric: tabular-nums;
      }

      .countdown {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        border: 1px solid var(--line);
        background: var(--panel);
      }

      .unit {
        position: relative;
        min-width: 0;
        padding: 30px 24px 25px;
        border-right: 1px solid var(--line);
      }

      .unit:last-child { border-right: 0; }

      .unit::before {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 4px;
        background: var(--red);
        content: "";
        transform: scaleX(0);
        transform-origin: left;
        transition: transform 180ms ease-out;
      }

      .unit.is-updated::before { transform: scaleX(1); }

      .value {
        display: block;
        color: var(--paper);
        font-size: 80px;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0;
        line-height: 0.95;
        text-wrap: nowrap;
      }

      .label {
        display: block;
        margin-top: 18px;
        color: var(--gold);
        font-size: 13px;
        font-weight: 700;
      }

      .status-line {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 22px;
        color: var(--muted);
        font-size: 13px;
      }

      .status-light {
        width: 8px;
        height: 8px;
        background: var(--red);
        box-shadow: 0 0 16px rgba(228, 0, 43, 0.85);
      }

      @media (max-width: 760px) {
        .masthead, .footer { padding: 18px 20px; }
        .masthead { align-items: flex-start; flex-direction: column; gap: 12px; }
        main { width: min(100% - 40px, 560px); padding: 56px 0; }
        h1 { font-size: 30px; }
        .target { margin-bottom: 30px; }
        .countdown { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .unit { padding: 26px 18px 20px; border-bottom: 1px solid var(--line); }
        .unit:nth-child(2) { border-right: 0; }
        .unit:nth-child(n + 3) { border-bottom: 0; }
        .value { font-size: 58px; }
        .footer { align-items: flex-start; flex-direction: column; gap: 8px; }
      }

      @media (max-width: 390px) {
        .value { font-size: 50px; }
        h1 { font-size: 27px; }
      }
    </style>
  </head>
  <body>
    <canvas id="fireworks" aria-hidden="true"></canvas>
    <div class="page">
      <header class="masthead">
        <div class="brand"><span class="brand-mark" aria-hidden="true"></span><span>2026 国庆假期</span></div>
        <div class="date">10.01 / 北京时间</div>
      </header>
      <main>
        <p class="eyebrow">假期倒计时</p>
        <h1>距离国庆假期开始，还有</h1>
        <p class="target">目标时刻：<time datetime="${nationalDayTarget}">2026-10-01 00:00:00 GMT+8</time></p>
        <section class="countdown" aria-label="距国庆假期开始的倒计时">
          <div class="unit" data-unit="days"><span class="value">00</span><span class="label">天</span></div>
          <div class="unit" data-unit="hours"><span class="value">00</span><span class="label">小时</span></div>
          <div class="unit" data-unit="minutes"><span class="value">00</span><span class="label">分钟</span></div>
          <div class="unit" data-unit="seconds"><span class="value">00</span><span class="label">秒</span></div>
        </section>
        <div class="status-line"><span class="status-light" aria-hidden="true"></span><span id="countdown-status">正在校准北京时间</span></div>
      </main>
      <footer class="footer"><span>精确至秒</span><span>目标：2026-10-01 00:00:00 GMT+8</span></footer>
    </div>
    <script>
      (() => {
        const target = new Date("${nationalDayTarget}").getTime();
        const status = document.querySelector("#countdown-status");
        const units = {
          days: document.querySelector('[data-unit="days"]'),
          hours: document.querySelector('[data-unit="hours"]'),
          minutes: document.querySelector('[data-unit="minutes"]'),
          seconds: document.querySelector('[data-unit="seconds"]')
        };

        const format = (value, minimumDigits) => String(value).padStart(minimumDigits, "0");

        const renderUnit = (name, value, minimumDigits) => {
          const unit = units[name];
          const nextValue = format(value, minimumDigits);
          const output = unit.querySelector(".value");
          if (output.textContent === nextValue) return;
          output.textContent = nextValue;
          unit.classList.remove("is-updated");
          requestAnimationFrame(() => unit.classList.add("is-updated"));
        };

        const updateCountdown = () => {
          const remaining = Math.max(0, target - Date.now());
          const totalSeconds = Math.floor(remaining / 1000);
          const days = Math.floor(totalSeconds / 86400);
          const hours = Math.floor((totalSeconds % 86400) / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;

          renderUnit("days", days, 2);
          renderUnit("hours", hours, 2);
          renderUnit("minutes", minutes, 2);
          renderUnit("seconds", seconds, 2);
          status.textContent = remaining > 0 ? "北京时间同步中，精确至秒" : "国庆假期已经开始";

          window.setTimeout(updateCountdown, 1000 - (Date.now() % 1000) + 20);
        };

        updateCountdown();

        const canvas = document.querySelector("#fireworks");
        const context = canvas.getContext("2d");
        const sparks = [];
        let width = 0;
        let height = 0;
        let nextBurstAt = 0;

        const resizeCanvas = () => {
          const scale = Math.min(window.devicePixelRatio || 1, 2);
          width = window.innerWidth;
          height = window.innerHeight;
          canvas.width = Math.round(width * scale);
          canvas.height = Math.round(height * scale);
          canvas.style.width = width + "px";
          canvas.style.height = height + "px";
          context.setTransform(scale, 0, 0, scale, 0, 0);
        };

        const launchBurst = () => {
          const originX = width * (0.18 + Math.random() * 0.64);
          const originY = height * (0.12 + Math.random() * 0.36);
          const palette = ["#e4002b", "#e7bd62", "#f7f1df"];
          for (let index = 0; index < 56; index += 1) {
            const angle = (Math.PI * 2 * index) / 56 + Math.random() * 0.12;
            const speed = 0.75 + Math.random() * 2.1;
            sparks.push({
              x: originX,
              y: originY,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              alpha: 0.8 + Math.random() * 0.2,
              size: 1 + Math.random() * 1.8,
              color: palette[index % palette.length]
            });
          }
        };

        const drawFireworks = (now) => {
          context.clearRect(0, 0, width, height);
          if (now >= nextBurstAt) {
            launchBurst();
            nextBurstAt = now + 2400 + Math.random() * 1800;
          }

          for (let index = sparks.length - 1; index >= 0; index -= 1) {
            const spark = sparks[index];
            spark.x += spark.vx;
            spark.y += spark.vy;
            spark.vy += 0.012;
            spark.alpha -= 0.009;
            if (spark.alpha <= 0) {
              sparks.splice(index, 1);
              continue;
            }
            context.globalAlpha = spark.alpha;
            context.fillStyle = spark.color;
            context.fillRect(spark.x, spark.y, spark.size, spark.size);
          }

          context.globalAlpha = 1;
          requestAnimationFrame(drawFireworks);
        };

        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);
        requestAnimationFrame(drawFireworks);
      })();
    </script>
  </body>
</html>`;
  }
};
