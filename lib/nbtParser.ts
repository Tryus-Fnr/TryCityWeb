/**
 * Minimal Minecraft NBT parser (big-endian, Paper 1.21 serializeAsBytes format).
 * Keine externen Dependencies (außer Node.js-builtin zlib).
 *
 * Paper schreibt die NBT-Bytes GZIP-komprimiert (1F 8B 08 … = "H4sI…" in Base64).
 * Der Binary-Wrapper ist: int(slotCount) | per Slot: bool(hasItem) + int(nbtLen) + gzipBytes
 */

import { gunzipSync } from 'zlib';

class NbtReader {
  readonly buf: Buffer;
  offset = 0;

  constructor(buf: Buffer, start = 0) {
    this.buf = buf;
    this.offset = start;
  }

  clone(): NbtReader { return new NbtReader(this.buf, this.offset); }

  byte(): number { return this.buf[this.offset++]; }
  ubyte(): number { return this.buf[this.offset++]; }
  short(): number { const v = this.buf.readInt16BE(this.offset); this.offset += 2; return v; }
  ushort(): number { const v = this.buf.readUInt16BE(this.offset); this.offset += 2; return v; }
  int(): number   { const v = this.buf.readInt32BE(this.offset); this.offset += 4; return v; }
  long(): bigint  { const v = this.buf.readBigInt64BE(this.offset); this.offset += 8; return v; }
  float(): number { const v = this.buf.readFloatBE(this.offset); this.offset += 4; return v; }
  double(): number{ const v = this.buf.readDoubleBE(this.offset); this.offset += 8; return v; }

  string(): string {
    const len = this.ushort();
    const s = this.buf.toString('utf8', this.offset, this.offset + len);
    this.offset += len;
    return s;
  }

  skipByteArray() { this.offset += this.int(); }
  skipIntArray()  { this.offset += this.int() * 4; }
  skipLongArray() { this.offset += this.int() * 8; }

  payload(type: number): unknown {
    switch (type) {
      case 1:  return this.byte();
      case 2:  return this.short();
      case 3:  return this.int();
      case 4:  { this.long(); return undefined; }
      case 5:  return this.float();
      case 6:  return this.double();
      case 7:  { this.skipByteArray(); return undefined; }
      case 8:  return this.string();
      case 9:  return this.list();
      case 10: return this.compound();
      case 11: { this.skipIntArray(); return undefined; }
      case 12: { this.skipLongArray(); return undefined; }
      default: throw new Error(`Unknown NBT type ${type}`);
    }
  }

  list(): unknown[] {
    const elemType = this.byte();
    const count    = this.int();
    const arr: unknown[] = [];
    for (let i = 0; i < count; i++) arr.push(this.payload(elemType));
    return arr;
  }

  compound(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    for (;;) {
      const type = this.byte();
      if (type === 0) break;
      const name = this.string();
      obj[name] = this.payload(type);
    }
    return obj;
  }
}

// ─── Item extraction ─────────────────────────────────────────────────────────

function extractItem(root: Record<string, unknown>): ParsedItem | null {
  const id = root['id'] as string | undefined;
  if (!id || id === 'minecraft:air' || id === 'air') return null;

  const count =
    (root['count']  as number | undefined) ??
    (root['Count']  as number | undefined) ??
    1;

  let customName: string | undefined;

  // 1.20.5+ component system: components["minecraft:custom_name"]
  const components = root['components'] as Record<string, unknown> | undefined;
  if (components) {
    const rawName = components['minecraft:custom_name'] as string | undefined;
    if (rawName) {
      try {
        const parsed = JSON.parse(rawName);
        customName = typeof parsed === 'string' ? parsed : (parsed as { text?: string })?.text;
      } catch { customName = rawName; }
    }
  }

  // Legacy (≤1.20.4): tag.display.Name
  if (!customName) {
    const tag = root['tag'] as Record<string, unknown> | undefined;
    const display = tag?.['display'] as Record<string, unknown> | undefined;
    const rawName = display?.['Name'] as string | undefined;
    if (rawName) {
      try {
        const parsed = JSON.parse(rawName);
        customName = typeof parsed === 'string' ? parsed : (parsed as { text?: string })?.text;
      } catch { customName = rawName; }
    }
  }

  return { id: id.includes(':') ? id : `minecraft:${id}`, count, customName };
}

// ─── Public API ─────────────────────────────────────────────────────────────

export type ParsedItem = {
  id: string;
  count: number;
  customName?: string;
};

/**
 * Parses one NBT byte buffer from Paper 1.21 ItemStack.serializeAsBytes().
 * Tries three formats in order to handle different Paper/Minecraft versions.
 */
export function parseItemNbtBuffer(buf: Buffer): ParsedItem | null {
  if (!buf || buf.length < 2) return null;

  // ── Format A: TYPE(0x0A) + 2-byte name len + name + compound entries ──
  try {
    const r = new NbtReader(buf);
    const type = r.byte();
    if (type === 10) {
      const nameLen = r.ushort();
      r.offset += nameLen;
      const root = r.compound();
      const item = extractItem(root);
      if (item) return item;
    }
  } catch { /* try next */ }

  // ── Format B: TYPE(0x0A) + compound entries (no name bytes) ──
  try {
    const r = new NbtReader(buf, 1); // skip type byte
    if (buf[0] === 10) {
      const root = r.compound();
      const item = extractItem(root);
      if (item) return item;
    }
  } catch { /* try next */ }

  // ── Format C: direct compound entries (no type byte) ──
  try {
    const r = new NbtReader(buf);
    const root = r.compound();
    const item = extractItem(root);
    if (item) return item;
  } catch { /* ignore */ }

  return null;
}

/**
 * Parses the custom binary format written by PlayerDataSerializer.serializeItemStacks().
 * Format: int(slotCount) | for each slot: bool(hasItem) [+ int(nbtLen) + gzipNbtBytes]
 *
 * Die NBT-Bytes sind GZIP-komprimiert (Paper NbtIo.writeCompressed / serializeAsBytes).
 */
export function parseInventoryBase64(base64: string | null): (ParsedItem | null)[] {
  if (!base64) return [];
  try {
    const buf = Buffer.from(base64, 'base64');
    let pos = 0;

    const readInt  = () => { const v = buf.readInt32BE(pos); pos += 4; return v; };
    const readBool = () => { return buf[pos++] !== 0; };

    const slotCount = readInt();
    const slots: (ParsedItem | null)[] = [];

    for (let i = 0; i < slotCount; i++) {
      const hasItem = readBool();
      if (!hasItem) { slots.push(null); continue; }

      const nbtLen = readInt();
      let nbtBuf = buf.subarray(pos, pos + nbtLen);
      pos += nbtLen;

      // GZIP-Magic: 1F 8B → dekomprimieren
      if (nbtBuf.length >= 2 && nbtBuf[0] === 0x1f && nbtBuf[1] === 0x8b) {
        try { nbtBuf = gunzipSync(nbtBuf); } catch { slots.push(null); continue; }
      }

      slots.push(parseItemNbtBuffer(nbtBuf));
    }

    return slots;
  } catch {
    return [];
  }
}




