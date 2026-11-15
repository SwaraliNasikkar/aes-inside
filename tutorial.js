/**
 * ============================================================================
 * AES INSIDE — Guided Tutorial System (tutorial.js)
 * ============================================================================
 * Three integrated learning layers:
 *   1) Spotlight Tour (7 interactive steps, localStorage first-visit auto-start,
 *      focus trapping, keyboard navigation, responsive repositioning)
 *   2) Learn AES Read-Along Drawer (8 chapters synced live with the simulator
 *      stage + pulsing amber target highlights; right drawer on desktop,
 *      bottom sheet on mobile)
 *   3) Contextual "?" Help Popovers on the timeline + Beginner / Expert toggle
 * ============================================================================
 */
(function (global) {
  'use strict';

  // ==========================================================================
  // CENTRALIZED TUTORIAL CONTENT (Edit all copy, diagrams & maths here)
  // ==========================================================================
  const TUTORIAL_CONTENT = {
    storageKey: 'aes_inside_tour_completed_v1',

    // ------------------------------------------------------------------------
    // PART 1: 7-STEP SPOTLIGHT TOUR
    // ------------------------------------------------------------------------
    tourSteps: [
      {
        target: '.left-panel',
        title: '1. Inputs & NIST Test Vector',
        body: 'Enter any 128-bit plaintext and key in Hex or UTF-8 Text, randomize them, or load the official NIST FIPS-197 test vector. The green badge in the top bar verifies exact standard compliance.',
        requireStandardStage: false
      },
      {
        target: '#state-grid-wrapper',
        title: '2. The 4×4 AES State Matrix',
        body: 'AES arranges 16 bytes column-major into a 4×4 grid. Magenta tiles show bytes changed by the current step. Hover any tile to inspect Hex, Binary, Decimal, and its row/column peers.',
        requireStandardStage: true
      },
      {
        target: '#op-stage',
        title: '3. Operation Animation Stage',
        body: 'Watch each transformation live: trace laser beams into the 16×16 S-Box during SubBytes, inspect GF(2⁸) column math during MixColumns, or check bit-by-bit XORs in AddRoundKey.',
        requireStandardStage: true
      },
      {
        target: '.right-panel',
        title: '4. 11-Round Key Schedule',
        body: 'AES-128 expands your 16-byte key into 11 separate round keys (K0–K10). The active round key glows amber, and clicking any key reveals its RotWord, SubWord, and Rcon derivation.',
        requireStandardStage: false
      },
      {
        target: '.timeline-wrap',
        title: '5. Round Timeline & "?" Help',
        body: 'Jump directly to any operation across Rounds R0–R10. Click the small "?" icon next to any operation pill for a quick formula and explanation of why that step exists.',
        requireStandardStage: false
      },
      {
        target: '.playback-controls',
        title: '6. Playback & Keyboard Controls',
        body: 'Step forward or backward one operation at a time, auto-play with the speed slider, or use Space (Play/Pause) and Left/Right arrow keys during your presentation.',
        requireStandardStage: false
      },
      {
        target: '#avalanche-toggle-btn',
        title: '7. Avalanche Mode Showpiece',
        body: 'Toggle Avalanche Mode to flip a single bit in the plaintext or key and watch two AES states diverge in real time—climbing toward 50% bit difference within just a few rounds.',
        requireStandardStage: false
      }
    ],

    // ------------------------------------------------------------------------
    // PART 2: 8-CHAPTER "LEARN AES" READ-ALONG
    // ------------------------------------------------------------------------
    chapters: [
      {
        id: 'what-is-aes',
        title: '1. What is AES?',
        stepIndex: -1,
        highlightSelector: '#state-grid-wrapper',
        paragraphs: [
          'The Advanced Encryption Standard (AES), standardized by NIST in FIPS-197, is the world’s most widely used symmetric block cipher.',
          'AES-128 takes a fixed 128-bit (16-byte) block of plaintext and scrambles it using a 128-bit secret key across 10 structured rounds.',
          'Because it is a symmetric cipher, the exact same secret key is used in reverse to recover the original plaintext.'
        ],
        diagramHtml: `
          <div class="tut-diagram">
            <span>128-bit Plaintext</span>
            <span class="tut-arrow">&rarr;</span>
            <span class="tut-accent">10 Rounds (K0..K10)</span>
            <span class="tut-arrow">&rarr;</span>
            <span>128-bit Ciphertext</span>
          </div>
        `
      },
      {
        id: 'state-matrix',
        title: '2. The 4×4 State Matrix',
        stepIndex: -1,
        highlightSelector: '#state-grid-wrapper',
        paragraphs: [
          'Before encryption begins, the 16 input bytes are loaded into a 4×4 grid called the State.',
          'Crucially, AES fills the grid column-major: bytes 0–3 form Column 0, bytes 4–7 form Column 1, and so on.',
          'Every AES round modifies this 4×4 matrix in place until the final ciphertext emerges.'
        ],
        diagramHtml: `
          <div class="tut-mini-matrix">
            <div>b0</div><div>b4</div><div>b8</div><div>b12</div>
            <div>b1</div><div>b5</div><div>b9</div><div>b13</div>
            <div>b2</div><div>b6</div><div>b10</div><div>b14</div>
            <div>b3</div><div>b7</div><div>b11</div><div>b15</div>
          </div>
        `
      },
      {
        id: 'key-expansion',
        title: '3. Key Expansion',
        stepIndex: 0,
        highlightSelector: '.right-panel',
        paragraphs: [
          'Using the same key unchanged in every round would expose patterns to attackers. Instead, AES expands the initial 16-byte key (K0) into 11 distinct round keys (K0–K10).',
          'Each new round key rotates the previous last word (RotWord), passes bytes through the S-Box (SubWord), and XORs a round constant (Rcon) to break symmetry.',
          'Look at the Key Schedule panel on the right—each step highlights the exact round key currently in use.'
        ],
        diagramHtml: `
          <div class="tut-formula">W[i] = W[i-4] &oplus; SubWord(RotWord(W[i-1])) &oplus; Rcon[i/4]</div>
        `
      },
      {
        id: 'subbytes',
        title: '4. SubBytes (Confusion)',
        stepIndex: 1,
        highlightSelector: '#op-stage',
        paragraphs: [
          'SubBytes achieves Shannon’s principle of Confusion: hiding the algebraic relationship between key and ciphertext.',
          'Each byte is replaced independently using a fixed 16×16 S-Box lookup table. The high nibble picks the row, and the low nibble picks the column.',
          'Because the S-Box is built from multiplicative inverses in GF(2⁸) plus an affine transform, it is strongly non-linear.'
        ],
        diagramHtml: `
          <div class="tut-formula">S(x) = A &middot; x<sup>-1</sup> &oplus; 0x63 &nbsp;in GF(2⁸)</div>
        `
      },
      {
        id: 'shiftrows',
        title: '5. ShiftRows (Diffusion)',
        stepIndex: 2,
        highlightSelector: '#state-grid-wrapper',
        paragraphs: [
          'If columns stayed independent, an attacker could analyze four 32-bit ciphers separately. ShiftRows prevents this by mixing bytes across columns.',
          'Row 0 stays fixed, Row 1 shifts left by 1 byte, Row 2 by 2 bytes, and Row 3 by 3 bytes, wrapping around the edges.',
          'After ShiftRows, every column contains bytes that originated from four completely different columns.'
        ],
        diagramHtml: `
          <div class="tut-diagram">
            <span>R0: &laquo;0</span> &middot;
            <span>R1: &laquo;1</span> &middot;
            <span>R2: &laquo;2</span> &middot;
            <span class="tut-accent">R3: &laquo;3</span>
          </div>
        `
      },
      {
        id: 'mixcolumns',
        title: '6. MixColumns (Diffusion)',
        stepIndex: 3,
        highlightSelector: '#op-stage',
        paragraphs: [
          'MixColumns completes Diffusion by treating each 4-byte column as a polynomial and multiplying it by a fixed 4×4 matrix in GF(2⁸).',
          'Changing even a single byte entering MixColumns changes all four bytes coming out of that column.',
          'Combined with ShiftRows, a 1-byte change spreads across all 16 bytes of the state within just two rounds!'
        ],
        diagramHtml: `
          <div class="tut-formula">c'(x) = (03x³ + 01x² + 01x + 02) &otimes; c(x) mod (x⁴ + 1)</div>
        `
      },
      {
        id: 'addroundkey',
        title: '7. AddRoundKey',
        stepIndex: 4,
        highlightSelector: '#op-stage',
        paragraphs: [
          'AddRoundKey is the only operation in AES that actually uses the secret key—without it, anyone could invert the cipher.',
          'Each byte of the 4×4 state is simply bitwise XORed with the matching byte of the current round key.',
          'Because XOR is its own inverse (A ⊕ K ⊕ K = A), decryption uses this exact same operation.'
        ],
        diagramHtml: `
          <div class="tut-formula">State'<sub>r,c</sub> = State<sub>r,c</sub> &oplus; RoundKey<sub>r,c</sub></div>
        `
      },
      {
        id: 'final-round-avalanche',
        title: '8. Round 10 & Avalanche Effect',
        stepIndex: 39,
        highlightSelector: '#avalanche-toggle-btn',
        showAvalancheButton: true,
        paragraphs: [
          'Look at Round 10 in the timeline: it runs SubBytes, ShiftRows, and AddRoundKey—but deliberately skips MixColumns.',
          'Why? Because MixColumns has no secret key; an attacker could peel off an unkeyed linear layer at the very end without knowing K10, adding zero security.',
          'Together, all 10 rounds create the Avalanche Effect: flipping 1 input bit flips ~50% (64 of 128) output bits unpredictably. Click below to test it live!'
        ],
        diagramHtml: `
          <div class="tut-diagram">
            <span>1 Bit Flipped</span>
            <span class="tut-arrow">&rarr;</span>
            <span class="tut-accent">~64 / 128 Bits Changed (50%)</span>
          </div>
        `
      }
    ],

    // ------------------------------------------------------------------------
    // PART 3A: CONTEXTUAL "?" HELP POPOVERS FOR TIMELINE OPERATIONS
    // ------------------------------------------------------------------------
    opHelp: {
      AddRoundKey: {
        title: 'AddRoundKey (ARK)',
        why: 'Injects secret key entropy into the state; the only step that depends directly on the secret key.',
        formula: "S'[r, c] = S[r, c] ⊕ K_round[r, c]"
      },
      SubBytes: {
        title: 'SubBytes (SB)',
        why: 'Provides non-linear confusion so simple algebraic or linear equations cannot describe the cipher.',
        formula: "S'[r, c] = SBox(S[r, c]) = A · (S[r, c])⁻¹ ⊕ 0x63 in GF(2⁸)"
      },
      ShiftRows: {
        title: 'ShiftRows (SR)',
        why: 'Spreads bytes horizontally across columns so MixColumns mixes data from all 4 columns.',
        formula: "S'[r, c] = S[r, (c + r) mod 4]   (r ∈ {0,1,2,3})"
      },
      MixColumns: {
        title: 'MixColumns (MC)',
        why: 'Maximizes diffusion within each column: changing 1 input byte alters all 4 output bytes (MDS property).',
        formula: "S'[:, c] = M_MDS · S[:, c] in GF(2⁸) mod (x⁸+x⁴+x³+x+1)"
      },
      InvShiftRows: {
        title: 'InvShiftRows (ISR)',
        why: 'Reverses horizontal row dispersion by cyclically shifting each row right by 0, 1, 2, or 3 bytes.',
        formula: "S'[r, c] = S[r, (c - r + 4) mod 4]"
      },
      InvSubBytes: {
        title: 'InvSubBytes (ISB)',
        why: 'Reverses non-linear byte substitution using the Inverse S-Box table.',
        formula: "S'[r, c] = InvSBox(S[r, c]) = (A⁻¹ · (S[r, c] ⊕ 0x63))⁻¹"
      },
      InvMixColumns: {
        title: 'InvMixColumns (IMC)',
        why: 'Inverts forward column diffusion using the inverse MDS matrix [0E, 0B, 0D, 09] in GF(2⁸).',
        formula: "S'[:, c] = M_MDS⁻¹ · S[:, c] in GF(2⁸)"
      }
    },

    // ------------------------------------------------------------------------
    // PART 3B: EXPERT MODE MATHEMATICAL DETAILS (Shown when Level = Expert)
    // ------------------------------------------------------------------------
    expertMath: {
      Input:
        'State mapping: byte[i] → State[i mod 4, ⌊i/4⌋] in GF(2⁸) = GF(2)[x] / (x⁸ + x⁴ + x³ + x + 1), reduction polynomial 0x11B.',
      SubBytes:
        'S-Box maths: Compute multiplicative inverse b⁻¹ in GF(2⁸) (with 0 ↦ 0), then apply GF(2) affine transform b′ = b ⊕ (b≪1) ⊕ (b≪2) ⊕ (b≪3) ⊕ (b≪4) ⊕ 0x63 (mod x⁸+1). Algebraic degree = 7; max differential uniformity = 4.',
      InvSubBytes:
        'Inverse S-Box maths: Apply inverse affine transform over GF(2), b = A⁻¹(y ⊕ 0x63), followed by multiplicative inversion in GF(2⁸) mod 0x11B.',
      ShiftRows:
        'Permutation matrix over byte indices: row r undergoes cyclic left shift τ(r) = r. Combined with MixColumns, guarantees ≥ 25 active S-Boxes across any 4 consecutive rounds (Wide Trail Strategy).',
      InvShiftRows:
        'Inverse cyclic permutation: row r shifts right by r mod 4, restoring pre-ShiftRows column alignment.',
      MixColumns:
        'GF(2⁸) MDS Matrix multiplication (branch number = 5): each byte acts as a degree-7 polynomial mod 0x11B. Multiply by 0x02 via xtime: (a≪1) ⊕ (0x1B if a₇=1); multiply by 0x03 via xtime(a) ⊕ a.',
      InvMixColumns:
        'Inverse MDS Matrix [0E, 0B, 0D, 09] in GF(2⁸) mod 0x11B. Notice (03x³+01x²+01x+02) · (0Bx³+0Dx²+09x+0E) ≡ 1 mod (x⁴+1), requiring higher-weight GF(2⁸) multiplications than encryption.',
      AddRoundKey: (step) => {
        const r = step.roundKeyIndex;
        const rconHex = r > 0 ? `0x${AES128.formatHex(AES128.RCON[r])}` : 'N/A (Cipher Key)';
        return `Key Schedule & GF(2) XOR: State ⊕ K${r} in GF(2)¹²⁸. K${r} uses Rcon[${r}] = ${rconHex} (= x^${Math.max(0, r - 1)} mod 0x11B) during W[${r * 4}] generation to eliminate slide-attack symmetry.`;
      }
    }
  };

  // ==========================================================================
  // STATE & DOM REFERENCES
  // ==========================================================================
  const tutState = {
    skillLevel: 'beginner', // 'beginner' | 'expert'
    tourActive: false,
    tourStep: 0,
    drawerOpen: false,
    chapterIndex: 0,
    highlightedEl: null,
    activeOpPopoverTarget: null
  };

  const dom = {};

  function cacheDom() {
    dom.tourStartBtn = document.getElementById('tour-start-btn');
    dom.learnDrawerBtn = document.getElementById('learn-drawer-btn');
    dom.levelBeginnerBtn = document.getElementById('level-beginner-btn');
    dom.levelExpertBtn = document.getElementById('level-expert-btn');

    dom.tourBackdrop = document.getElementById('tour-backdrop');
    dom.tourSpotlight = document.getElementById('tour-spotlight');
    dom.tourCard = document.getElementById('tour-card');
    dom.tourCounter = document.getElementById('tour-counter');
    dom.tourTitle = document.getElementById('tour-title');
    dom.tourBody = document.getElementById('tour-body');
    dom.tourSkipBtn = document.getElementById('tour-skip-btn');
    dom.tourBackBtn = document.getElementById('tour-back-btn');
    dom.tourNextBtn = document.getElementById('tour-next-btn');

    dom.learnDrawer = document.getElementById('learn-drawer');
    dom.learnCloseBtn = document.getElementById('learn-close-btn');
    dom.learnProgressFill = document.getElementById('learn-progress-fill');
    dom.learnProgressText = document.getElementById('learn-progress-text');
    dom.learnChapterNav = document.getElementById('learn-chapter-nav');
    dom.learnChapterBody = document.getElementById('learn-chapter-body');
    dom.learnPrevBtn = document.getElementById('learn-prev-btn');
    dom.learnNextBtn = document.getElementById('learn-next-btn');

    dom.opHelpPopover = document.getElementById('op-help-popover');
    dom.opHelpTitle = document.getElementById('op-help-title');
    dom.opHelpWhy = document.getElementById('op-help-why');
    dom.opHelpFormula = document.getElementById('op-help-formula');
    dom.opHelpClose = document.getElementById('op-help-close');
  }

  // ==========================================================================
  // 1) SPOTLIGHT TOUR LOGIC
  // ==========================================================================
  function startTour(fromStep = 0) {
    if (tutState.drawerOpen) closeDrawer();
    closeOpHelpPopover();

    tutState.tourActive = true;
    tutState.tourStep = fromStep;

    dom.tourBackdrop.classList.remove('hidden');
    dom.tourSpotlight.classList.remove('hidden');
    dom.tourCard.classList.remove('hidden');

    renderTourStep();
    dom.tourNextBtn.focus();
  }

  function closeTour(markSeen = true) {
    tutState.tourActive = false;
    dom.tourBackdrop.classList.add('hidden');
    dom.tourSpotlight.classList.add('hidden');
    dom.tourCard.classList.add('hidden');

    if (markSeen) {
      try {
        localStorage.setItem(TUTORIAL_CONTENT.storageKey, 'true');
      } catch (_) {
        /* ignore storage restrictions */
      }
    }
    dom.tourStartBtn?.focus();
  }

  function renderTourStep() {
    const steps = TUTORIAL_CONTENT.tourSteps;
    const step = steps[tutState.tourStep];
    if (!step) return;

    // Ensure Standard Stage is visible when spotlighting #state-grid-wrapper or #op-stage
    if (step.requireStandardStage && global.AES_APP?.getState().avalancheMode) {
      global.AES_APP.setAvalancheMode(false);
    }

    dom.tourCounter.textContent = `${tutState.tourStep + 1} / ${steps.length}`;
    dom.tourTitle.textContent = step.title;
    dom.tourBody.textContent = step.body;

    dom.tourBackBtn.disabled = tutState.tourStep === 0;
    dom.tourNextBtn.textContent = tutState.tourStep === steps.length - 1 ? 'Finish' : 'Next';

    positionTourSpotlightAndCard(step.target);
  }

  function positionTourSpotlightAndCard(selector) {
    if (!tutState.tourActive) return;
    const targetEl = document.querySelector(selector);
    if (!targetEl) return;

    // Scroll target smoothly into view if off-screen
    const rectCheck = targetEl.getBoundingClientRect();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (rectCheck.top < 20 || rectCheck.bottom > window.innerHeight - 20) {
      targetEl.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    }

    requestAnimationFrame(() => {
      const rect = targetEl.getBoundingClientRect();
      const pad = 8;

      const sLeft = Math.max(4, rect.left - pad);
      const sTop = Math.max(4, rect.top - pad);
      const sWidth = Math.min(window.innerWidth - sLeft - 4, rect.width + pad * 2);
      const sHeight = Math.min(window.innerHeight - sTop - 4, rect.height + pad * 2);

      dom.tourSpotlight.style.left = `${sLeft}px`;
      dom.tourSpotlight.style.top = `${sTop}px`;
      dom.tourSpotlight.style.width = `${sWidth}px`;
      dom.tourSpotlight.style.height = `${sHeight}px`;

      // Position Tour Card intelligently around the spotlight
      const cardRect = dom.tourCard.getBoundingClientRect();
      const cardW = cardRect.width || 320;
      const cardH = cardRect.height || 195;
      const gap = 14;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left, top;
      if (vw > 760) {
        if (sLeft + sWidth + gap + cardW <= vw - 12) {
          left = sLeft + sWidth + gap;
          top = Math.min(vh - cardH - 12, Math.max(12, sTop));
        } else if (sLeft - gap - cardW >= 12) {
          left = sLeft - gap - cardW;
          top = Math.min(vh - cardH - 12, Math.max(12, sTop));
        } else if (sTop + sHeight + gap + cardH <= vh - 12) {
          left = Math.min(vw - cardW - 12, Math.max(12, sLeft));
          top = sTop + sHeight + gap;
        } else {
          left = Math.min(vw - cardW - 12, Math.max(12, sLeft));
          top = Math.max(12, sTop - cardH - gap);
        }
      } else {
        // Mobile layout: center horizontally, place below or above spotlight
        left = Math.max(12, (vw - cardW) / 2);
        if (sTop + sHeight + gap + cardH <= vh - 10) {
          top = sTop + sHeight + gap;
        } else if (sTop - gap - cardH >= 10) {
          top = sTop - gap - cardH;
        } else {
          top = Math.max(10, vh - cardH - 12);
        }
      }

      dom.tourCard.style.left = `${Math.round(left)}px`;
      dom.tourCard.style.top = `${Math.round(top)}px`;
    });
  }

  function handleTourKeydown(e) {
    if (!tutState.tourActive) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeTour(true);
      return;
    }
    if (e.key === 'ArrowRight' || (e.key === 'Enter' && document.activeElement !== dom.tourBackBtn && document.activeElement !== dom.tourSkipBtn)) {
      e.preventDefault();
      if (tutState.tourStep < TUTORIAL_CONTENT.tourSteps.length - 1) {
        tutState.tourStep++;
        renderTourStep();
      } else {
        closeTour(true);
      }
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (tutState.tourStep > 0) {
        tutState.tourStep--;
        renderTourStep();
      }
      return;
    }

    // Strict Focus Trapping inside the Tour Card
    if (e.key === 'Tab') {
      const focusables = Array.from(
        dom.tourCard.querySelectorAll('button:not([disabled])')
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && (document.activeElement === first || !dom.tourCard.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !dom.tourCard.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // ==========================================================================
  // 2) LEARN AES READ-ALONG DRAWER
  // ==========================================================================
  function openDrawer(chapterIdx = tutState.chapterIndex) {
    if (tutState.tourActive) closeTour(true);
    closeOpHelpPopover();

    tutState.drawerOpen = true;
    document.body.classList.add('learn-drawer-open');
    dom.learnDrawer.classList.add('open');
    dom.learnDrawer.setAttribute('aria-hidden', 'false');
    dom.learnDrawerBtn?.setAttribute('aria-expanded', 'true');

    goToChapter(chapterIdx);
    dom.learnCloseBtn.focus();
  }

  function closeDrawer() {
    tutState.drawerOpen = false;
    document.body.classList.remove('learn-drawer-open');
    dom.learnDrawer.classList.remove('open');
    dom.learnDrawer.setAttribute('aria-hidden', 'true');
    dom.learnDrawerBtn?.setAttribute('aria-expanded', 'false');
    clearStageHighlight();
  }

  function clearStageHighlight() {
    if (tutState.highlightedEl) {
      tutState.highlightedEl.classList.remove('tutorial-amber-pulse');
      tutState.highlightedEl = null;
    }
  }

  function goToChapter(idx) {
    const chapters = TUTORIAL_CONTENT.chapters;
    tutState.chapterIndex = Math.max(0, Math.min(chapters.length - 1, idx));
    const ch = chapters[tutState.chapterIndex];

    // Progress bar & nav pills
    const pct = ((tutState.chapterIndex + 1) / chapters.length) * 100;
    dom.learnProgressFill.style.width = `${pct}%`;
    dom.learnProgressText.textContent = `Chapter ${tutState.chapterIndex + 1} of ${chapters.length}`;

    dom.learnChapterNav.innerHTML = chapters
      .map(
        (c, i) =>
          `<button type="button" class="learn-pill${i === tutState.chapterIndex ? ' active' : ''}" data-ch="${i}" title="${c.title}">${i + 1}</button>`
      )
      .join('');

    dom.learnChapterNav.querySelectorAll('.learn-pill').forEach((btn) => {
      btn.addEventListener('click', () => goToChapter(Number(btn.dataset.ch)));
    });

    // Chapter content
    const paragraphsHtml = ch.paragraphs.map((p) => `<p>${p}</p>`).join('');
    const avalancheBtnHtml = ch.showAvalancheButton
      ? `<button id="learn-try-avalanche" type="button" class="btn-avalanche" style="margin-top:8px;width:100%;justify-content:center;">Toggle Avalanche Mode Live</button>`
      : '';

    dom.learnChapterBody.innerHTML = `
      <h3 class="learn-ch-title">${ch.title}</h3>
      <div class="learn-ch-text">${paragraphsHtml}</div>
      ${ch.diagramHtml || ''}
      ${avalancheBtnHtml}
    `;

    const tryAvBtn = document.getElementById('learn-try-avalanche');
    if (tryAvBtn && global.AES_APP) {
      tryAvBtn.addEventListener('click', () => {
        const isAv = global.AES_APP.getState().avalancheMode;
        global.AES_APP.setAvalancheMode(!isAv);
      });
    }

    dom.learnPrevBtn.disabled = tutState.chapterIndex === 0;
    dom.learnNextBtn.disabled = tutState.chapterIndex === chapters.length - 1;

    // Sync Simulator Step & Pulsing Amber Stage Highlight
    if (global.AES_APP) {
      const appSt = global.AES_APP.getState();
      if (appSt.avalancheMode) global.AES_APP.setAvalancheMode(false);
      if (appSt.mode !== 'encrypt') global.AES_APP.setMode('encrypt');
      global.AES_APP.stopPlay();
      global.AES_APP.goToStep(ch.stepIndex, true);
    }

    clearStageHighlight();
    if (ch.highlightSelector) {
      const elToPulse = document.querySelector(ch.highlightSelector);
      if (elToPulse) {
        elToPulse.classList.add('tutorial-amber-pulse');
        tutState.highlightedEl = elToPulse;
      }
    }
  }

  // ==========================================================================
  // 3) CONTEXTUAL TIMELINE "?" POPOVER & BEGINNER/EXPERT LEVEL
  // ==========================================================================
  function openOpHelpPopover(opName, anchorBtn) {
    const info = TUTORIAL_CONTENT.opHelp[opName];
    if (!info) return;

    tutState.activeOpPopoverTarget = anchorBtn;
    dom.opHelpTitle.textContent = info.title;
    dom.opHelpWhy.textContent = info.why;
    dom.opHelpFormula.textContent = info.formula;

    dom.opHelpPopover.classList.remove('hidden');

    // Anchor cleanly above the "?" button
    const rect = anchorBtn.getBoundingClientRect();
    const popRect = dom.opHelpPopover.getBoundingClientRect();
    const popW = popRect.width || 310;
    const popH = popRect.height || 140;

    const left = Math.max(12, Math.min(window.innerWidth - popW - 12, rect.left - popW / 2 + rect.width / 2));
    const top = Math.max(12, rect.top - popH - 10);

    dom.opHelpPopover.style.left = `${Math.round(left)}px`;
    dom.opHelpPopover.style.top = `${Math.round(top)}px`;
  }

  function closeOpHelpPopover() {
    if (!dom.opHelpPopover) return;
    dom.opHelpPopover.classList.add('hidden');
    tutState.activeOpPopoverTarget = null;
  }

  function setSkillLevel(level) {
    tutState.skillLevel = level;
    dom.levelBeginnerBtn?.classList.toggle('active', level === 'beginner');
    dom.levelExpertBtn?.classList.toggle('active', level === 'expert');
    dom.levelBeginnerBtn?.setAttribute('aria-pressed', String(level === 'beginner'));
    dom.levelExpertBtn?.setAttribute('aria-pressed', String(level === 'expert'));

    // Ask app.js to refresh current caption with or without Expert maths
    if (global.AES_APP) {
      global.AES_APP.refreshCaption();
    }
  }

  function getExpertMathHtml(step) {
    if (tutState.skillLevel !== 'expert') return '';
    const key = step ? step.op : 'Input';
    const entry = TUTORIAL_CONTENT.expertMath[key];
    const text = typeof entry === 'function' ? entry(step) : entry;
    if (!text) return '';
    return `<div class="expert-math-note"><span class="expert-tag">MATH</span> ${text}</div>`;
  }

  /** Called by app.js when rendering each operation pill in the timeline */
  function createTimelineHelpButton(step) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tl-help-btn';
    btn.textContent = '?';
    btn.title = `Explain ${step.op}`;
    btn.setAttribute('aria-label', `Explain ${step.op}`);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (tutState.activeOpPopoverTarget === btn && !dom.opHelpPopover.classList.contains('hidden')) {
        closeOpHelpPopover();
      } else {
        openOpHelpPopover(step.op, btn);
      }
    });
    return btn;
  }

  // ==========================================================================
  // INITIALIZATION & EVENT BINDINGS
  // ==========================================================================
  function init() {
    cacheDom();

    dom.tourStartBtn?.addEventListener('click', () => startTour(0));
    dom.tourSkipBtn?.addEventListener('click', () => closeTour(true));
    dom.tourBackdrop?.addEventListener('click', () => closeTour(true));

    dom.tourBackBtn?.addEventListener('click', () => {
      if (tutState.tourStep > 0) {
        tutState.tourStep--;
        renderTourStep();
      }
    });

    dom.tourNextBtn?.addEventListener('click', () => {
      if (tutState.tourStep < TUTORIAL_CONTENT.tourSteps.length - 1) {
        tutState.tourStep++;
        renderTourStep();
      } else {
        closeTour(true);
      }
    });

    dom.learnDrawerBtn?.addEventListener('click', () => {
      if (tutState.drawerOpen) closeDrawer();
      else openDrawer(tutState.chapterIndex);
    });
    dom.learnCloseBtn?.addEventListener('click', closeDrawer);
    dom.learnPrevBtn?.addEventListener('click', () => goToChapter(tutState.chapterIndex - 1));
    dom.learnNextBtn?.addEventListener('click', () => goToChapter(tutState.chapterIndex + 1));

    dom.levelBeginnerBtn?.addEventListener('click', () => setSkillLevel('beginner'));
    dom.levelExpertBtn?.addEventListener('click', () => setSkillLevel('expert'));

    dom.opHelpClose?.addEventListener('click', closeOpHelpPopover);

    window.addEventListener('keydown', (e) => {
      if (tutState.tourActive) {
        handleTourKeydown(e);
        return;
      }
      if (e.key === 'Escape') {
        if (!dom.opHelpPopover?.classList.contains('hidden')) {
          closeOpHelpPopover();
        } else if (tutState.drawerOpen) {
          closeDrawer();
        }
      }
    });

    document.addEventListener('click', (e) => {
      if (
        dom.opHelpPopover &&
        !dom.opHelpPopover.classList.contains('hidden') &&
        !dom.opHelpPopover.contains(e.target) &&
        !e.target.classList.contains('tl-help-btn')
      ) {
        closeOpHelpPopover();
      }
    });

    window.addEventListener('resize', () => {
      if (tutState.tourActive) {
        const step = TUTORIAL_CONTENT.tourSteps[tutState.tourStep];
        if (step) positionTourSpotlightAndCard(step.target);
      }
    });
  }
/** Triggered by app.js right after the boot sequence finishes */
  function onBootComplete() {
    let seen = false;
    try {
      seen = localStorage.getItem(TUTORIAL_CONTENT.storageKey) === 'true';
    } catch (_) {
      seen = false;
    }
    if (!seen) {
      setTimeout(() => startTour(0), 260);
    }
  }

  global.AES_TUTORIAL = {
    init,
    onBootComplete,
    startTour,
    openDrawer,
    closeDrawer,
    setSkillLevel,
    getExpertMathHtml,
    createTimelineHelpButton
  };
})(window);