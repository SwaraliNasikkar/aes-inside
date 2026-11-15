/**
 * ============================================================================
 * AES INSIDE — UI Controller & 60fps Animation Engine (app.js)
 * ============================================================================
 * Consumes window.AES128 (aes.js), window.networkPulse (network.js), and
 * window.AES_TUTORIAL (tutorial.js).
 * ============================================================================
 */
(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --------------------------------------------------------------------------
  // Application State
  // --------------------------------------------------------------------------
  const appState = {
    mode: 'encrypt',          // 'encrypt' | 'decrypt'
    inputFormat: 'hex',       // 'hex' | 'text'
    keyFormat: 'hex',         // 'hex' | 'text'
    avalancheMode: false,
    avalancheTarget: 'pt',    // 'pt' | 'key'
    flippedBitIndex: 0,       // 0..127 (Byte 0, MSB 0)
    runData: null,            // Output of AES128.run()
    runDataFlipped: null,     // Output of AES128.run() for Avalanche State B
    stepIndex: 0,             // -1 (raw input) or 0..39 (40 recorded steps)
    isPlaying: false,
    playTimer: null,
    speed: 1.0,
    selectedMixCol: 0,        // 0..3 for MixColumns inspection
    selectedArkByte: 0,       // 0..15 for AddRoundKey XOR inspector
    sboxAnimTimers: []
  };

  // --------------------------------------------------------------------------
  // DOM Element References
  // --------------------------------------------------------------------------
  const el = {
    bootOverlay: document.getElementById('boot-overlay'),
    bootLog: document.getElementById('boot-log'),
    skipBootBtn: document.getElementById('skip-boot-btn'),

    modeEncryptBtn: document.getElementById('mode-encrypt-btn'),
    modeDecryptBtn: document.getElementById('mode-decrypt-btn'),
    avalancheToggleBtn: document.getElementById('avalanche-toggle-btn'),
    nistBadge: document.getElementById('nist-badge'),
    nistBadgeText: document.getElementById('nist-badge-text'),

    plaintextLabel: document.getElementById('plaintext-label'),
    plaintextInput: document.getElementById('plaintext-input'),
    plaintextHexPreview: document.getElementById('plaintext-hex-preview'),
    inputFormatHex: document.getElementById('input-format-hex'),
    inputFormatText: document.getElementById('input-format-text'),

    keyInput: document.getElementById('key-input'),
    keyHexPreview: document.getElementById('key-hex-preview'),
    keyFormatHex: document.getElementById('key-format-hex'),
    keyFormatText: document.getElementById('key-format-text'),

    loadNistBtn: document.getElementById('load-nist-btn'),
    randomizeBtn: document.getElementById('randomize-btn'),
    finalOutputLabel: document.getElementById('final-output-label'),
    finalOutputHex: document.getElementById('final-output-hex'),
    swapOutputBtn: document.getElementById('swap-output-btn'),
    copyOutputBtn: document.getElementById('copy-output-btn'),

    roundBadge: document.getElementById('round-badge'),
    progressLabel: document.getElementById('progress-label'),
    standardStage: document.getElementById('standard-stage'),
    stageParticles: document.getElementById('stage-particles'),
    sboxBeamSvg: document.getElementById('sbox-beam-svg'),
    shiftLabels: document.getElementById('shift-labels'),
    stateGridWrapper: document.getElementById('state-grid-wrapper'),
    stateGrid: document.getElementById('state-grid'),
    influenceSvg: document.getElementById('influence-svg'),
    opStage: document.getElementById('op-stage'),

    avalancheStage: document.getElementById('avalanche-stage'),
    avTargetPt: document.getElementById('av-target-pt'),
    avTargetKey: document.getElementById('av-target-key'),
    avRandomFlipBtn: document.getElementById('av-random-flip-btn'),
    avFlippedInfo: document.getElementById('av-flipped-info'),
    avBitGrid: document.getElementById('av-bit-grid'),
    avGridA: document.getElementById('av-grid-a'),
    avGridB: document.getElementById('av-grid-b'),
    avDiffCounter: document.getElementById('av-diff-counter'),
    avDiffPercent: document.getElementById('av-diff-percent'),
    avByteDiffCounter: document.getElementById('av-byte-diff-counter'),
    avChartCanvas: document.getElementById('av-chart-canvas'),
    avHeatmap: document.getElementById('av-heatmap'),

    keyScheduleList: document.getElementById('key-schedule-list'),
    keyExpBody: document.getElementById('key-exp-body'),

    timelineTrack: document.getElementById('timeline-track'),
    btnReset: document.getElementById('btn-reset'),
    btnPrev: document.getElementById('btn-prev'),
    btnPlay: document.getElementById('btn-play'),
    playIcon: document.getElementById('play-icon'),
    playLabel: document.getElementById('play-label'),
    btnNext: document.getElementById('btn-next'),
    speedSlider: document.getElementById('speed-slider'),
    speedValue: document.getElementById('speed-value'),
    captionOpTag: document.getElementById('caption-op-tag'),
    captionText: document.getElementById('caption-text'),

    byteTooltip: document.getElementById('byte-tooltip'),
    mixcolPopover: document.getElementById('mixcol-popover'),
    mixcolPopoverClose: document.getElementById('mixcol-popover-close'),
    mixcolPopoverTitle: document.getElementById('mixcol-popover-title'),
    mixcolPopoverBody: document.getElementById('mixcol-popover-body')
  };

  // --------------------------------------------------------------------------
  // Terminal Boot Sequence Intro
  // --------------------------------------------------------------------------
  function runBootSequence() {
    const test = AES128.selfTest();
    if (prefersReducedMotion) {
      el.bootOverlay.classList.add('fade-out');
      window.AES_TUTORIAL?.onBootComplete();
      return;
    }

    const lines = [
      '> MOUNTING AES-128 CRYPTOGRAPHIC CORE [FIPS-197]...',
      `> GENERATING GF(2^8) S-BOX (0x11B)... [${test.sboxCheck ? 'OK' : 'ERR'}]`,
      '> EXPANDING 128-BIT KEY SCHEDULE (44 WORDS / 11 ROUND KEYS)... [OK]',
      `> NIST ENCRYPT SELF-TEST: ${test.encryptMatch ? 'PASS (3925841d...196a0b32)' : 'FAIL'}`,
      `> NIST DECRYPT ROUND-TRIP: ${test.decryptMatch ? 'PASS (3243f6a8...e0370734)' : 'FAIL'}`,
      '> LAUNCHING VISUALIZER STAGE...'
    ];

    let lineIdx = 0;
    let charIdx = 0;
    let dismissed = false;

    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      el.bootOverlay.classList.add('fade-out');
      window.AES_TUTORIAL?.onBootComplete();
    }

    el.skipBootBtn.addEventListener('click', dismiss);

    function typeNext() {
      if (dismissed) return;
      if (lineIdx >= lines.length) {
        setTimeout(dismiss, 360);
        return;
      }
      const line = lines[lineIdx];
      if (charIdx <= line.length) {
        const completed = lines.slice(0, lineIdx).join('\n');
        const current = line.slice(0, charIdx);
        el.bootLog.textContent = (completed ? completed + '\n' : '') + current + '█';
        charIdx += 3;
        setTimeout(typeNext, 16);
      } else {
        lineIdx++;
        charIdx = 0;
        setTimeout(typeNext, 75);
      }
    }

    typeNext();
  }

  // --------------------------------------------------------------------------
  // Input Parsing & Engine Execution
  // --------------------------------------------------------------------------
  function getInputBytes() {
    return appState.inputFormat === 'hex'
      ? AES128.hexToBytes16(el.plaintextInput.value)
      : AES128.textToBytes16(el.plaintextInput.value);
  }

  function getKeyBytes() {
    return appState.keyFormat === 'hex'
      ? AES128.hexToBytes16(el.keyInput.value)
      : AES128.textToBytes16(el.keyInput.value);
  }

  function formatSpacedHex(bytes) {
    return Array.from(bytes, (b) => AES128.formatHex(b)).join(' ');
  }

  function recomputeCipher(keepStep = true) {
    const inputBytes = getInputBytes();
    const keyBytes = getKeyBytes();

    el.plaintextHexPreview.textContent = `16B HEX: ${formatSpacedHex(inputBytes)}`;
    el.keyHexPreview.textContent = `16B HEX: ${formatSpacedHex(keyBytes)}`;

    appState.runData = AES128.run(inputBytes, keyBytes, appState.mode);

    // Recompute flipped run for Avalanche Mode
    const ptB = new Uint8Array(inputBytes);
    const keyB = new Uint8Array(keyBytes);
    const byteIdx = Math.floor(appState.flippedBitIndex / 8);
    const bitInByte = 7 - (appState.flippedBitIndex % 8);
    if (appState.avalancheTarget === 'pt') {
      ptB[byteIdx] ^= 1 << bitInByte;
    } else {
      keyB[byteIdx] ^= 1 << bitInByte;
    }
    appState.runDataFlipped = AES128.run(ptB, keyB, appState.mode);

    el.finalOutputLabel.textContent = appState.mode === 'encrypt' ? 'Final Ciphertext' : 'Recovered Plaintext';
    el.finalOutputHex.textContent = formatSpacedHex(appState.runData.output);

    updateNistVerificationBadge(inputBytes, keyBytes, appState.runData.output);
    renderKeySchedule();
    renderTimeline();

    if (!keepStep) {
      appState.stepIndex = 0;
    }
    renderCurrentStep(false);
  }

  function updateNistVerificationBadge(inputBytes, keyBytes, outputBytes) {
    const inHex = AES128.bytesToHex(inputBytes);
    const keyHex = AES128.bytesToHex(keyBytes);
    const outHex = AES128.bytesToHex(outputBytes);
    const nist = AES128.NIST_VECTOR;

    if (
      appState.mode === 'encrypt' &&
      inHex === nist.plaintextHex &&
      keyHex === nist.keyHex &&
      outHex === nist.ciphertextHex
    ) {
      el.nistBadge.classList.add('verified');
      el.nistBadgeText.textContent = 'Matches NIST FIPS-197 test vector';
    } else if (
      appState.mode === 'decrypt' &&
      inHex === nist.ciphertextHex &&
      keyHex === nist.keyHex &&
      outHex === nist.plaintextHex
    ) {
      el.nistBadge.classList.add('verified');
      el.nistBadgeText.textContent = 'Matches NIST FIPS-197 test vector (Decrypted)';
    } else {
      const roundTrip = AES128.run(outputBytes, keyBytes, appState.mode === 'encrypt' ? 'decrypt' : 'encrypt');
      const roundTripOk = AES128.bytesToHex(roundTrip.output) === inHex;
      el.nistBadge.classList.remove('verified');
      el.nistBadgeText.textContent = roundTripOk
        ? 'Custom input · Round-trip verified'
        : 'Verification mismatch';
    }
  }

  // --------------------------------------------------------------------------
  // Rendering: Key Schedule (Right Panel)
  // --------------------------------------------------------------------------
  function renderKeySchedule() {
    const { roundKeys } = appState.runData;
    const currentStep = appState.stepIndex >= 0 ? appState.runData.steps[appState.stepIndex] : null;
    const activeRk = currentStep ? currentStep.roundKeyIndex : 0;

    el.keyScheduleList.innerHTML = '';
    roundKeys.forEach((rk, r) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `key-row${r === activeRk ? ' active' : ''}`;
      row.setAttribute('role', 'listitem');
      row.innerHTML = `
        <span class="key-tag">K${r}</span>
        <span class="key-hex">${AES128.bytesToHex(rk)}</span>
      `;
      row.addEventListener('click', () => renderKeyExpansionDetail(r));
      el.keyScheduleList.appendChild(row);
    });

    renderKeyExpansionDetail(activeRk);
  }

  function renderKeyExpansionDetail(round) {
    const detail = appState.runData.keyScheduleDetails[round];
    if (!detail || round === 0) {
      el.keyExpBody.innerHTML = `
        <div><strong>K0 (Cipher Key)</strong></div>
        <div>Loaded directly as the initial 4 words (W0..W3) for pre-round key whitening.</div>
      `;
      return;
    }
    const fmt = (arr) => arr.map((b) => AES128.formatHex(b)).join(' ');
    el.keyExpBody.innerHTML = `
      <div><strong>K${round} First Word Derivation (W${round * 4}):</strong></div>
      <div>Prev W${round * 4 - 1}: <span style="color:var(--cyan)">${fmt(detail.prevLastWord)}</span></div>
      <div>RotWord: &nbsp;&nbsp;<span style="color:var(--amber)">${fmt(detail.rotWord)}</span></div>
      <div>SubWord: &nbsp;&nbsp;<span style="color:var(--magenta)">${fmt(detail.subWord)}</span></div>
      <div>Rcon[${round}]: &nbsp;&nbsp;<span style="color:var(--amber)">${fmt(detail.rcon)}</span></div>
      <div>W${round * 4} Out: &nbsp;&nbsp;<span style="color:var(--green)">${fmt(detail.xoredFirstWord)}</span></div>
    `;
  }

  // --------------------------------------------------------------------------
  // Rendering: Bottom Timeline (R0 to R10) with Contextual "?" Help Icons
  // --------------------------------------------------------------------------
  function renderTimeline() {
    const steps = appState.runData.steps;
    el.timelineTrack.innerHTML = '';

    const preGroup = document.createElement('div');
    preGroup.className = `tl-round${appState.stepIndex === -1 ? ' active-round' : ''}`;
    const preBtn = document.createElement('button');
    preBtn.type = 'button';
    preBtn.className = `tl-op${appState.stepIndex === -1 ? ' active' : ' done'}`;
    preBtn.textContent = 'IN';
    preBtn.title = 'Initial Input State';
    preBtn.addEventListener('click', () => goToStep(-1));
    preGroup.appendChild(preBtn);
    el.timelineTrack.appendChild(preGroup);

    for (let r = 0; r <= 10; r++) {
      const roundSteps = steps.filter((s) => s.round === r);
      const group = document.createElement('div');
      const isActiveRound = appState.stepIndex >= 0 && steps[appState.stepIndex].round === r;
      group.className = `tl-round${isActiveRound ? ' active-round' : ''}`;

      const label = document.createElement('span');
      label.className = 'tl-round-label';
      label.textContent = `R${r}`;
      group.appendChild(label);

      roundSteps.forEach((s) => {
        const wrap = document.createElement('span');
        wrap.className = 'tl-op-wrap';

        const btn = document.createElement('button');
        btn.type = 'button';
        let cls = 'tl-op';
        if (s.index === appState.stepIndex) cls += ' active';
        else if (s.index < appState.stepIndex) cls += ' done';
        btn.className = cls;
        btn.textContent = s.shortOp;
        btn.title = `Round ${s.round}: ${s.op}`;
        btn.addEventListener('click', () => goToStep(s.index));
        wrap.appendChild(btn);

        if (window.AES_TUTORIAL?.createTimelineHelpButton) {
          wrap.appendChild(window.AES_TUTORIAL.createTimelineHelpButton(s));
        }

        group.appendChild(wrap);
      });

      el.timelineTrack.appendChild(group);
    }

    const pill = el.timelineTrack.querySelector('.tl-op.active');
    const wrap = el.timelineTrack.parentElement;
    if (pill && wrap) {
        const p = pill.getBoundingClientRect(), w = wrap.getBoundingClientRect();
        wrap.scrollLeft += p.left - w.left - (w.width - p.width) / 2;
    }
  }

  // --------------------------------------------------------------------------
  // Step Navigation & Playback
  // --------------------------------------------------------------------------
  function goToStep(idx, animate = true) {
    const max = appState.runData.steps.length - 1;
    appState.stepIndex = Math.max(-1, Math.min(max, idx));
    renderCurrentStep(animate);
  }

  function togglePlay() {
    if (appState.isPlaying) {
      stopPlay();
    } else {
      startPlay();
    }
  }

  function startPlay() {
    if (appState.stepIndex >= appState.runData.steps.length - 1) {
      appState.stepIndex = -1;
    }
    appState.isPlaying = true;
    el.playIcon.innerHTML = '&#10074;&#10074;';
    el.playLabel.textContent = 'Pause';

    function tick() {
      if (!appState.isPlaying) return;
      if (appState.stepIndex < appState.runData.steps.length - 1) {
        goToStep(appState.stepIndex + 1, true);
        const delay = Math.round(1350 / appState.speed);
        appState.playTimer = setTimeout(tick, delay);
      } else {
        stopPlay();
      }
    }

    tick();
  }

  function stopPlay() {
    appState.isPlaying = false;
    if (appState.playTimer) {
      clearTimeout(appState.playTimer);
      appState.playTimer = null;
    }
    el.playIcon.innerHTML = '&#9654;';
    el.playLabel.textContent = 'Play';
  }

  // --------------------------------------------------------------------------
  // Particle Stream & Network Pulses
  // --------------------------------------------------------------------------
  function emitStageParticles() {
    if (prefersReducedMotion || appState.avalancheMode) return;
    el.stageParticles.innerHTML = '';
    for (let i = 0; i < 14; i++) {
      const p = document.createElement('span');
      p.className = 'stage-particle';
      p.style.left = `${8 + Math.random() * 45}%`;
      p.style.top = `${15 + Math.random() * 70}%`;
      p.style.setProperty('--tx', `${80 + Math.random() * 160}px`);
      p.style.setProperty('--ty', `${(Math.random() - 0.5) * 70}px`);
      p.style.animationDelay = `${i * 25}ms`;
      if (i % 3 === 0) {
        p.style.background = 'var(--magenta)';
        p.style.boxShadow = '0 0 8px var(--magenta)';
      }
      el.stageParticles.appendChild(p);
    }
  }

  function triggerNetworkForStep(step) {
    if (typeof window.networkPulse !== 'function') return;
    if (!step) {
      window.networkPulse('#5CE1FF', 'step');
      return;
    }
    if (step.op === 'SubBytes' || step.op === 'InvSubBytes') {
      window.networkPulse('#FF3D8B', 'subbytes');
    } else if (step.op === 'AddRoundKey') {
      window.networkPulse('#FFB547', 'addroundkey');
    } else {
      window.networkPulse('#FF3D8B', 'step');
    }
  }

  // --------------------------------------------------------------------------
  // Caption Renderer (Supports Beginner & Expert Modes)
  // --------------------------------------------------------------------------
  function refreshCaption() {
    const step = appState.stepIndex >= 0 ? appState.runData.steps[appState.stepIndex] : null;
    let plainText = '';

    if (!step) {
      el.captionOpTag.textContent = 'INPUT STATE';
      plainText =
        'Bytes are loaded column-major into the 4×4 AES state matrix (Col 0 = bytes 0–3, Col 1 = bytes 4–7, etc.). Press Next or Play to begin Round 0.';
    } else {
      el.captionOpTag.textContent = step.op.toUpperCase();
      plainText = step.caption;
    }

    const expertHtml = window.AES_TUTORIAL?.getExpertMathHtml
      ? window.AES_TUTORIAL.getExpertMathHtml(step)
      : '';

    el.captionText.innerHTML = `<div>${plainText}</div>${expertHtml}`;
  }

  // --------------------------------------------------------------------------
  // Main Render Dispatch
  // --------------------------------------------------------------------------
  function clearSboxTimers() {
    appState.sboxAnimTimers.forEach((id) => clearTimeout(id));
    appState.sboxAnimTimers = [];
    el.sboxBeamSvg.innerHTML = '';
  }

  function renderCurrentStep(animate) {
    clearSboxTimers();
    hideMixColPopover();

    const step = appState.stepIndex >= 0 ? appState.runData.steps[appState.stepIndex] : null;

    if (!step) {
      el.roundBadge.textContent = 'INPUT';
      el.progressLabel.textContent =
        appState.mode === 'encrypt'
          ? 'Initial State (Pre-Round 0): Plaintext Block Loaded'
          : 'Initial State (Pre-Round 0): Ciphertext Block Loaded';
    } else {
      el.roundBadge.textContent = `ROUND ${String(step.round).padStart(2, '0')}`;
      el.progressLabel.textContent = `Round ${step.round} of 10, step ${step.stepInRound} of ${step.stepsInRound}: ${step.op}`;
    }

    refreshCaption();
    renderKeySchedule();
    renderTimeline();

    if (appState.avalancheMode) {
      renderAvalancheView();
    } else {
      renderStandardStage(step, animate);
    }

    if (animate) {
      emitStageParticles();
      triggerNetworkForStep(step);
    }
  }

  // --------------------------------------------------------------------------
  // Standard Stage: 4x4 Grid + Operation-Specific Animation Area
  // --------------------------------------------------------------------------
  function renderStandardStage(step, animate) {
    const displayState = step ? step.stateAfter : appState.runData.input;
    const changed = step ? step.changedBytes : new Array(16).fill(false);
    const op = step ? step.op : 'Input';

    if (op === 'ShiftRows' || op === 'InvShiftRows') {
      const arrow = op === 'ShiftRows' ? '«' : '»';
      el.shiftLabels.querySelectorAll('.shift-tag').forEach((tag, r) => {
        tag.textContent = `${arrow} ${r}`;
      });
      el.shiftLabels.classList.add('visible');
    } else {
      el.shiftLabels.classList.remove('visible');
    }

    el.stateGrid.innerHTML = '';
    el.influenceSvg.innerHTML = '';

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const idx = c * 4 + r;
        const val = displayState[idx];
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'byte-tile';
        tile.dataset.row = r;
        tile.dataset.col = c;
        tile.dataset.idx = idx;

        if (changed[idx]) tile.classList.add('changed');

        if (animate && !prefersReducedMotion && step) {
          if (op === 'SubBytes' || op === 'InvSubBytes') {
            tile.classList.add('anim-flip');
            tile.style.animationDelay = `${idx * 18}ms`;
          } else if (op === 'ShiftRows' || op === 'InvShiftRows') {
            if (r > 0) {
              tile.classList.add('anim-shift');
              tile.style.setProperty('--shift-x', op === 'ShiftRows' ? r : -r);
            }
          } else if (op === 'AddRoundKey') {
            tile.classList.add('anim-xor');
            tile.style.animationDelay = `${idx * 14}ms`;
          } else if (op === 'MixColumns' || op === 'InvMixColumns') {
            tile.classList.add('anim-mixcol');
            tile.style.animationDelay = `${c * 90}ms`;
          }
        }

        tile.innerHTML = `
          <span class="byte-hex">${AES128.formatHex(val)}</span>
          <span class="byte-pos">r${r}c${c}</span>
        `;

        tile.addEventListener('mouseenter', (e) => {
          showByteTooltip(e, val, idx, r, c);
          drawInfluenceLines(r, c);
          if (op === 'SubBytes' || op === 'InvSubBytes') {
            highlightSboxCell(step.stateBefore[idx], step.stateAfter[idx], tile);
          }
        });
        tile.addEventListener('mousemove', positionByteTooltip);
        tile.addEventListener('mouseleave', () => {
          hideByteTooltip();
          clearInfluenceLines();
        });

        tile.addEventListener('click', () => {
          if (op === 'MixColumns' || op === 'InvMixColumns') {
            appState.selectedMixCol = c;
            renderMixColumnsOp(step);
            showMixColPopover(step, c);
          } else if (op === 'AddRoundKey') {
            appState.selectedArkByte = idx;
            renderAddRoundKeyOp(step);
          } else if (op === 'SubBytes' || op === 'InvSubBytes') {
            highlightSboxCell(step.stateBefore[idx], step.stateAfter[idx], tile);
          }
        });

        el.stateGrid.appendChild(tile);
      }
    }

    renderOperationStage(step, animate);
  }

  // --------------------------------------------------------------------------
  // Hover Tooltip & Row/Column Influence SVG Overlay
  // --------------------------------------------------------------------------
  function showByteTooltip(e, byteVal, idx, r, c) {
    const bin = byteVal.toString(2).padStart(8, '0');
    const hex = AES128.formatHex(byteVal);
    el.byteTooltip.innerHTML = `
      <div><strong>Byte #${idx}</strong> (Row ${r}, Col ${c})</div>
      <div>Hex: <span style="color:var(--cyan)">0x${hex}</span> &middot; Dec: <span style="color:var(--amber)">${byteVal}</span></div>
      <div>Bin: <span style="color:var(--magenta)">${bin.slice(0, 4)} ${bin.slice(4)}</span></div>
    `;
    el.byteTooltip.classList.remove('hidden');
    positionByteTooltip(e);
  }

  function positionByteTooltip(e) {
    const pad = 14;
    const x = Math.min(window.innerWidth - 220, e.clientX + pad);
    const y = Math.min(window.innerHeight - 90, e.clientY + pad);
    el.byteTooltip.style.left = `${x}px`;
    el.byteTooltip.style.top = `${y}px`;
  }

  function hideByteTooltip() {
    el.byteTooltip.classList.add('hidden');
  }

  function drawInfluenceLines(targetRow, targetCol) {
    const tiles = el.stateGrid.querySelectorAll('.byte-tile');
    const wrapRect = el.stateGridWrapper.getBoundingClientRect();
    let origin = null;

    tiles.forEach((t) => {
      const r = Number(t.dataset.row);
      const c = Number(t.dataset.col);
      t.classList.remove('peer-row', 'peer-col', 'peer-self');
      if (r === targetRow && c === targetCol) {
        t.classList.add('peer-self');
        origin = t;
      } else if (r === targetRow) {
        t.classList.add('peer-row');
      } else if (c === targetCol) {
        t.classList.add('peer-col');
      }
    });

    if (!origin) return;
    const oRect = origin.getBoundingClientRect();
    const ox = oRect.left + oRect.width / 2 - wrapRect.left;
    const oy = oRect.top + oRect.height / 2 - wrapRect.top;

    let svgMarkup = '';
    tiles.forEach((t) => {
      const r = Number(t.dataset.row);
      const c = Number(t.dataset.col);
      if (r === targetRow && c === targetCol) return;
      if (r === targetRow || c === targetCol) {
        const rect = t.getBoundingClientRect();
        const tx = rect.left + rect.width / 2 - wrapRect.left;
        const ty = rect.top + rect.height / 2 - wrapRect.top;
        const color = c === targetCol ? '#FF3D8B' : '#FFB547';
        svgMarkup += `<line x1="${ox}" y1="${oy}" x2="${tx}" y2="${ty}" stroke="${color}" stroke-width="2" stroke-opacity="0.78" stroke-dasharray="${r === targetRow ? '4 3' : 'none'}" />`;
      }
    });

    el.influenceSvg.innerHTML = svgMarkup;
  }

  function clearInfluenceLines() {
    el.influenceSvg.innerHTML = '';
    el.stateGrid.querySelectorAll('.byte-tile').forEach((t) => {
      t.classList.remove('peer-row', 'peer-col', 'peer-self');
    });
  }

  // --------------------------------------------------------------------------
  // Operation-Specific Stage Panels
  // --------------------------------------------------------------------------
  function renderOperationStage(step, animate) {
    if (!step) {
      el.opStage.innerHTML = `
        <div class="op-stage-head">
          <span class="op-stage-title">AES-128 PIPELINE READY</span>
          <span class="chip chip-cyan">10 ROUNDS</span>
        </div>
        <div class="sbox-lookup-bar">
          Every AES-128 round transforms this 16-byte state through non-linear byte substitution (SubBytes), row shifting (ShiftRows), GF(2⁸) column mixing (MixColumns), and key XORing (AddRoundKey).
        </div>
        <div class="xor-breakdown">
          <div><strong>Shortcuts:</strong></div>
          <div>&bull; <span style="color:var(--cyan)">Space</span> &rarr; Play / Pause</div>
          <div>&bull; <span style="color:var(--cyan)">Left / Right Arrow</span> &rarr; Step Backward / Forward</div>
          <div>&bull; <span style="color:var(--cyan)">Hover any tile</span> &rarr; Inspect Hex / Bin / Dec &amp; Row/Col peers</div>
        </div>
      `;
      return;
    }

    switch (step.op) {
      case 'SubBytes':
      case 'InvSubBytes':
        renderSubBytesOp(step, animate);
        break;
      case 'ShiftRows':
      case 'InvShiftRows':
        renderShiftRowsOp(step);
        break;
      case 'MixColumns':
      case 'InvMixColumns':
        renderMixColumnsOp(step);
        break;
      case 'AddRoundKey':
        renderAddRoundKeyOp(step);
        break;
    }
  }

  function renderSubBytesOp(step, animate) {
    const isInv = step.op === 'InvSubBytes';
    const table = isInv ? AES128.INV_SBOX : AES128.SBOX;

    let cellsHtml = '<div class="sbox-axis"></div>';
    for (let c = 0; c < 16; c++) {
      cellsHtml += `<div class="sbox-axis">${c.toString(16)}</div>`;
    }
    for (let r = 0; r < 16; r++) {
      cellsHtml += `<div class="sbox-axis">${r.toString(16)}</div>`;
      for (let c = 0; c < 16; c++) {
        const idx = r * 16 + c;
        cellsHtml += `<div class="sbox-cell" data-sbox="${idx}">${AES128.formatHex(table[idx])}</div>`;
      }
    }

    el.opStage.innerHTML = `
      <div class="op-stage-head">
        <span class="op-stage-title">${isInv ? 'INVERSE S-BOX (16×16)' : 'AES S-BOX LOOKUP (16×16)'}</span>
        <span class="chip chip-magenta">CONFUSION</span>
      </div>
      <div id="sbox-grid" class="sbox-grid">${cellsHtml}</div>
      <div id="sbox-lookup-bar" class="sbox-lookup-bar">
        Hover or click any state byte to trace its (row=high nibble, col=low nibble) lookup.
      </div>
    `;

    if (animate && !prefersReducedMotion) {
      const tiles = Array.from(el.stateGrid.querySelectorAll('.byte-tile'));
      tiles.forEach((tile, i) => {
        const tid = setTimeout(() => {
          const idx = Number(tile.dataset.idx);
          highlightSboxCell(step.stateBefore[idx], step.stateAfter[idx], tile);
        }, i * 55);
        appState.sboxAnimTimers.push(tid);
      });
    } else {
      const firstTile = el.stateGrid.querySelector('.byte-tile');
      highlightSboxCell(step.stateBefore[0], step.stateAfter[0], firstTile);
    }
  }

  function highlightSboxCell(inByte, outByte, tileEl) {
    const sboxGrid = document.getElementById('sbox-grid');
    const bar = document.getElementById('sbox-lookup-bar');
    if (!sboxGrid) return;

    sboxGrid.querySelectorAll('.sbox-cell.active').forEach((c) => c.classList.remove('active'));
    const targetCell = sboxGrid.querySelector(`.sbox-cell[data-sbox="${inByte}"]`);
    if (!targetCell) return;
    targetCell.classList.add('active');

    const hi = (inByte >> 4) & 0x0f;
    const lo = inByte & 0x0f;
    if (bar) {
      bar.innerHTML = `Lookup <strong>0x${AES128.formatHex(inByte)}</strong> &rarr; Row <strong>${hi.toString(16)}</strong>, Col <strong>${lo.toString(16)}</strong> &rarr; Output <strong style="color:var(--magenta)">0x${AES128.formatHex(outByte)}</strong>`;
    }

    if (tileEl) {
      const stageRect = el.standardStage.getBoundingClientRect();
      const tRect = tileEl.getBoundingClientRect();
      const cRect = targetCell.getBoundingClientRect();

      const x1 = tRect.left + tRect.width / 2 - stageRect.left;
      const y1 = tRect.top + tRect.height / 2 - stageRect.top;
      const x2 = cRect.left + cRect.width / 2 - stageRect.left;
      const y2 = cRect.top + cRect.height / 2 - stageRect.top;

      el.sboxBeamSvg.innerHTML = `
        <defs>
          <linearGradient id="beamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#FFB547" />
            <stop offset="100%" stop-color="#FF3D8B" />
          </linearGradient>
        </defs>
        <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="url(#beamGrad)" stroke-width="2.2" stroke-opacity="0.88" />
        <circle cx="${x2}" cy="${y2}" r="5" fill="#FF3D8B" />
      `;
    }
  }

  function renderShiftRowsOp(step) {
    const isInv = step.op === 'InvShiftRows';
    let rowsHtml = '';

    for (let r = 0; r < 4; r++) {
      let bytesHtml = '';
      for (let c = 0; c < 4; c++) {
        const idx = c * 4 + r;
        const val = step.stateAfter[idx];
        const wrapped = !isInv ? c >= 4 - r && r > 0 : c < r && r > 0;
        bytesHtml += `<span class="mini-byte${wrapped ? ' wrapped' : ''}">${AES128.formatHex(val)}</span>`;
      }
      rowsHtml += `
        <div class="shift-row-track">
          <span class="shift-row-badge">Row ${r}: ${isInv ? '>>' : '<<'} ${r}</span>
          <div class="shift-row-bytes">${bytesHtml}</div>
        </div>
      `;
    }

    el.opStage.innerHTML = `
      <div class="op-stage-head">
        <span class="op-stage-title">${isInv ? 'INVERSE ROW SHIFT' : 'CYCLIC ROW SHIFT'}</span>
        <span class="chip chip-amber">INTER-COLUMN DISPERSION</span>
      </div>
      <div class="shift-rows-visual">${rowsHtml}</div>
      <div class="sbox-lookup-bar">
        Magenta bytes wrapped around the row edge. After ShiftRows, every column holds bytes from 4 different original columns.
      </div>
    `;
  }

  function renderMixColumnsOp(step) {
    const c = appState.selectedMixCol;
    const colData = step.details.columns[c];
    const matrix = step.details.matrix;

    const pillsHtml = [0, 1, 2, 3]
      .map(
        (i) =>
          `<button type="button" class="col-pill${i === c ? ' active' : ''}" data-mixcol="${i}">Col ${i}</button>`
      )
      .join('');

    const matrixHtml = matrix
      .flat()
      .map((m) => `<span>${AES128.formatHex(m)}</span>`)
      .join('');

    const inVecHtml = colData.input
      .map((b) => `<span class="mini-byte">${AES128.formatHex(b)}</span>`)
      .join('');

    const outVecHtml = colData.output
      .map((b) => `<span class="mini-byte wrapped">${AES128.formatHex(b)}</span>`)
      .join('');

    el.opStage.innerHTML = `
      <div class="op-stage-head">
        <span class="op-stage-title">${step.details.inverse ? 'INV-MIXCOLUMNS' : 'MIXCOLUMNS'} GF(2⁸)</span>
        <button id="open-gf-popover-btn" type="button" class="btn-secondary btn-xs">Inspect GF(2⁸) Math</button>
      </div>
      <div class="mixcol-selector">${pillsHtml}</div>
      <div class="mixcol-pipeline">
        <div class="mix-matrix" title="Fixed GF(2^8) Matrix">${matrixHtml}</div>
        <span class="mix-op-sym">&times;</span>
        <div class="mix-vector">${inVecHtml}</div>
        <span class="mix-op-sym">=</span>
        <div class="mix-vector">${outVecHtml}</div>
      </div>
      <div class="sbox-lookup-bar">
        Click any column pill above or click a column in the 4&times;4 grid to inspect its exact GF(2⁸) polynomial products.
      </div>
    `;

    el.opStage.querySelectorAll('.col-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        appState.selectedMixCol = Number(btn.dataset.mixcol);
        renderMixColumnsOp(step);
        showMixColPopover(step, appState.selectedMixCol);
      });
    });

    const popBtn = document.getElementById('open-gf-popover-btn');
    if (popBtn) {
      popBtn.addEventListener('click', () => showMixColPopover(step, appState.selectedMixCol));
    }
  }

  function showMixColPopover(step, colIdx) {
    const colData = step.details.columns[colIdx];
    if (!colData) return;

    el.mixcolPopoverTitle.textContent = `${step.op} — Column ${colIdx} in GF(2⁸)`;
    el.mixcolPopoverBody.innerHTML = colData.rowsMath
      .map((rm) => {
        const expr = rm.terms
          .map((t) => `(${AES128.formatHex(t.coeff)}•${AES128.formatHex(t.input)})`)
          .join(' ⊕ ');
        const prods = rm.terms.map((t) => AES128.formatHex(t.product)).join(' ⊕ ');
        return `
          <div class="gf-eq-row">
            <div><strong>s'<sub>${rm.row}</sub></strong> = ${expr}</div>
            <div>&nbsp;&nbsp;&nbsp;&nbsp;= ${prods} = <strong style="color:var(--magenta)">${AES128.formatHex(rm.output)}</strong></div>
          </div>
        `;
      })
      .join('');

    el.mixcolPopover.classList.remove('hidden');
  }

  function hideMixColPopover() {
    el.mixcolPopover.classList.add('hidden');
  }

  function renderAddRoundKeyOp(step) {
    const sel = appState.selectedArkByte;
    const sByte = step.stateBefore[sel];
    const kByte = step.roundKey[sel];
    const oByte = step.stateAfter[sel];

    let rkGridHtml = '';
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const idx = c * 4 + r;
        rkGridHtml += `<button type="button" class="ark-cell${idx === sel ? ' selected' : ''}" data-ark="${idx}">${AES128.formatHex(step.roundKey[idx])}</button>`;
      }
    }

    const renderBits = (val, extraCls = '') => {
      const bits = val.toString(2).padStart(8, '0').split('');
      return `<div class="bit-strip ${extraCls}">${bits.map((b) => `<span class="${b === '1' ? 'one' : ''}">${b}</span>`).join('')}</div>`;
    };

    el.opStage.innerHTML = `
      <div class="op-stage-head">
        <span class="op-stage-title">ROUND KEY K${step.roundKeyIndex} &oplus; STATE</span>
        <span class="chip chip-amber">KEY MIXING</span>
      </div>
      <div class="ark-mini-grid">${rkGridHtml}</div>
      <div class="xor-breakdown">
        <div class="bit-row"><span class="bit-label">State</span><span class="bit-hex">${AES128.formatHex(sByte)}</span>${renderBits(sByte)}</div>
        <div class="bit-row"><span class="bit-label">Key</span><span class="bit-hex" style="color:var(--amber)">${AES128.formatHex(kByte)}</span>${renderBits(kByte, 'key')}</div>
        <div class="bit-row"><span class="bit-label">XOR</span><span class="bit-hex" style="color:var(--magenta)">${AES128.formatHex(oByte)}</span>${renderBits(oByte, 'out')}</div>
      </div>
    `;

    el.opStage.querySelectorAll('.ark-cell').forEach((cell) => {
      cell.addEventListener('click', () => {
        appState.selectedArkByte = Number(cell.dataset.ark);
        renderAddRoundKeyOp(step);
      });
    });
  }

  // --------------------------------------------------------------------------
  // AVALANCHE MODE (Dual Grids, Bit Flipper, Heatmap & Canvas Line Chart)
  // --------------------------------------------------------------------------
  function renderAvalancheView() {
    const idx = appState.stepIndex;
    const stateA = idx >= 0 ? appState.runData.steps[idx].stateAfter : appState.runData.input;
    const stateB = idx >= 0 ? appState.runDataFlipped.steps[idx].stateAfter : appState.runDataFlipped.input;

    const diff = AES128.countBitDiff(stateA, stateB);

    el.avDiffCounter.textContent = `${diff.bits} / 128`;
    el.avDiffPercent.textContent = `${((diff.bits / 128) * 100).toFixed(1)}%`;
    el.avByteDiffCounter.textContent = `${diff.bytes} / 16 bytes differ`;

    const byteIdx = Math.floor(appState.flippedBitIndex / 8);
    const bitInByte = appState.flippedBitIndex % 8;
    el.avFlippedInfo.textContent = `Flipped: ${appState.avalancheTarget === 'pt' ? 'Plaintext' : 'Key'} Byte ${byteIdx}, Bit ${bitInByte} (${bitInByte === 0 ? 'MSB' : bitInByte === 7 ? 'LSB' : 'bit'})`;

    renderAvalancheBitGrid();
    renderAvalancheStateGrid(el.avGridA, stateA, diff.perByte, false);
    renderAvalancheStateGrid(el.avGridB, stateB, diff.perByte, true);
    renderAvalancheHeatmap();
    drawAvalancheChart();
  }

  function renderAvalancheBitGrid() {
    const baseBytes = appState.avalancheTarget === 'pt' ? appState.runData.input : appState.runData.key;
    el.avBitGrid.innerHTML = '';

    for (let byteIdx = 0; byteIdx < 16; byteIdx++) {
      const group = document.createElement('div');
      group.className = 'av-byte-group';
      const val = baseBytes[byteIdx];
      group.innerHTML = `<div class="av-byte-head"><span>B${byteIdx}</span><span>${AES128.formatHex(val)}</span></div>`;

      const row = document.createElement('div');
      row.className = 'av-bits-row';
      for (let b = 0; b < 8; b++) {
        const globalBit = byteIdx * 8 + b;
        const isOne = (val >> (7 - b)) & 1;
        const isFlipped = globalBit === appState.flippedBitIndex;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `av-bit-btn${isOne ? ' is-one' : ''}${isFlipped ? ' flipped' : ''}`;
        btn.title = `Flip Byte ${byteIdx} Bit ${b}`;
        btn.setAttribute('aria-label', `Flip Byte ${byteIdx} Bit ${b}`);
        btn.addEventListener('click', () => {
          appState.flippedBitIndex = globalBit;
          recomputeCipher(true);
          if (typeof window.networkPulse === 'function') {
            window.networkPulse('#FF3D8B', 'avalanche');
          }
        });
        row.appendChild(btn);
      }
      group.appendChild(row);
      el.avBitGrid.appendChild(group);
    }
  }

  function renderAvalancheStateGrid(container, stateBytes, perByteDiff, showBadges) {
    container.innerHTML = '';
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const idx = c * 4 + r;
        const differs = perByteDiff[idx] > 0;
        const tile = document.createElement('div');
        tile.className = `byte-tile${differs ? ' changed' : ''}`;
        tile.innerHTML = `
          ${showBadges && differs ? `<span class="av-diff-badge">${perByteDiff[idx]}b</span>` : ''}
          <span class="byte-hex">${AES128.formatHex(stateBytes[idx])}</span>
        `;
        container.appendChild(tile);
      }
    }
  }

  function getRoundSnapshots(run) {
    const rounds = [];
    for (let r = 0; r <= 10; r++) {
      const roundSteps = run.steps.filter((s) => s.round === r);
      rounds.push(roundSteps[roundSteps.length - 1].stateAfter);
    }
    return rounds;
  }

  function renderAvalancheHeatmap() {
    const snapsA = getRoundSnapshots(appState.runData);
    const snapsB = getRoundSnapshots(appState.runDataFlipped);
    const activeRound = appState.stepIndex >= 0 ? appState.runData.steps[appState.stepIndex].round : -1;

    el.avHeatmap.innerHTML = '';
    for (let r = 0; r <= 10; r++) {
      const col = document.createElement('div');
      col.className = `hm-col${r === activeRound ? ' active' : ''}`;
      col.innerHTML = `<div class="hm-head">R${r}</div>`;
      const diff = AES128.countBitDiff(snapsA[r], snapsB[r]);
      for (let b = 0; b < 16; b++) {
        const bitCount = diff.perByte[b];
        const cell = document.createElement('div');
        cell.className = 'hm-cell';
        if (bitCount > 0) {
          const intensity = 0.25 + (bitCount / 8) * 0.75;
          cell.style.backgroundColor = `rgba(255, 61, 139, ${intensity.toFixed(2)})`;
          cell.style.boxShadow = bitCount >= 4 ? '0 0 6px rgba(255, 61, 139, 0.5)' : 'none';
        }
        cell.title = `Round ${r}, Byte ${b}: ${bitCount}/8 bits differ`;
        col.appendChild(cell);
      }
      el.avHeatmap.appendChild(col);
    }
  }

  function drawAvalancheChart() {
    const canvas = el.avChartCanvas;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(300, rect.width || 440);
    const h = 155;

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const snapsA = getRoundSnapshots(appState.runData);
    const snapsB = getRoundSnapshots(appState.runDataFlipped);

    const points = [AES128.countBitDiff(appState.runData.input, appState.runDataFlipped.input).bits];
    for (let r = 0; r <= 10; r++) {
      points.push(AES128.countBitDiff(snapsA[r], snapsB[r]).bits);
    }

    const padL = 34;
    const padR = 14;
    const padT = 14;
    const padB = 24;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const xAt = (i) => padL + (i / (points.length - 1)) * plotW;
    const yAt = (bits) => padT + plotH - (bits / 128) * plotH;

    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = 'rgba(233, 230, 255, 0.55)';
    [0, 64, 128].forEach((val) => {
      const y = yAt(val);
      ctx.strokeStyle = val === 64 ? 'rgba(255, 181, 71, 0.55)' : 'rgba(92, 225, 255, 0.14)';
      ctx.setLineDash(val === 64 ? [5, 4] : []);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillText(String(val), 4, y + 3);
    });
    ctx.setLineDash([]);

    const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, 'rgba(255, 61, 139, 0.35)');
    grad.addColorStop(1, 'rgba(255, 61, 139, 0.02)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(xAt(0), yAt(0));
    points.forEach((b, i) => ctx.lineTo(xAt(i), yAt(b)));
    ctx.lineTo(xAt(points.length - 1), yAt(0));
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#FF3D8B';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    points.forEach((b, i) => {
      if (i === 0) ctx.moveTo(xAt(i), yAt(b));
      else ctx.lineTo(xAt(i), yAt(b));
    });
    ctx.stroke();

    const activePt = appState.stepIndex >= 0 ? appState.runData.steps[appState.stepIndex].round + 1 : 0;
    const labels = ['IN', 'R0', 'R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10'];

    points.forEach((b, i) => {
      const x = xAt(i);
      const y = yAt(b);
      ctx.fillStyle = i === activePt ? '#FFB547' : '#5CE1FF';
      ctx.beginPath();
      ctx.arc(x, y, i === activePt ? 4.8 : 2.8, 0, Math.PI * 2);
      ctx.fill();

      if (i % 2 === 0 || i === 11) {
        ctx.fillStyle = 'rgba(233, 230, 255, 0.6)';
        ctx.fillText(labels[i], x - 8, h - 6);
      }
    });
  }

  // --------------------------------------------------------------------------
  // Mode & Avalanche Setters (Also exposed via window.AES_APP for tutorial.js)
  // --------------------------------------------------------------------------
  function setMode(mode) {
    stopPlay();
    appState.mode = mode;
    el.modeEncryptBtn.classList.toggle('active', mode === 'encrypt');
    el.modeDecryptBtn.classList.toggle('active', mode === 'decrypt');
    el.modeEncryptBtn.setAttribute('aria-pressed', String(mode === 'encrypt'));
    el.modeDecryptBtn.setAttribute('aria-pressed', String(mode === 'decrypt'));
    el.plaintextLabel.textContent = mode === 'encrypt' ? 'Plaintext (16 bytes)' : 'Ciphertext (16 bytes)';
    recomputeCipher(true);
  }

  function setAvalancheMode(enabled) {
    appState.avalancheMode = Boolean(enabled);
    el.avalancheToggleBtn.classList.toggle('active', appState.avalancheMode);
    el.avalancheToggleBtn.setAttribute('aria-pressed', String(appState.avalancheMode));
    el.standardStage.classList.toggle('hidden', appState.avalancheMode);
    el.avalancheStage.classList.toggle('hidden', !appState.avalancheMode);
    renderCurrentStep(false);
    if (appState.avalancheMode && typeof window.networkPulse === 'function') {
      window.networkPulse('#FF3D8B', 'avalanche');
    }
  }

  function setInputFormat(fmt, recompute = true) {
    appState.inputFormat = fmt;
    el.inputFormatHex.classList.toggle('active', fmt === 'hex');
    el.inputFormatText.classList.toggle('active', fmt === 'text');
    el.inputFormatHex.setAttribute('aria-pressed', String(fmt === 'hex'));
    el.inputFormatText.setAttribute('aria-pressed', String(fmt === 'text'));
    if (recompute) recomputeCipher(true);
  }

  function setKeyFormat(fmt, recompute = true) {
    appState.keyFormat = fmt;
    el.keyFormatHex.classList.toggle('active', fmt === 'hex');
    el.keyFormatText.classList.toggle('active', fmt === 'text');
    el.keyFormatHex.setAttribute('aria-pressed', String(fmt === 'hex'));
    el.keyFormatText.setAttribute('aria-pressed', String(fmt === 'text'));
    if (recompute) recomputeCipher(true);
  }

  // --------------------------------------------------------------------------
  // Event Wiring
  // --------------------------------------------------------------------------
  function bindEvents() {
    el.modeEncryptBtn.addEventListener('click', () => setMode('encrypt'));
    el.modeDecryptBtn.addEventListener('click', () => setMode('decrypt'));

    el.avalancheToggleBtn.addEventListener('click', () => {
      setAvalancheMode(!appState.avalancheMode);
    });

    el.inputFormatHex.addEventListener('click', () => setInputFormat('hex'));
    el.inputFormatText.addEventListener('click', () => setInputFormat('text'));
    el.keyFormatHex.addEventListener('click', () => setKeyFormat('hex'));
    el.keyFormatText.addEventListener('click', () => setKeyFormat('text'));

    el.plaintextInput.addEventListener('input', () => recomputeCipher(true));
    el.keyInput.addEventListener('input', () => recomputeCipher(true));

    el.loadNistBtn.addEventListener('click', () => {
      setInputFormat('hex', false);
      setKeyFormat('hex', false);
      el.plaintextInput.value =
        appState.mode === 'encrypt' ? AES128.NIST_VECTOR.plaintextHex : AES128.NIST_VECTOR.ciphertextHex;
      el.keyInput.value = AES128.NIST_VECTOR.keyHex;
      recomputeCipher(true);
    });

    el.randomizeBtn.addEventListener('click', () => {
      const randHex = () => {
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        return AES128.bytesToHex(arr);
      };
      setInputFormat('hex', false);
      setKeyFormat('hex', false);
      el.plaintextInput.value = randHex();
      el.keyInput.value = randHex();
      recomputeCipher(true);
    });

    el.swapOutputBtn.addEventListener('click', () => {
      const outHex = AES128.bytesToHex(appState.runData.output);
      setInputFormat('hex', false);
      el.plaintextInput.value = outHex;
      setMode(appState.mode === 'encrypt' ? 'decrypt' : 'encrypt');
    });

    el.copyOutputBtn.addEventListener('click', () => {
      const hex = AES128.bytesToHex(appState.runData.output);
      navigator.clipboard?.writeText(hex);
      el.copyOutputBtn.textContent = 'Copied!';
      setTimeout(() => { el.copyOutputBtn.textContent = 'Copy'; }, 1200);
    });

    el.avTargetPt.addEventListener('click', () => {
      appState.avalancheTarget = 'pt';
      el.avTargetPt.classList.add('active');
      el.avTargetKey.classList.remove('active');
      el.avTargetPt.setAttribute('aria-pressed', 'true');
      el.avTargetKey.setAttribute('aria-pressed', 'false');
      recomputeCipher(true);
    });

    el.avTargetKey.addEventListener('click', () => {
      appState.avalancheTarget = 'key';
      el.avTargetKey.classList.add('active');
      el.avTargetPt.classList.remove('active');
      el.avTargetKey.setAttribute('aria-pressed', 'true');
      el.avTargetPt.setAttribute('aria-pressed', 'false');
      recomputeCipher(true);
    });

    el.avRandomFlipBtn.addEventListener('click', () => {
      appState.flippedBitIndex = Math.floor(Math.random() * 128);
      recomputeCipher(true);
      if (typeof window.networkPulse === 'function') {
        window.networkPulse('#FF3D8B', 'avalanche');
      }
    });

    el.btnReset.addEventListener('click', () => {
      stopPlay();
      goToStep(0, true);
    });
    el.btnPrev.addEventListener('click', () => {
      stopPlay();
      goToStep(appState.stepIndex - 1, true);
    });
    el.btnNext.addEventListener('click', () => {
      stopPlay();
      goToStep(appState.stepIndex + 1, true);
    });
    el.btnPlay.addEventListener('click', togglePlay);

    el.speedSlider.addEventListener('input', () => {
      appState.speed = parseFloat(el.speedSlider.value);
      el.speedValue.textContent = `${appState.speed.toFixed(1)}×`;
    });

    el.mixcolPopoverClose.addEventListener('click', hideMixColPopover);

    window.addEventListener('keydown', (e) => {
      // Let Spotlight Tour handle keyboard navigation exclusively when active
      if (!document.getElementById('tour-card')?.classList.contains('hidden')) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        stopPlay();
        goToStep(appState.stepIndex + 1, true);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        stopPlay();
        goToStep(appState.stepIndex - 1, true);
      } else if (e.key === 'Escape') {
        hideMixColPopover();
      }
    });

    window.addEventListener('resize', () => {
      if (appState.avalancheMode) drawAvalancheChart();
    });
  }

  // Expose clean controller API for tutorial.js
  window.AES_APP = {
    goToStep,
    stopPlay,
    setMode,
    setAvalancheMode,
    refreshCaption,
    getState: () => ({
      mode: appState.mode,
      stepIndex: appState.stepIndex,
      avalancheMode: appState.avalancheMode,
      runData: appState.runData
    })
  };

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------
  bindEvents();
  window.AES_TUTORIAL?.init();
  recomputeCipher(false);
  runBootSequence();
})();