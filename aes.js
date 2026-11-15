/**
 * ============================================================================
 * AES-128 ALGORITHM ENGINE (NIST FIPS-197 Compliant, Zero Dependencies)
 * ============================================================================
 * Implements AES-128 from scratch:
 *  - GF(2^8) finite field arithmetic (mod x^8 + x^4 + x^3 + x + 1 -> 0x11B)
 *  - Programmatic S-Box & Inverse S-Box generation via multiplicative inverse
 *    and affine transformation (verified against FIPS-197)
 *  - Key Expansion (RotWord, SubWord, Rcon) producing 11 x 16-byte round keys
 *  - Forward operations: SubBytes, ShiftRows, MixColumns, AddRoundKey
 *  - Inverse operations: InvSubBytes, InvShiftRows, InvMixColumns
 *  - Full step-by-step history recording for forward & backward replay
 * ============================================================================
 */
(function (global) {
  'use strict';

  // NIST FIPS-197 Appendix B / C.1 Reference Test Vector
  const NIST_VECTOR = {
    plaintextHex: '3243f6a8885a308d313198a2e0370734',
    keyHex: '2b7e151628aed2a6abf7158809cf4f3c',
    ciphertextHex: '3925841d02dc09fbdc118597196a0b32'
  };

  // Fixed MixColumns & InvMixColumns 4x4 matrices (row-major for display/math)
  const MIX_MATRIX = [
    [0x02, 0x03, 0x01, 0x01],
    [0x01, 0x02, 0x03, 0x01],
    [0x01, 0x01, 0x02, 0x03],
    [0x03, 0x01, 0x01, 0x02]
  ];

  const INV_MIX_MATRIX = [
    [0x0e, 0x0b, 0x0d, 0x09],
    [0x09, 0x0e, 0x0b, 0x0d],
    [0x0d, 0x09, 0x0e, 0x0b],
    [0x0b, 0x0d, 0x09, 0x0e]
  ];

  // Round constants Rcon[1..10]
  const RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

  // --------------------------------------------------------------------------
  // Finite Field GF(2^8) Arithmetic
  // --------------------------------------------------------------------------

  /** Multiply a byte by x (0x02) in GF(2^8) modulo x^8 + x^4 + x^3 + x + 1 */
  function xtime(a) {
    return ((a << 1) ^ (a & 0x80 ? 0x1b : 0x00)) & 0xff;
  }

  /** Russian Peasant Multiplication in GF(2^8) */
  function gfMul(a, b) {
    let p = 0;
    let aa = a & 0xff;
    let bb = b & 0xff;
    for (let i = 0; i < 8; i++) {
      if (bb & 1) p ^= aa;
      const hiBitSet = aa & 0x80;
      aa = (aa << 1) & 0xff;
      if (hiBitSet) aa ^= 0x1b;
      bb >>= 1;
    }
    return p & 0xff;
  }

  /** Multiplicative inverse in GF(2^8); 0 maps to 0 per FIPS-197 */
  function gfInv(a) {
    if (a === 0) return 0;
    for (let x = 1; x < 256; x++) {
      if (gfMul(a, x) === 1) return x;
    }
    return 0;
  }

  function rotl8(b, shift) {
    return ((b << shift) | (b >>> (8 - shift))) & 0xff;
  }

  // --------------------------------------------------------------------------
  // S-Box & Inverse S-Box Construction (Guaranteed Typo-Free)
  // --------------------------------------------------------------------------
  const SBOX = new Uint8Array(256);
  const INV_SBOX = new Uint8Array(256);

  (function initSBoxes() {
    for (let i = 0; i < 256; i++) {
      const inv = gfInv(i);
      // Affine transformation over GF(2)
      const s =
        inv ^
        rotl8(inv, 1) ^
        rotl8(inv, 2) ^
        rotl8(inv, 3) ^
        rotl8(inv, 4) ^
        0x63;
      SBOX[i] = s & 0xff;
      INV_SBOX[s & 0xff] = i;
    }
  })();

  // --------------------------------------------------------------------------
  // Byte / Hex / UTF-8 Conversion Helpers
  // --------------------------------------------------------------------------

  function bytesToHex(bytes) {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  function hexToBytes16(hexStr) {
    const clean = (hexStr || '').replace(/[^0-9a-fA-F]/g, '').toLowerCase();
    const padded = clean.padEnd(32, '0').slice(0, 32);
    const out = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      out[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16) || 0;
    }
    return out;
  }

  function textToBytes16(text) {
    const encoder = new TextEncoder();
    const raw = encoder.encode(text || '');
    const out = new Uint8Array(16); // Zero-padded to 16 bytes for clear inspection
    out.set(raw.slice(0, 16));
    return out;
  }

  function formatHex(byte) {
    return (byte & 0xff).toString(16).padStart(2, '0');
  }

  // --------------------------------------------------------------------------
  // AES-128 Key Expansion (4 Words -> 44 Words = 11 Round Keys)
  // --------------------------------------------------------------------------

  function rotWord(word) {
    return [word[1], word[2], word[3], word[0]];
  }

  function subWord(word) {
    return [SBOX[word[0]], SBOX[word[1]], SBOX[word[2]], SBOX[word[3]]];
  }

  function keyExpansion(keyBytes) {
    const w = [];
    // First 4 words = original cipher key
    for (let i = 0; i < 4; i++) {
      w[i] = [keyBytes[4 * i], keyBytes[4 * i + 1], keyBytes[4 * i + 2], keyBytes[4 * i + 3]];
    }

    const details = [];

    for (let i = 4; i < 44; i++) {
      let temp = w[i - 1].slice();
      if (i % 4 === 0) {
        const round = i / 4;
        const prevLastWord = temp.slice();
        const rotated = rotWord(temp);
        const subbed = subWord(rotated);
        const rconWord = [RCON[round], 0x00, 0x00, 0x00];
        temp = [
          subbed[0] ^ rconWord[0],
          subbed[1] ^ rconWord[1],
          subbed[2] ^ rconWord[2],
          subbed[3] ^ rconWord[3]
        ];
        details[round] = {
          round,
          prevLastWord,
          rotWord: rotated,
          subWord: subbed,
          rcon: rconWord,
          xoredFirstWord: null // filled right below
        };
      }
      w[i] = [
        w[i - 4][0] ^ temp[0],
        w[i - 4][1] ^ temp[1],
        w[i - 4][2] ^ temp[2],
        w[i - 4][3] ^ temp[3]
      ];
      if (i % 4 === 0) {
        details[i / 4].xoredFirstWord = w[i].slice();
      }
    }

    // Group into 11 x 16-byte round keys
    const roundKeys = [];
    for (let r = 0; r <= 10; r++) {
      const rk = new Uint8Array(16);
      for (let col = 0; col < 4; col++) {
        const word = w[r * 4 + col];
        rk[col * 4] = word[0];
        rk[col * 4 + 1] = word[1];
        rk[col * 4 + 2] = word[2];
        rk[col * 4 + 3] = word[3];
      }
      roundKeys.push(rk);
      if (r === 0) {
        details[0] = { round: 0, key: rk };
      } else {
        details[r].key = rk;
      }
    }

    return { roundKeys, details };
  }

  // --------------------------------------------------------------------------
  // Core State Transformations (Column-Major: index = col * 4 + row)
  // --------------------------------------------------------------------------

  function addRoundKey(state, roundKey) {
    const next = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      next[i] = state[i] ^ roundKey[i];
    }
    return next;
  }

  function subBytes(state, inverse) {
    const table = inverse ? INV_SBOX : SBOX;
    const next = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      next[i] = table[state[i]];
    }
    return next;
  }

  function shiftRows(state, inverse) {
    const next = new Uint8Array(16);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        // Forward shifts left by r; Inverse shifts right by r
        const srcCol = inverse ? (c - r + 4) % 4 : (c + r) % 4;
        next[c * 4 + r] = state[srcCol * 4 + r];
      }
    }
    return next;
  }

  function mixColumns(state, inverse) {
    const matrix = inverse ? INV_MIX_MATRIX : MIX_MATRIX;
    const next = new Uint8Array(16);
    const columnDetails = [];

    for (let c = 0; c < 4; c++) {
      const colIn = [
        state[c * 4 + 0],
        state[c * 4 + 1],
        state[c * 4 + 2],
        state[c * 4 + 3]
      ];
      const rowsMath = [];

      for (let r = 0; r < 4; r++) {
        const terms = [];
        let acc = 0;
        for (let k = 0; k < 4; k++) {
          const coeff = matrix[r][k];
          const prod = gfMul(coeff, colIn[k]);
          terms.push({ coeff, input: colIn[k], product: prod });
          acc ^= prod;
        }
        next[c * 4 + r] = acc;
        rowsMath.push({ row: r, terms, output: acc });
      }

      columnDetails.push({
        col: c,
        input: colIn,
        output: [
          next[c * 4 + 0],
          next[c * 4 + 1],
          next[c * 4 + 2],
          next[c * 4 + 3]
        ],
        rowsMath
      });
    }

    return { next, columnDetails };
  }

  function diffBytes(before, after) {
    const changed = new Array(16);
    for (let i = 0; i < 16; i++) {
      changed[i] = before[i] !== after[i];
    }
    return changed;
  }

  // --------------------------------------------------------------------------
  // Plain-English Captions for Every Operation
  // --------------------------------------------------------------------------
  function getCaption(op, round) {
    switch (op) {
      case 'AddRoundKey':
        if (round === 0) {
          return 'Initial key whitening: AddRoundKey XORs the raw plaintext with Round Key K0. Only this step directly mixes the secret key into the state.';
        }
        if (round === 10) {
          return 'Final AddRoundKey XORs the state with K10 to produce the ciphertext. Round 10 skips MixColumns because an unkeyed linear layer at the end adds zero cryptographic security.';
        }
        return `AddRoundKey XORs every state byte with Round Key K${round}. Because XOR is its own inverse, the same operation reverses itself during decryption.`;
      case 'SubBytes':
        return 'SubBytes provides non-linear confusion by replacing every byte through the 16×16 S-Box (computed via GF(2⁸) multiplicative inverse + affine transform), resisting linear and differential cryptanalysis.';
      case 'ShiftRows':
        return 'ShiftRows cyclically shifts rows 0, 1, 2, and 3 left by 0, 1, 2, and 3 bytes respectively. Together with MixColumns, it spreads bytes across columns to achieve strong diffusion.';
      case 'MixColumns':
        return 'MixColumns multiplies each 4-byte column by a fixed MDS matrix in GF(2⁸). Changing 1 input byte alters all 4 output bytes in that column—maximizing diffusion.';
      case 'InvShiftRows':
        return 'InvShiftRows reverses row dispersion by cyclically shifting rows 0, 1, 2, and 3 to the right by 0, 1, 2, and 3 positions.';
      case 'InvSubBytes':
        return 'InvSubBytes reverses confusion by mapping every byte back through the Inverse S-Box lookup table.';
      case 'InvMixColumns':
        return 'InvMixColumns multiplies each column by the inverse GF(2⁸) matrix [0E, 0B, 0D, 09], undoing the forward linear column mixing.';
      default:
        return '';
    }
  }

  // --------------------------------------------------------------------------
  // Complete AES-128 Execution with Full Step Recording
  // --------------------------------------------------------------------------

  /**
   * Run AES-128 Encrypt or Decrypt and record every single operation step.
   * @param {Uint8Array} inputBytes - 16-byte input block
   * @param {Uint8Array} keyBytes - 16-byte cipher key
   * @param {'encrypt'|'decrypt'} mode
   */
  function run(inputBytes, keyBytes, mode = 'encrypt') {
    const input = new Uint8Array(inputBytes);
    const key = new Uint8Array(keyBytes);
    const { roundKeys, details: keyScheduleDetails } = keyExpansion(key);
    const steps = [];

    let state = new Uint8Array(input);

    function recordStep(round, stepInRound, stepsInRound, op, shortOp, roundKeyIndex, nextState, extraDetails = {}) {
      const step = {
        index: steps.length,
        round,
        totalRounds: 10,
        stepInRound,
        stepsInRound,
        op,
        shortOp,
        roundKeyIndex,
        roundKey: roundKeys[roundKeyIndex],
        stateBefore: new Uint8Array(state),
        stateAfter: new Uint8Array(nextState),
        changedBytes: diffBytes(state, nextState),
        caption: getCaption(op, round),
        details: extraDetails
      };
      steps.push(step);
      state = nextState;
    }

    if (mode === 'encrypt') {
      // Round 0: Initial AddRoundKey with K0
      recordStep(0, 1, 1, 'AddRoundKey', 'ARK', 0, addRoundKey(state, roundKeys[0]));

      // Rounds 1..9: SubBytes -> ShiftRows -> MixColumns -> AddRoundKey
      for (let r = 1; r <= 9; r++) {
        recordStep(r, 1, 4, 'SubBytes', 'SB', r, subBytes(state, false));
        recordStep(r, 2, 4, 'ShiftRows', 'SR', r, shiftRows(state, false));
        const mixed = mixColumns(state, false);
        recordStep(r, 3, 4, 'MixColumns', 'MC', r, mixed.next, {
          inverse: false,
          matrix: MIX_MATRIX,
          columns: mixed.columnDetails
        });
        recordStep(r, 4, 4, 'AddRoundKey', 'ARK', r, addRoundKey(state, roundKeys[r]));
      }

      // Round 10: SubBytes -> ShiftRows -> AddRoundKey (No MixColumns!)
      recordStep(10, 1, 3, 'SubBytes', 'SB', 10, subBytes(state, false));
      recordStep(10, 2, 3, 'ShiftRows', 'SR', 10, shiftRows(state, false));
      recordStep(10, 3, 3, 'AddRoundKey', 'ARK', 10, addRoundKey(state, roundKeys[10]));
    } else {
      // Decryption (Direct Inverse Cipher: exact reversal of encryption steps)
      // Round 0: AddRoundKey with K10
      recordStep(0, 1, 1, 'AddRoundKey', 'ARK', 10, addRoundKey(state, roundKeys[10]));

      // Rounds 1..9: InvShiftRows -> InvSubBytes -> AddRoundKey(K_{10-r}) -> InvMixColumns
      for (let r = 1; r <= 9; r++) {
        const rkIdx = 10 - r;
        recordStep(r, 1, 4, 'InvShiftRows', 'ISR', rkIdx, shiftRows(state, true));
        recordStep(r, 2, 4, 'InvSubBytes', 'ISB', rkIdx, subBytes(state, true));
        recordStep(r, 3, 4, 'AddRoundKey', 'ARK', rkIdx, addRoundKey(state, roundKeys[rkIdx]));
        const mixed = mixColumns(state, true);
        recordStep(r, 4, 4, 'InvMixColumns', 'IMC', rkIdx, mixed.next, {
          inverse: true,
          matrix: INV_MIX_MATRIX,
          columns: mixed.columnDetails
        });
      }

      // Round 10: InvShiftRows -> InvSubBytes -> AddRoundKey(K0)
      recordStep(10, 1, 3, 'InvShiftRows', 'ISR', 0, shiftRows(state, true));
      recordStep(10, 2, 3, 'InvSubBytes', 'ISB', 0, subBytes(state, true));
      recordStep(10, 3, 3, 'AddRoundKey', 'ARK', 0, addRoundKey(state, roundKeys[0]));
    }

    return {
      mode,
      input,
      key,
      output: new Uint8Array(state),
      roundKeys,
      keyScheduleDetails,
      steps
    };
  }

  /**
   * Verify engine against NIST FIPS-197 test vector (both encrypt and decrypt).
   */
  function selfTest() {
    const pt = hexToBytes16(NIST_VECTOR.plaintextHex);
    const key = hexToBytes16(NIST_VECTOR.keyHex);
    const enc = run(pt, key, 'encrypt');
    const dec = run(enc.output, key, 'decrypt');
    const encHex = bytesToHex(enc.output);
    const decHex = bytesToHex(dec.output);
    return {
      sboxCheck: SBOX[0x53] === 0xed && SBOX[0x00] === 0x63,
      encryptMatch: encHex === NIST_VECTOR.ciphertextHex,
      decryptMatch: decHex === NIST_VECTOR.plaintextHex,
      encHex,
      decHex
    };
  }

  /** Count differing bits (Hamming distance) between two 16-byte arrays */
  function countBitDiff(a, b) {
    let bits = 0;
    let bytes = 0;
    const perByte = new Array(16);
    for (let i = 0; i < 16; i++) {
      let x = a[i] ^ b[i];
      if (x !== 0) bytes++;
      let byteBits = 0;
      while (x) {
        byteBits += x & 1;
        x >>>= 1;
      }
      perByte[i] = byteBits;
      bits += byteBits;
    }
    return { bits, bytes, perByte };
  }

  global.AES128 = {
    NIST_VECTOR,
    SBOX,
    INV_SBOX,
    MIX_MATRIX,
    INV_MIX_MATRIX,
    RCON,
    gfMul,
    bytesToHex,
    hexToBytes16,
    textToBytes16,
    formatHex,
    countBitDiff,
    run,
    selfTest
  };
})(window);