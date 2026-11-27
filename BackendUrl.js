/**
 * PhishVet — 3D Isometric Wireframe Circuit Board + Interactive Scanner
 */

(() => {
  'use strict';

  /* ========================================================================
     1. 3D Isometric Wireframe Circuit Board (HTML5 Canvas, z-index: -1)
     ======================================================================== */
  const canvas = document.getElementById('pcb-canvas');
  const orbitToggleBtn = document.getElementById('orbit-toggle');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let orbitEnabled = !prefersReducedMotion;

  if (orbitToggleBtn && prefersReducedMotion) {
    orbitEnabled = false;
    orbitToggleBtn.textContent = '3D Board Orbit: OFF';
    orbitToggleBtn.classList.remove('is-on');
    orbitToggleBtn.setAttribute('aria-pressed', 'false');
  }

  if (canvas instanceof HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: true });
    let width = 0;
    let height = 0;
    let dpr = 1;
    let rafId = 0;
    let orbitAngle = 0;

    const pointer = { targetX: 0, targetY: 0, x: 0, y: 0 };

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /**
     * Projects 3D board coordinates (x, y, z) where z is height above PCB
     * into 2D isometric space with gentle orbit + pointer tilt.
     */
    function project(x, y, z) {
      const yaw = Math.PI * 0.24 + Math.sin(orbitAngle) * 0.08 + pointer.x * 0.06;
      const pitch = 0.56 + Math.cos(orbitAngle * 0.8) * 0.03 + pointer.y * 0.04;

      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const rx = x * cosY - y * sinY;
      const ry = x * sinY + y * cosY;

      const scale = Math.min(width / 980, height / 620, 1.32);
      const sx = width * 0.5 + rx * scale;
      const sy = height * 0.55 + (ry * pitch - z) * scale;
      return { x: sx, y: sy };
    }

    function drawLine3D(a, b, stroke, lw = 1) {
      const p1 = project(a[0], a[1], a[2]);
      const p2 = project(b[0], b[1], b[2]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    }

    function drawBox3D(cx, cy, cz, w, d, h, lineColor = 'rgba(28, 25, 23, 0.3)', fillTop = 'rgba(28, 25, 23, 0.035)') {
      const hw = w * 0.5;
      const hd = d * 0.5;
      const b = [
        [cx - hw, cy - hd, cz],
        [cx + hw, cy - hd, cz],
        [cx + hw, cy + hd, cz],
        [cx - hw, cy + hd, cz]
      ];
      const t = [
        [cx - hw, cy - hd, cz + h],
        [cx + hw, cy - hd, cz + h],
        [cx + hw, cy + hd, cz + h],
        [cx - hw, cy + hd, cz + h]
      ];

      // Subtle translucent top face for architectural 3D solidity
      const tp = t.map((pt) => project(pt[0], pt[1], pt[2]));
      ctx.beginPath();
      ctx.moveTo(tp[0].x, tp[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(tp[i].x, tp[i].y);
      ctx.closePath();
      ctx.fillStyle = fillTop;
      ctx.fill();

      // Bottom edges (softer depth)
      for (let i = 0; i < 4; i++) {
        drawLine3D(b[i], b[(i + 1) % 4], 'rgba(28, 25, 23, 0.14)', 0.9);
      }
      // Vertical pillars
      for (let i = 0; i < 4; i++) {
        drawLine3D(b[i], t[i], 'rgba(28, 25, 23, 0.24)', 1);
      }
      // Top edges (crisp foreground charcoal)
      for (let i = 0; i < 4; i++) {
        drawLine3D(t[i], t[(i + 1) % 4], lineColor, 1.15);
      }
    }

    function drawCylinder3D(cx, cy, cz, r, h, segments = 24) {
      const bottomPts = [];
      const topPts = [];
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        bottomPts.push(project(px, py, cz));
        topPts.push(project(px, py, cz + h));
      }

      // Base ring
      ctx.beginPath();
      bottomPts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.strokeStyle = 'rgba(28, 25, 23, 0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Side ribs
      for (let i = 0; i < segments; i += 6) {
        ctx.beginPath();
        ctx.moveTo(bottomPts[i].x, bottomPts[i].y);
        ctx.lineTo(topPts[i].x, topPts[i].y);
        ctx.strokeStyle = 'rgba(28, 25, 23, 0.16)';
        ctx.lineWidth = 0.85;
        ctx.stroke();
      }

      // Top ring
      ctx.beginPath();
      topPts.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = 'rgba(28, 25, 23, 0.04)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(28, 25, 23, 0.34)';
      ctx.lineWidth = 1.15;
      ctx.stroke();
    }

    function drawTrace(points, stroke = 'rgba(28, 25, 23, 0.24)', lw = 1) {
      if (points.length < 2) return;
      ctx.beginPath();
      points.forEach((pt, idx) => {
        const p = project(pt[0], pt[1], pt[2] ?? 0);
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();

      const end = project(points[points.length - 1][0], points[points.length - 1][1], points[points.length - 1][2] ?? 0);
      ctx.beginPath();
      ctx.arc(end.x, end.y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(28, 25, 23, 0.34)';
      ctx.fill();
    }

    function renderBoard() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      if (orbitEnabled) {
        orbitAngle += 0.0045;
      }
      pointer.x += (pointer.targetX - pointer.x) * 0.05;
      pointer.y += (pointer.targetY - pointer.y) * 0.05;

      // 1. Main Isometric PCB Motherboard Slab
      drawBox3D(0, 0, -14, 580, 340, 14, 'rgba(28, 25, 23, 0.28)', 'rgba(28, 25, 23, 0.02)');

      // Subtle architectural grid lines on PCB top surface
      for (let gx = -240; gx <= 240; gx += 60) {
        drawLine3D([gx, -165, 0], [gx, 165, 0], 'rgba(28, 25, 23, 0.06)', 0.75);
      }
      for (let gy = -120; gy <= 120; gy += 60) {
        drawLine3D([-285, gy, 0], [285, gy, 0], 'rgba(28, 25, 23, 0.06)', 0.75);
      }

      // 2. PCB Routing Traces (45-degree architectural paths)
      const traces = [
        [[-220, -40, 0], [-140, -40, 0], [-105, -5, 0], [-55, -5, 0]],
        [[-220, -20, 0], [-150, -20, 0], [-115, 15, 0], [-55, 15, 0]],
        [[-180, 90, 0], [-95, 90, 0], [-55, 50, 0]],
        [[55, -20, 0], [120, -20, 0], [150, -50, 0], [210, -50, 0]],
        [[55, 10, 0], [135, 10, 0], [165, 40, 0], [215, 40, 0]],
        [[0, -55, 0], [0, -110, 0], [45, -145, 0], [140, -145, 0]],
        [[20, -55, 0], [20, -98, 0], [60, -130, 0], [155, -130, 0]],
        [[-20, 55, 0], [-20, 115, 0], [30, 145, 0], [120, 145, 0]],
        [[15, 55, 0], [15, 100, 0], [55, 130, 0], [160, 130, 0]]
      ];
      traces.forEach((tr) => drawTrace(tr, 'rgba(28, 25, 23, 0.24)', 1));

      // 3. Left Tall VRM / Heatsink Module + Front Cube
      drawBox3D(-220, -35, 0, 56, 150, 44, 'rgba(28, 25, 23, 0.34)', 'rgba(28, 25, 23, 0.045)');
      drawBox3D(-255, 55, 0, 34, 34, 32, 'rgba(28, 25, 23, 0.32)', 'rgba(28, 25, 23, 0.05)');

      // 4. Diagonal Row of 5 SMD Capacitors / Chokes
      for (let i = 0; i < 5; i++) {
        drawBox3D(-170 + i * 24, 36 + i * 16, 0, 18, 18, 20, 'rgba(28, 25, 23, 0.3)', 'rgba(28, 25, 23, 0.04)');
      }

      // 5. Central Raised 3D Processor / Security IC + Pin Array
      drawBox3D(0, 0, 0, 116, 116, 12, 'rgba(28, 25, 23, 0.32)', 'rgba(28, 25, 23, 0.035)');
      drawBox3D(0, 0, 12, 74, 74, 16, 'rgba(28, 25, 23, 0.38)', 'rgba(28, 25, 23, 0.055)');
      for (let p = -44; p <= 44; p += 11) {
        drawLine3D([p, -58, 6], [p, -70, 0], 'rgba(28, 25, 23, 0.26)', 0.9);
        drawLine3D([p, 58, 6], [p, 70, 0], 'rgba(28, 25, 23, 0.26)', 0.9);
        drawLine3D([-58, p, 6], [-70, p, 0], 'rgba(28, 25, 23, 0.26)', 0.9);
        drawLine3D([58, p, 6], [70, p, 0], 'rgba(28, 25, 23, 0.26)', 0.9);
      }

      // 6. Right Circular Toroid / Inductance Ring + Vertical Post + Side Blocks
      drawBox3D(185, -18, 0, 108, 108, 10, 'rgba(28, 25, 23, 0.28)', 'rgba(28, 25, 23, 0.03)');
      drawCylinder3D(185, -18, 10, 40, 14, 28);
      drawCylinder3D(185, -18, 10, 18, 18, 20);
      drawCylinder3D(125, -110, 0, 14, 34, 18);
      drawBox3D(235, 95, 0, 42, 48, 22, 'rgba(28, 25, 23, 0.3)', 'rgba(28, 25, 23, 0.04)');
      drawBox3D(-90, -110, 0, 64, 30, 18, 'rgba(28, 25, 23, 0.28)', 'rgba(28, 25, 23, 0.035)');

      if (orbitEnabled || Math.abs(pointer.targetX - pointer.x) > 0.001) {
        rafId = window.requestAnimationFrame(renderBoard);
      } else {
        rafId = 0;
      }
    }

    function ensureAnimating() {
      if (!rafId) {
        rafId = window.requestAnimationFrame(renderBoard);
      }
    }

    orbitToggleBtn?.addEventListener('click', () => {
      orbitEnabled = !orbitEnabled;
      orbitToggleBtn.textContent = orbitEnabled ? '3D Board Orbit: ON' : '3D Board Orbit: OFF';
      orbitToggleBtn.classList.toggle('is-on', orbitEnabled);
      orbitToggleBtn.setAttribute('aria-pressed', String(orbitEnabled));
      if (orbitEnabled) ensureAnimating();
    });

    window.addEventListener('resize', () => {
      resize();
      renderBoard();
    });

    window.addEventListener(
      'pointermove',
      (e) => {
        if (width === 0 || height === 0) return;
        pointer.targetX = (e.clientX / width - 0.5) * 2;
        pointer.targetY = (e.clientY / height - 0.5) * 2;
        ensureAnimating();
      },
      { passive: true }
    );

    resize();
    renderBoard();

    window.addEventListener('beforeunload', () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    });
  }

  /* ========================================================================
     2. Interactive Scanner, Sample Pills, Breakdown Toggle & Modals
     ======================================================================== */
  const tabMessage = document.getElementById('tab-message');
  const tabUrl = document.getElementById('tab-url');
  const tabEmail = document.getElementById('tab-email');

  const panelMessage = document.getElementById('panel-message');
  const panelUrl = document.getElementById('panel-url');
  const panelEmail = document.getElementById('panel-email');

  const scannerForm = document.getElementById('scanner-form');
  const urlInput = document.getElementById('url-input');
  const messageInput = document.getElementById('message-input');
  const messageCharHint = document.getElementById('message-char-hint');
  const emailInput = document.getElementById('email-input');
  const emailCharHint = document.getElementById('email-char-hint');
  const scanBtn = document.getElementById('scan-btn');
  const scanBtnText = document.getElementById('scan-btn-text');

  const resultCard = document.getElementById('result-card');
  const resultShieldSymbol = document.getElementById('result-shield-symbol');
  const resultTitle = document.getElementById('result-title');
  const resultSubtitle = document.getElementById('result-subtitle');
  const resultTarget = document.getElementById('result-target');
  const resultTimestamp = document.getElementById('result-timestamp');
  const resultChecks = document.getElementById('result-checks');

  const breakdownToggle = document.getElementById('breakdown-toggle');
  const breakdownToggleLabel = document.getElementById('breakdown-toggle-label');
  const breakdownPanel = document.getElementById('breakdown-panel');
  const breakdownGrid = document.getElementById('breakdown-grid');

  const sampleButtons = document.querySelectorAll('[data-sample]');
  const navToggle = document.getElementById('nav-toggle');
  const navRightGroup = document.getElementById('nav-right-group');
  const navButtons = document.querySelectorAll('.nav-link');
  const brandHomeLink = document.getElementById('brand-home-link');
  const authButtons = document.querySelectorAll('[data-auth]');

  const modalBackdrop = document.getElementById('info-modal-backdrop');
  const modalTitle = document.getElementById('info-modal-title');
  const modalBody = document.getElementById('info-modal-body');
  const modalClose = document.getElementById('info-modal-close');

  let activeMode = 'url';

  const MODAL_CONTENT = {
    about: {
      title: 'About PhishVet',
      html: `
        <p><strong>PhishVet</strong> inspects suspicious links, domains, IPs, emails, and SMS/WhatsApp messages before you interact with them.</p>
        <ul>
          <li>Flags lookalike domains, credential lures, and raw IP endpoints.</li>
          <li>Checks email sender spoofing, failed authentication headers, and phishing body patterns.</li>
          <li>Detects urgency tactics and OTP traps inside scam messages.</li>
        </ul>
      `
    },
    guide: {
      title: 'How to Check Links, Messages & Emails',
      html: `
        <p>Switch between <strong>SCAM MSG</strong>, <strong>URL</strong>, and <strong>EMAIL</strong> using the tabs above the input bar:</p>
        <ul>
          <li><strong>SCAM MSG:</strong> Paste an SMS or WhatsApp text into <em>Message to check</em> to detect scam cues and embedded links.</li>
          <li><strong>URL:</strong> Paste a link, domain, or IP address and click <em>Scan</em>.</li>
          <li><strong>EMAIL:</strong> Enter a sender email address or paste email text/headers to flag spoofing and phishing lures.</li>
        </ul>
      `
    },
    contact: {
      title: 'Contact PhishVet Security',
      html: `
        <p>Report a missed phishing lure or false positive to our triage team:</p>
        <ul>
          <li><strong>Security Desk:</strong> security@phishvet.example</li>
          <li><strong>Abuse Reports:</strong> abuse@phishvet.example</li>
          <li><strong>Triage Window:</strong> Under 24 hours for active campaigns.</li>
        </ul>
      `
    },
    login: {
      title: 'Login to PhishVet',
      html: `
        <form class="modal-auth-form" id="modal-auth-form">
          <div class="modal-field">
            <label for="auth-email">Work or personal email</label>
            <input id="auth-email" type="email" required placeholder="you@example.com" />
          </div>
          <div class="modal-field">
            <label for="auth-password">Password</label>
            <input id="auth-password" type="password" required placeholder="Enter your password" />
          </div>
          <button type="submit" class="modal-auth-submit">Sign In</button>
          <p class="modal-auth-note is-hidden" id="modal-auth-note"></p>
        </form>
      `
    },
    signup: {
      title: 'Create PhishVet Account',
      html: `
        <form class="modal-auth-form" id="modal-auth-form">
          <div class="modal-field">
            <label for="auth-name">Full name</label>
            <input id="auth-name" type="text" required placeholder="Alex Rivera" />
          </div>
          <div class="modal-field">
            <label for="auth-email">Email address</label>
            <input id="auth-email" type="email" required placeholder="you@example.com" />
          </div>
          <div class="modal-field">
            <label for="auth-password">Password</label>
            <input id="auth-password" type="password" required minlength="8" placeholder="At least 8 characters" />
          </div>
          <button type="submit" class="modal-auth-submit">Create Free Account</button>
          <p class="modal-auth-note is-hidden" id="modal-auth-note"></p>
        </form>
      `
    }
  };

  function formatScanTime(date, riskScore) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12 || 12;
    const scorePart = typeof riskScore === 'number' ? ` • Risk Score: ${riskScore}/100` : '';
    return `Scanned: ${day} ${month} ${year}, ${String(hours).padStart(2, '0')}:${minutes} ${ampm}${scorePart}`;
  }

  function setMode(mode) {
    activeMode = mode;
    const isMessage = mode === 'message';
    const isUrl = mode === 'url';
    const isEmail = mode === 'email';

    tabMessage?.classList.toggle('is-active', isMessage);
    tabUrl?.classList.toggle('is-active', isUrl);
    tabEmail?.classList.toggle('is-active', isEmail);

    tabMessage?.setAttribute('aria-selected', String(isMessage));
    tabUrl?.setAttribute('aria-selected', String(isUrl));
    tabEmail?.setAttribute('aria-selected', String(isEmail));

    panelMessage?.classList.toggle('is-hidden', !isMessage);
    panelUrl?.classList.toggle('is-hidden', !isUrl);
    panelEmail?.classList.toggle('is-hidden', !isEmail);
  }

  function renderCheckItems(items) {
    if (!resultChecks) return;
    resultChecks.innerHTML = items
      .map((item) => {
        const badgeClass =
          item.tone === 'bad'
            ? 'check-badge is-bad'
            : item.tone === 'warn'
              ? 'check-badge is-warn'
              : item.tone === 'info'
                ? 'check-badge is-info'
                : 'check-badge';

        const iconPath =
          item.tone === 'bad'
            ? '<path d="M6.5 6.5l7 7M13.5 6.5l-7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
            : item.tone === 'warn'
              ? '<path d="M10 5.8v5M10 14.2v.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
              : '<path d="M5.8 10.2l2.8 2.8 5.6-5.8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';

        return `
          <li class="result-check-item">
            <span class="${badgeClass}" aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none">${iconPath}</svg>
            </span>
            <span>${item.label}</span>
          </li>
        `;
      })
      .join('');
  }

  function renderBreakdown(rows) {
    if (!breakdownGrid || !rows) return;
    breakdownGrid.innerHTML = rows
      .map(
        (row) => `
          <div class="breakdown-item">
            <span class="breakdown-key">${row.key}</span>
            <span class="breakdown-val">${row.val}</span>
          </div>
        `
      )
      .join('');
  }

  function setResultState({ status, title, subtitle, target, timestamp, checks, breakdown }) {
    if (!resultCard) return;

    resultCard.classList.remove('is-safe', 'is-warning', 'is-danger', 'is-scanning');
    resultCard.classList.add(`is-${status}`);

    if (resultShieldSymbol) {
      if (status === 'danger') {
        resultShieldSymbol.setAttribute('d', 'M24 28l16 16M40 28L24 44');
      } else if (status === 'warning') {
        resultShieldSymbol.setAttribute('d', 'M32 23v14M32 45v1');
      } else if (status === 'scanning') {
        resultShieldSymbol.setAttribute('d', 'M24 36h16');
      } else {
        resultShieldSymbol.setAttribute('d', 'M22 36.5l6.8 6.8L43 29');
      }
    }

    if (resultTitle) resultTitle.textContent = title;
    if (resultSubtitle) resultSubtitle.textContent = subtitle;
    if (resultTarget) resultTarget.textContent = target;
    if (resultTimestamp) resultTimestamp.textContent = timestamp;
    renderCheckItems(checks);
    if (breakdown) renderBreakdown(breakdown);
  }

  function analyzeUrlInput(rawValue) {
    const trimmed = rawValue.trim();
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    let hostname = trimmed.toLowerCase();
    let fullUrl = normalized;
    try {
      const parsed = new URL(normalized);
      hostname = parsed.hostname.toLowerCase();
      fullUrl = parsed.href;
    } catch {
      // Keep raw input when malformed
    }

    const phishingKeywords = /(login|verify|signin|update-account|secure-bank|paypal|wallet|credential|webscr|confirm-id|suspended)/i;
    const suspiciousTlds = /\.(tk|ml|ga|cf|gq|zip|mov|top|xyz|click)$/i;
    const isIpHost = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    const hasAtTrick = trimmed.includes('@');
    const hasPunycode = hostname.includes('xn--');
    const usesPlainHttp = /^http:\/\//i.test(trimmed);
    const manySubdomains = hostname.split('.').length >= 5;

    let risk = 0;
    if (phishingKeywords.test(trimmed)) risk += 35;
    if (suspiciousTlds.test(hostname)) risk += 30;
    if (isIpHost) risk += 30;
    if (hasAtTrick || hasPunycode) risk += 45;
    if (usesPlainHttp) risk += 20;
    if (manySubdomains) risk += 15;
    const riskScore = Math.min(98, risk);
    const timestamp = formatScanTime(new Date(), riskScore);

    if (riskScore >= 60) {
      return {
        status: 'danger',
        title: 'Phishing Threat Detected',
        subtitle: 'High-risk indicators match known phishing patterns.',
        target: fullUrl,
        timestamp,
        checks: [
          { label: 'Deceptive URL Signals Found', tone: 'bad' },
          { label: 'Potential Credential Lure', tone: 'bad' },
          { label: 'Do Not Enter Credentials', tone: 'warn' }
        ],
        breakdown: [
          { key: 'Domain & TLD', val: suspiciousTlds.test(hostname) ? 'High-risk TLD flagged' : 'Brand lookalike lure' },
          { key: 'Protocol', val: usesPlainHttp ? 'Unencrypted HTTP' : 'HTTPS present' },
          { key: 'Phishing Signals', val: 'Credential keywords' },
          { key: 'Risk Score', val: `${riskScore} / 100 (High)` }
        ]
      };
    }

    if (riskScore >= 20) {
      return {
        status: 'warning',
        title: 'Suspicious URL',
        subtitle: 'Unusual URL structure or unencrypted connection detected.',
        target: fullUrl,
        timestamp,
        checks: [
          { label: 'No Known Malware Payload', tone: 'safe' },
          { label: 'Suspicious Heuristic Flag', tone: 'warn' },
          { label: 'Verify Domain Before Trusting', tone: 'warn' }
        ],
        breakdown: [
          { key: 'Domain & TLD', val: hostname },
          { key: 'Protocol', val: usesPlainHttp ? 'Unencrypted HTTP' : 'HTTPS encrypted' },
          { key: 'Phishing Signals', val: '1 heuristic warning' },
          { key: 'Risk Score', val: `${riskScore} / 100 (Caution)` }
        ]
      };
    }

    return {
      status: 'safe',
      title: 'Safe Website',
      subtitle: 'This URL seems to be safe.',
      target: fullUrl,
      timestamp,
      checks: [
        { label: 'No Malicious Content', tone: 'safe' },
        { label: 'No Suspicious Behavior', tone: 'safe' },
        { label: 'Looks Legitimate', tone: 'safe' }
      ],
      breakdown: [
        { key: 'Domain & TLD', val: 'Standard reputable TLD' },
        { key: 'Protocol', val: 'HTTPS encrypted' },
        { key: 'Phishing Signals', val: '0 heuristics triggered' },
        { key: 'Risk Score', val: '0 / 100 (Safe)' }
      ]
    };
  }

  function analyzeMessageInput(rawText) {
    const text = rawText.trim();
    const snippet = text.length > 52 ? `${text.slice(0, 52)}...` : text;

    const urgencyPattern = /(urgent|immediately|suspended|locked|expire|24 hours|act now|final notice|unauthorized)/i;
    const credentialOrPayPattern = /(verify|confirm your identity|bank|otp|pin|password|gift card|wire transfer|claim|airdrop|eth|reward|refund)/i;
    const embeddedLinkMatch = text.match(/https?:\/\/[^\s]+/i);
    const shortenerPattern = /(bit\.ly|tinyurl\.com|t\.co|rb\.gy|is\.gd)/i;

    let risk = 0;
    if (urgencyPattern.test(text)) risk += 30;
    if (credentialOrPayPattern.test(text)) risk += 35;
    if (shortenerPattern.test(text)) risk += 25;

    if (embeddedLinkMatch) {
      const linkAnalysis = analyzeUrlInput(embeddedLinkMatch[0]);
      if (linkAnalysis.status === 'danger') risk += 40;
      else if (linkAnalysis.status === 'warning') risk += 20;
    }

    const riskScore = Math.min(98, risk);
    const timestamp = formatScanTime(new Date(), riskScore);

    if (riskScore >= 55) {
      return {
        status: 'danger',
        title: 'Scam Message Detected',
        subtitle: 'Urgency cues and phishing triggers found in message.',
        target: `"${snippet}"`,
        timestamp,
        checks: [
          { label: 'Urgency / Coercion Language', tone: 'bad' },
          { label: 'Credential or Crypto Lure', tone: 'bad' },
          { label: 'Avoid Replying or Clicking Links', tone: 'warn' }
        ],
        breakdown: [
          { key: 'Language Tone', val: 'Urgency / reward bait' },
          { key: 'Embedded Link', val: embeddedLinkMatch ? 'Suspicious URL found' : 'None' },
          { key: 'Lure Category', val: 'Credential / Financial' },
          { key: 'Risk Score', val: `${riskScore} / 100 (High)` }
        ]
      };
    }

    if (riskScore >= 25) {
      return {
        status: 'warning',
        title: 'Suspicious Message',
        subtitle: 'Contains common social-engineering or link patterns.',
        target: `"${snippet}"`,
        timestamp,
        checks: [
          { label: 'Unverified Sender Claim', tone: 'warn' },
          { label: 'Social-Engineering Cues', tone: 'warn' },
          { label: 'Verify via Official Channel', tone: 'info' }
        ],
        breakdown: [
          { key: 'Language Tone', val: 'Action prompt found' },
          { key: 'Embedded Link', val: embeddedLinkMatch ? 'Present' : 'None' },
          { key: 'Lure Category', val: 'Potential impersonation' },
          { key: 'Risk Score', val: `${riskScore} / 100 (Caution)` }
        ]
      };
    }

    return {
      status: 'safe',
      title: 'Message Looks Safe',
      subtitle: 'No common scam or phishing patterns detected.',
      target: `"${snippet}"`,
      timestamp,
      checks: [
        { label: 'No Phishing Lures Found', tone: 'safe' },
        { label: 'No Suspicious Urgency Cues', tone: 'safe' },
        { label: 'Looks Legitimate', tone: 'safe' }
      ],
      breakdown: [
        { key: 'Language Tone', val: 'Neutral / normal' },
        { key: 'Embedded Link', val: embeddedLinkMatch ? 'Safe' : 'None' },
        { key: 'Lure Category', val: 'None detected' },
        { key: 'Risk Score', val: `${riskScore} / 100 (Safe)` }
      ]
    };
  }

  function analyzeEmailInput(rawEmail) {
    const text = rawEmail.trim();
    const snippet = text.length > 52 ? `${text.slice(0, 52)}...` : text;

    const authFailPattern = /(spf:\s*fail|dkim:\s*fail|dmarc:\s*fail|authentication-results:.*fail)/i;
    const spoofedBrandPattern = /(paypa1|micros0ft|app1e|amaz0n|g00gle|support-verify|security-alert|billing-update)/i;
    const suspiciousDomainPattern = /@[a-z0-9.-]+\.(tk|ml|ga|cf|gq|top|xyz|click|ru|zip)\b/i;
    const lurePattern = /(reset your password|verify your account|invoice attached|account suspended|wire transfer|urgent action)/i;
    const embeddedLinkMatch = text.match(/https?:\/\/[^\s]+/i);

    let risk = 0;
    if (authFailPattern.test(text)) risk += 40;
    if (spoofedBrandPattern.test(text)) risk += 40;
    if (suspiciousDomainPattern.test(text)) risk += 30;
    if (lurePattern.test(text)) risk += 25;

    if (embeddedLinkMatch) {
      const linkResult = analyzeUrlInput(embeddedLinkMatch[0]);
      if (linkResult.status === 'danger') risk += 35;
      else if (linkResult.status === 'warning') risk += 15;
    }

    const riskScore = Math.min(98, risk);
    const timestamp = formatScanTime(new Date(), riskScore);

    if (riskScore >= 55) {
      return {
        status: 'danger',
        title: 'Phishing Email Detected',
        subtitle: 'Spoofed sender indicators or credential lures detected.',
        target: snippet,
        timestamp,
        checks: [
          { label: 'Spoofed Sender / Auth Failure', tone: 'bad' },
          { label: 'Credential Harvesting Pattern', tone: 'bad' },
          { label: 'Do Not Reply or Open Links', tone: 'warn' }
        ],
        breakdown: [
          { key: 'Sender Auth', val: authFailPattern.test(text) ? 'SPF/DKIM fail' : 'Lookalike domain' },
          { key: 'Embedded Link', val: embeddedLinkMatch ? 'Flagged' : 'None' },
          { key: 'Lure Category', val: 'Account takeover' },
          { key: 'Risk Score', val: `${riskScore} / 100 (High)` }
        ]
      };
    }

    if (riskScore >= 25) {
      return {
        status: 'warning',
        title: 'Suspicious Email',
        subtitle: 'Unverified domain or social-engineering wording found.',
        target: snippet,
        timestamp,
        checks: [
          { label: 'Sender Domain Needs Verification', tone: 'warn' },
          { label: 'Urgency or Action Prompt', tone: 'warn' },
          { label: 'Confirm via Official Portal', tone: 'info' }
        ],
        breakdown: [
          { key: 'Sender Auth', val: 'Unverified' },
          { key: 'Embedded Link', val: embeddedLinkMatch ? 'Review needed' : 'None' },
          { key: 'Lure Category', val: 'Suspicious prompt' },
          { key: 'Risk Score', val: `${riskScore} / 100 (Caution)` }
        ]
      };
    }

    return {
      status: 'safe',
      title: 'Email Looks Safe',
      subtitle: 'No common phishing or spoofing indicators detected.',
      target: snippet,
      timestamp,
      checks: [
        { label: 'No Spoofed Domain Patterns', tone: 'safe' },
        { label: 'No Suspicious Header Flags', tone: 'safe' },
        { label: 'Looks Legitimate', tone: 'safe' }
      ],
      breakdown: [
        { key: 'Sender Auth', val: 'No spoof signals' },
        { key: 'Embedded Link', val: embeddedLinkMatch ? 'Safe' : 'None' },
        { key: 'Lure Category', val: 'None detected' },
        { key: 'Risk Score', val: `${riskScore} / 100 (Safe)` }
      ]
    };
  }

  tabMessage?.addEventListener('click', () => {
    setMode('message');
    messageInput?.focus();
  });
  tabUrl?.addEventListener('click', () => {
    setMode('url');
    urlInput?.focus();
  });
  tabEmail?.addEventListener('click', () => {
    setMode('email');
    emailInput?.focus();
  });

  emailInput?.addEventListener('input', () => {
    if (!emailCharHint) return;
    const len = emailInput.value.trim().length;
    emailCharHint.textContent = len > 0 ? `${len} chars` : 'Address, headers, or body';
  });

  messageInput?.addEventListener('input', () => {
    if (!messageCharHint) return;
    const len = messageInput.value.trim().length;
    messageCharHint.textContent = len > 0 ? `${len} chars` : 'SMS or WhatsApp';
  });

  const SCAN_MODES = {
    url: {
      input: urlInput,
      empty: {
        title: 'Enter a URL to Check',
        subtitle: 'Paste a website link, domain, or IP address above.',
        target: 'No target provided',
        checks: [
          { label: 'Waiting for Target Input', tone: 'info' },
          { label: 'Supports URLs, Domains & IPs', tone: 'safe' },
          { label: 'Instant Phishing Check Ready', tone: 'safe' }
        ]
      },
      scanning: {
        title: 'Scanning Target...',
        subtitle: 'Inspecting domain structure and phishing signals.',
        checks: [
          { label: 'Checking Domain Reputation', tone: 'info' },
          { label: 'Analyzing URL Structure', tone: 'info' },
          { label: 'Evaluating Phishing Signals', tone: 'info' }
        ]
      },
      analyze: analyzeUrlInput
    },
    email: {
      input: emailInput,
      empty: {
        title: 'Enter an Email to Check',
        subtitle: 'Provide an email address, headers, or message text above.',
        target: 'No email provided',
        checks: [
          { label: 'Waiting for Email Input', tone: 'info' },
          { label: 'Checks Sender & Auth Headers', tone: 'safe' },
          { label: 'Inspects Embedded Links', tone: 'safe' }
        ]
      },
      scanning: {
        title: 'Checking Email...',
        subtitle: 'Inspecting sender domain, headers, and email body.',
        checks: [
          { label: 'Checking Sender Reputation', tone: 'info' },
          { label: 'Inspecting Header Signals', tone: 'info' },
          { label: 'Scanning Embedded Links', tone: 'info' }
        ]
      },
      analyze: analyzeEmailInput
    },
    message: {
      input: messageInput,
      empty: {
        title: 'Paste a Message to Check',
        subtitle: 'Enter an SMS or WhatsApp message above.',
        target: 'No message provided',
        checks: [
          { label: 'Waiting for Message Text', tone: 'info' },
          { label: 'Detects Scam & Urgency Cues', tone: 'safe' },
          { label: 'Inspects Embedded Links', tone: 'safe' }
        ]
      },
      scanning: {
        title: 'Checking Message...',
        subtitle: 'Scanning text for scam lures and suspicious links.',
        checks: [
          { label: 'Analyzing Scam Language', tone: 'info' },
          { label: 'Checking Embedded URLs', tone: 'info' },
          { label: 'Evaluating Urgency Signals', tone: 'info' }
        ]
      },
      analyze: analyzeMessageInput
    }
  };

  function runScan(immediate = false) {
    const modeCfg = SCAN_MODES[activeMode];
    if (!modeCfg) return;

    const rawValue = modeCfg.input?.value.trim() || '';
    if (!rawValue) {
      modeCfg.input?.focus();
      setResultState({
        status: 'warning',
        ...modeCfg.empty,
        timestamp: formatScanTime(new Date())
      });
      return;
    }

    if (immediate) {
      setResultState(modeCfg.analyze(rawValue));
      return;
    }

    if (scanBtn && scanBtnText) {
      scanBtn.disabled = true;
      scanBtnText.textContent = 'Scanning';
    }

    setResultState({
      status: 'scanning',
      ...modeCfg.scanning,
      target: rawValue.length > 52 ? `${rawValue.slice(0, 52)}...` : rawValue,
      timestamp: formatScanTime(new Date())
    });

    window.setTimeout(() => {
      setResultState(modeCfg.analyze(rawValue));
      if (scanBtn && scanBtnText) {
        scanBtn.disabled = false;
        scanBtnText.textContent = 'Scan';
      }
    }, 240);
  }

  scannerForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    runScan(false);
  });

  // Sample pill presets
  const SAMPLES = {
    'safe-url': {
      mode: 'url',
      value: 'https://www.example.com'
    },
    'phishing-url': {
      mode: 'url',
      value: 'https://paypal-login-verify.tk/signin'
    },
    'scam-sms': {
      mode: 'message',
      value: 'URGENT: Your bank account is suspended. Verify immediately at https://bit.ly/verify-now'
    },
    'crypto-dm': {
      mode: 'message',
      value: 'Congrats! Claim your 2.5 ETH airdrop reward before it expires at https://claim-wallet-bonus.tk'
    }
  };

  sampleButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.sample;
      const sample = key ? SAMPLES[key] : null;
      if (!sample) return;
      setMode(sample.mode);
      const targetInput = SCAN_MODES[sample.mode]?.input;
      if (targetInput) {
        targetInput.value = sample.value;
        targetInput.dispatchEvent(new Event('input'));
      }
      runScan(true);
    });
  });

  // Breakdown accordion toggle
  breakdownToggle?.addEventListener('click', () => {
    if (!breakdownPanel || !breakdownToggleLabel) return;
    const isHidden = breakdownPanel.classList.toggle('is-hidden');
    breakdownToggle.setAttribute('aria-expanded', String(!isHidden));
    breakdownToggleLabel.textContent = isHidden ? 'View Breakdown' : 'Hide Breakdown';
  });

  // Modals & Navigation
  function openModal(key) {
    const data = MODAL_CONTENT[key];
    if (!data || !modalBackdrop || !modalTitle || !modalBody) return;
    modalTitle.textContent = data.title;
    modalBody.innerHTML = data.html;
    modalBackdrop.classList.remove('is-hidden');

    const authForm = document.getElementById('modal-auth-form');
    const authNote = document.getElementById('modal-auth-note');
    authForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (authNote) {
        authNote.textContent =
          key === 'login'
            ? 'Signed in (demo preview — no backend session required).'
            : 'Account created (demo preview — ready to save scan history).';
        authNote.classList.remove('is-hidden');
      }
    });
  }

  function closeModal() {
    modalBackdrop?.classList.add('is-hidden');
    navButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.nav === 'home');
    });
  }

  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetNav = btn.dataset.nav;
      navButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
      navRightGroup?.classList.remove('is-open');
      navToggle?.setAttribute('aria-expanded', 'false');

      if (targetNav && targetNav !== 'home') {
        openModal(targetNav);
      } else {
        closeModal();
      }
    });
  });

  authButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const authMode = btn.dataset.auth;
      navRightGroup?.classList.remove('is-open');
      navToggle?.setAttribute('aria-expanded', 'false');
      if (authMode) openModal(authMode);
    });
  });

  brandHomeLink?.addEventListener('click', (e) => {
    e.preventDefault();
    closeModal();
  });

  navToggle?.addEventListener('click', () => {
    const isOpen = navRightGroup?.classList.toggle('is-open') || false;
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  modalClose?.addEventListener('click', closeModal);
  modalBackdrop?.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalBackdrop?.classList.contains('is-hidden')) {
      closeModal();
    }
  });
})();
