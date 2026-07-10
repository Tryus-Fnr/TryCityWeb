import { deflateSync } from "node:zlib";

/**
 * Rendert die Pixel-Snapshots aus smpg_map_sync (128×128 Minecraft-Map-
 * Farbindizes, ein Byte pro Pixel) als PNG – ohne externe Bibliothek.
 *
 * Farbindex-Aufbau (vanilla): index = baseColor * 4 + shade.
 * shade-Multiplikatoren: 0→180, 1→220, 2→255, 3→135 (jeweils /255).
 * baseColor 0 (NONE) ist transparent.
 */

export const MAP_SIZE = 128;
export const MAP_PIXEL_COUNT = MAP_SIZE * MAP_SIZE;

/** Vanilla-Basisfarben (MapColor) – Index = baseColor-ID. */
const BASE_COLORS: ReadonlyArray<readonly [number, number, number] | null> = [
  null,            // 0  NONE (transparent)
  [127, 178, 56],  // 1  GRASS
  [247, 233, 163], // 2  SAND
  [199, 199, 199], // 3  WOOL
  [255, 0, 0],     // 4  FIRE
  [160, 160, 255], // 5  ICE
  [167, 167, 167], // 6  METAL
  [0, 124, 0],     // 7  PLANT
  [255, 255, 255], // 8  SNOW
  [164, 168, 184], // 9  CLAY
  [151, 109, 77],  // 10 DIRT
  [112, 112, 112], // 11 STONE
  [64, 64, 255],   // 12 WATER
  [143, 119, 72],  // 13 WOOD
  [255, 252, 245], // 14 QUARTZ
  [216, 127, 51],  // 15 COLOR_ORANGE
  [178, 76, 216],  // 16 COLOR_MAGENTA
  [102, 153, 216], // 17 COLOR_LIGHT_BLUE
  [229, 229, 51],  // 18 COLOR_YELLOW
  [127, 204, 25],  // 19 COLOR_LIGHT_GREEN
  [242, 127, 165], // 20 COLOR_PINK
  [76, 76, 76],    // 21 COLOR_GRAY
  [153, 153, 153], // 22 COLOR_LIGHT_GRAY
  [76, 127, 153],  // 23 COLOR_CYAN
  [127, 63, 178],  // 24 COLOR_PURPLE
  [51, 76, 178],   // 25 COLOR_BLUE
  [102, 76, 51],   // 26 COLOR_BROWN
  [102, 127, 51],  // 27 COLOR_GREEN
  [153, 51, 51],   // 28 COLOR_RED
  [25, 25, 25],    // 29 COLOR_BLACK
  [250, 238, 77],  // 30 GOLD
  [92, 219, 213],  // 31 DIAMOND
  [74, 128, 255],  // 32 LAPIS
  [0, 217, 58],    // 33 EMERALD
  [129, 86, 49],   // 34 PODZOL
  [112, 2, 0],     // 35 NETHER
  [209, 177, 161], // 36 TERRACOTTA_WHITE
  [159, 82, 36],   // 37 TERRACOTTA_ORANGE
  [149, 87, 108],  // 38 TERRACOTTA_MAGENTA
  [112, 108, 138], // 39 TERRACOTTA_LIGHT_BLUE
  [186, 133, 36],  // 40 TERRACOTTA_YELLOW
  [103, 117, 53],  // 41 TERRACOTTA_LIGHT_GREEN
  [160, 77, 78],   // 42 TERRACOTTA_PINK
  [57, 41, 35],    // 43 TERRACOTTA_GRAY
  [135, 107, 98],  // 44 TERRACOTTA_LIGHT_GRAY
  [87, 92, 92],    // 45 TERRACOTTA_CYAN
  [122, 73, 88],   // 46 TERRACOTTA_PURPLE
  [76, 62, 92],    // 47 TERRACOTTA_BLUE
  [76, 50, 35],    // 48 TERRACOTTA_BROWN
  [76, 82, 42],    // 49 TERRACOTTA_GREEN
  [142, 60, 46],   // 50 TERRACOTTA_RED
  [37, 22, 16],    // 51 TERRACOTTA_BLACK
  [189, 48, 49],   // 52 CRIMSON_NYLIUM
  [148, 63, 97],   // 53 CRIMSON_STEM
  [92, 25, 29],    // 54 CRIMSON_HYPHAE
  [22, 126, 134],  // 55 WARPED_NYLIUM
  [58, 142, 140],  // 56 WARPED_STEM
  [86, 44, 62],    // 57 WARPED_HYPHAE
  [20, 180, 133],  // 58 WARPED_WART_BLOCK
  [100, 100, 100], // 59 DEEPSLATE
  [216, 175, 147], // 60 RAW_IRON
  [127, 167, 150], // 61 GLOW_LICHEN
];

const SHADE_MULTIPLIERS = [180, 220, 255, 135] as const;

/** Vorberechnete RGBA-Lookup-Tabelle für alle 256 möglichen Index-Bytes. */
const RGBA_LOOKUP: Uint8Array = (() => {
  const table = new Uint8Array(256 * 4);
  for (let index = 0; index < 256; index++) {
    const base = BASE_COLORS[index >> 2] ?? null;
    const offset = index * 4;
    if (base === null) {
      // transparent (auch unbekannte/zukünftige Basisfarben → transparent
      // statt falscher Farbe)
      table[offset + 3] = 0;
      continue;
    }
    const mult = SHADE_MULTIPLIERS[index & 3];
    table[offset]     = Math.floor((base[0] * mult) / 255);
    table[offset + 1] = Math.floor((base[1] * mult) / 255);
    table[offset + 2] = Math.floor((base[2] * mult) / 255);
    table[offset + 3] = 255;
  }
  return table;
})();

// ─── Minimaler PNG-Encoder (IHDR + IDAT + IEND) ─────────────────────────────

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, "ascii");
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length);
  return chunk;
}

/**
 * Wandelt die (bereits entpackten) 16384 Farbindex-Bytes in ein
 * 128×128-RGBA-PNG um. Skalierung übernimmt der Browser
 * (image-rendering: pixelated).
 */
export function renderMapPng(pixels: Buffer): Buffer {
  // Raw-Scanlines: pro Zeile 1 Filter-Byte (0) + 128 * 4 RGBA-Bytes
  const raw = Buffer.alloc(MAP_SIZE * (1 + MAP_SIZE * 4));
  for (let z = 0; z < MAP_SIZE; z++) {
    const rowStart = z * (1 + MAP_SIZE * 4) + 1;
    for (let x = 0; x < MAP_SIZE; x++) {
      const lookupOffset = pixels[z * MAP_SIZE + x] * 4;
      const out = rowStart + x * 4;
      raw[out]     = RGBA_LOOKUP[lookupOffset];
      raw[out + 1] = RGBA_LOOKUP[lookupOffset + 1];
      raw[out + 2] = RGBA_LOOKUP[lookupOffset + 2];
      raw[out + 3] = RGBA_LOOKUP[lookupOffset + 3];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(MAP_SIZE, 0); // width
  ihdr.writeUInt32BE(MAP_SIZE, 4); // height
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG-Signatur
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
