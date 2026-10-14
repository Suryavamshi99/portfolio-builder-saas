// GF(256) tables with primitive polynomial 0x11d (285)
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
let x = 1;
for (let i = 0; i < 255; i++) {
  EXP[i] = x;
  EXP[i + 255] = x;
  LOG[x] = i;
  x = (x << 1) ^ (x & 128 ? 285 : 0);
}

function gMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a]! + LOG[b]!]!;
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = EXP[i]!;
    for (let j = 0; j < poly.length; j++) {
      next[j] = (next[j]! ^ gMul(poly[j]!, factor)) as number;
      next[j + 1] = (next[j + 1]! ^ poly[j]!) as number;
    }
    poly = next;
  }
  return poly;
}

function rsCompute(data: Uint8Array, numEc: number): Uint8Array {
  const gen = rsGeneratorPoly(numEc);
  const res = new Uint8Array(numEc);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i]! ^ res[0]!;
    for (let j = 0; j < numEc - 1; j++) {
      res[j] = res[j + 1]! ^ gMul(gen[numEc - 1 - j]!, factor);
    }
    res[numEc - 1] = gMul(gen[0]!, factor);
  }
  return res;
}

interface QrVersion {
  version: number;
  size: number;
  totalCodewords: number;
  dataCodewords: number;
  ecCodewords: number;
  alignments: number[];
}

const VERSIONS: QrVersion[] = [
  { version: 4, size: 33, totalCodewords: 100, dataCodewords: 80, ecCodewords: 20, alignments: [6, 26] },
  { version: 5, size: 37, totalCodewords: 134, dataCodewords: 108, ecCodewords: 26, alignments: [6, 30] },
  { version: 6, size: 41, totalCodewords: 172, dataCodewords: 136, ecCodewords: 36, alignments: [6, 34] },
  { version: 7, size: 45, totalCodewords: 196, dataCodewords: 156, ecCodewords: 40, alignments: [6, 22, 38] },
];

function selectVersion(dataLen: number): QrVersion {
  for (const v of VERSIONS) {
    if (dataLen + 3 <= v.dataCodewords) return v;
  }
  return VERSIONS[VERSIONS.length - 1]!;
}

function encodeData(text: string, v: QrVersion): Uint8Array {
  const bytes = new TextEncoder().encode(text);
  const data = new Uint8Array(v.dataCodewords);
  let bitPos = 0;

  function putBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) {
      const bit = (val >>> i) & 1;
      const byteIdx = bitPos >>> 3;
      const bitIdx = 7 - (bitPos & 7);
      if (byteIdx < data.length) {
        data[byteIdx] = (data[byteIdx] ?? 0) | (bit << bitIdx);
      }
      bitPos++;
    }
  }

  // Byte mode indicator: 0100 (4)
  putBits(4, 4);
  // Character count: 8 bits for version 1-9 byte mode
  putBits(bytes.length, 8);
  // Data bytes
  for (const b of bytes) {
    putBits(b, 8);
  }
  // Terminator: up to 4 zero bits
  putBits(0, Math.min(4, v.dataCodewords * 8 - bitPos));

  // Align to byte boundary
  while (bitPos % 8 !== 0 && bitPos < v.dataCodewords * 8) {
    putBits(0, 1);
  }

  // Pad with alternating 0xEC and 0x11
  let padIdx = bitPos >>> 3;
  let pad = 0xec;
  while (padIdx < v.dataCodewords) {
    data[padIdx++] = pad;
    pad = pad === 0xec ? 0x11 : 0xec;
  }

  return data;
}

export function generateQrMatrix(text: string): boolean[][] {
  const v = selectVersion(new TextEncoder().encode(text).length);
  const N = v.size;
  const matrix: (boolean | null)[][] = Array.from({ length: N }, () => Array(N).fill(null));
  const isFunction: boolean[][] = Array.from({ length: N }, () => Array(N).fill(false));

  function setFunc(r: number, c: number, val: boolean) {
    if (r >= 0 && r < N && c >= 0 && c < N) {
      matrix[r]![c] = val;
      isFunction[r]![c] = true;
    }
  }

  // Finder patterns
  function drawFinder(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const isCore = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        if (!isCore) {
          setFunc(row + r, col + c, false);
        } else {
          const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          setFunc(row + r, col + c, isBorder || isCenter);
        }
      }
    }
  }
  drawFinder(0, 0);
  drawFinder(0, N - 7);
  drawFinder(N - 7, 0);

  // Timing patterns
  for (let i = 8; i < N - 8; i++) {
    setFunc(6, i, i % 2 === 0);
    setFunc(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  for (const r of v.alignments) {
    for (const c of v.alignments) {
      if ((r < 9 && c < 9) || (r < 9 && c >= N - 9) || (r >= N - 9 && c < 9)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isBorder = Math.abs(dr) === 2 || Math.abs(dc) === 2;
          const isCenter = dr === 0 && dc === 0;
          setFunc(r + dr, c + dc, isBorder || isCenter);
        }
      }
    }
  }

  // Dark module
  setFunc(4 * v.version + 9, 8, true);

  // Reserve format info area
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      setFunc(8, i, false);
      setFunc(i, 8, false);
    }
  }
  for (let i = 0; i < 8; i++) {
    setFunc(8, N - 1 - i, false);
    setFunc(N - 1 - i, 8, false);
  }

  // Encode data + EC
  const data = encodeData(text, v);
  const ec = rsCompute(data, v.ecCodewords);
  const allCodewords = new Uint8Array(v.totalCodewords);
  allCodewords.set(data, 0);
  allCodewords.set(ec, data.length);

  // Place codewords in matrix (zigzag)
  let bitIdx = 0;
  let upwards = true;
  for (let right = N - 1; right > 0; right -= 2) {
    if (right === 6) right--;
    const rows = upwards ? Array.from({ length: N }, (_, i) => N - 1 - i) : Array.from({ length: N }, (_, i) => i);
    for (const r of rows) {
      for (const c of [right, right - 1]) {
        if (!isFunction[r]![c]) {
          const byte = bitIdx < allCodewords.length * 8 ? allCodewords[bitIdx >>> 3]! : 0;
          const bitVal = ((byte >>> (7 - (bitIdx & 7))) & 1) === 1;
          const masked = bitVal !== ((r + c) % 2 === 0);
          matrix[r]![c] = masked;
          bitIdx++;
        }
      }
    }
    upwards = !upwards;
  }

  // Format information (Level L, Mask 0: 0x77c4)
  const formatBits = 0x77c4;
  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >>> (14 - i)) & 1) === 1;
    if (i < 6) matrix[8]![i] = bit;
    else if (i < 8) matrix[8]![i + 1] = bit;
    else if (i === 8) matrix[7]![8] = bit;
    else matrix[14 - i]![8] = bit;

    if (i < 8) matrix[N - 1 - i]![8] = bit;
    else matrix[8]![N - 15 + i] = bit;
  }

  return matrix.map((row) => row.map((cell) => cell === true));
}
