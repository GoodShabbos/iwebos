// lock-screen.js — visual iPhone-style lock screen. Unlock is local-only;
// no authentication or backend is connected yet.

const LOCK_HOLD_MS = 10000; // how long the lock icon stays before the buttons appear

let cleanupLens = null;

const LOCK_ICON = `
<svg class="lock-screen__icon" viewBox="0 0 48 48" aria-hidden="true">
  <path d="M15 21v-6.5a9 9 0 0 1 18 0V21" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>
  <rect x="10.5" y="20" width="27" height="22" rx="7" fill="rgba(255,255,255,.12)" stroke="currentColor" stroke-width="2.2"/>
  <circle cx="24" cy="29" r="2" fill="currentColor"/>
  <path d="M24 31v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`;

export function renderLockScreen(root = document.body) {
  cleanupLens?.();
  document.body.classList.add('is-locked');

  const screen = document.createElement('section');
  screen.className = 'lock-screen';
  screen.setAttribute('aria-label', 'Lock screen');
  screen.innerHTML = `
    <div class="lock-screen__content">
      <div class="lock-screen__mark" aria-hidden="true">
        <div class="lock-screen__lens"></div>
        ${LOCK_ICON}
      </div>
      <p class="lock-screen__state">Locked <span class="lock-screen__timer" aria-hidden="true"></span></p>
      <button class="lock-screen__unlock" type="button">Unlock</button>
    </div>
  `;
  root.appendChild(screen);

  // Real displacement refraction in the circular glass behind the lock glyph.
  if (window.LiquidGlassShader && window.liquidGlassUtils) {
    const lensHost = screen.querySelector('.lock-screen__lens');
    const { smoothStep, texture } = window.liquidGlassUtils;
    const size = 96;
    const fragment = (uv) => {
      const x = uv.x - 0.5;
      const y = uv.y - 0.5;
      const distance = Math.hypot(x, y);
      const rim = smoothStep(0.48, 0.27, distance);
      const scale = smoothStep(0, 1, rim);
      return texture(x * scale + 0.5, y * scale + 0.5);
    };
    const shader = new window.LiquidGlassShader({ width: size, height: size, fragment });
    const surface = shader.container;
    surface.style.position = 'absolute';
    surface.style.inset = '0';
    surface.style.width = '100%';
    surface.style.height = '100%';
    surface.style.transform = 'none';
    surface.style.borderRadius = '50%';
    surface.style.boxShadow = 'none';
    surface.style.pointerEvents = 'none';
    surface.style.cursor = 'default';
    surface.style.zIndex = '0';
    surface.style.backdropFilter = `url(#${shader.id}_filter) blur(1.4px) saturate(1.45) brightness(1.12)`;
    surface.style.webkitBackdropFilter = surface.style.backdropFilter;
    lensHost.appendChild(surface);
    document.body.appendChild(shader.svg);
    cleanupLens = () => {
      shader.destroy();
      shader.svg.remove();
      cleanupLens = null;
    };
  }

  screen.querySelector('.lock-screen__unlock').addEventListener('click', () => {
    if (screen.querySelector('.passcode-screen')) return;
    const passcode = document.createElement('section');
    passcode.className = 'passcode-screen';
    passcode.setAttribute('aria-label', 'Passcode');
    passcode.innerHTML = `
      <button class="passcode-screen__close" type="button" aria-label="Close passcode">×</button>
      <div class="passcode-screen__content">
        <p class="passcode-screen__prompt">Pick a code, any code. Don't worry, it doesn't matter-I trash everything about you anyway.</p>
        <div class="passcode-screen__dots" aria-label="Passcode entry">
          ${Array.from({ length: 4 }, () => '<span class="passcode-screen__dot"></span>').join('')}
        </div>
        <div class="passcode-screen__keypad" aria-label="Number keypad">
          ${['1','2','3','4','5','6','7','8','9','','0','delete'].map((key) => key
            ? `<button class="passcode-screen__key" type="button" data-key="${key}" aria-label="${key === 'delete' ? 'Delete' : key}">${key === 'delete' ? '⌫' : key}</button>`
            : '<span class="passcode-screen__key-spacer" aria-hidden="true"></span>').join('')}
        </div>
      </div>
    `;
    screen.appendChild(passcode);
    const close = () => passcode.remove();
    passcode.querySelector('.passcode-screen__close').addEventListener('click', close);

    // Visual code entry only: any 4 digits unlock the OS. There is
    // deliberately no validation, authentication, or backend.
    let entered = '';
    let unlocking = false;
    const unlock = () => {
      if (unlocking) return;
      unlocking = true;
      // Let the last dot fill be seen, then dissolve the lock layers.
      setTimeout(() => {
        passcode.classList.add('is-unlocking');
        screen.classList.add('is-unlocking');
        document.body.classList.remove('is-locked', 'lock-intro');
        document.body.classList.add('is-unlocked');
        document.dispatchEvent(new CustomEvent('oslogin'));
        setTimeout(() => {
          cleanupLens?.();
          screen.remove();
        }, 560);
      }, 260);
    };
    const dots = [...passcode.querySelectorAll('.passcode-screen__dot')];
    passcode.querySelectorAll('[data-key]').forEach((keyButton) => {
      keyButton.addEventListener('click', () => {
        const key = keyButton.dataset.key;
        if (key === 'delete') entered = entered.slice(0, -1);
        else if (entered.length < dots.length) entered += key;
        dots.forEach((dot, index) => dot.classList.toggle('is-filled', index < entered.length));
        // Any complete code unlocks — nothing is validated or stored.
        if (entered.length === dots.length) unlock();
      });
    });
  });

  // Intro sequence: clock → wallpaper (wallpaper.js) → lock icon held for
  // LOCK_HOLD_MS → icon fades out → Unlock + corner buttons fade in.
  // body.lock-intro keeps those buttons hidden until then (see desktop.css).
  document.body.classList.add('lock-intro');
  let revealed = false;
  const revealControls = () => {
    if (revealed || !screen.isConnected) return;
    revealed = true;
    screen.classList.add('is-idle'); // fades the lock icon + "Locked" away
    setTimeout(() => {
      document.body.classList.add('lock-reveal');
      document.body.classList.remove('lock-intro');
      setTimeout(() => document.body.classList.remove('lock-reveal'), 800);
    }, 650);
  };
  // Countdown next to "Locked" while the icon is held on screen.
  const timerEl = screen.querySelector('.lock-screen__timer');
  const showTime = (secs) => { timerEl.textContent = `· 0:${String(secs).padStart(2, '0')}`; };
  showTime(Math.round(LOCK_HOLD_MS / 1000));
  document.addEventListener('wallpaperrevealed', () => {
    const end = Date.now() + LOCK_HOLD_MS;
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      showTime(left);
      if (left === 0 || revealed || !screen.isConnected) clearInterval(tick);
    }, 250);
    setTimeout(revealControls, LOCK_HOLD_MS);
  }, { once: true });
  // Safety net: never leave the controls hidden if the reveal event is missed.
  setTimeout(revealControls, LOCK_HOLD_MS + 8000);

  return screen;
}
