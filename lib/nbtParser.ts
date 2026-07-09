/**
 * Minimal Minecraft NBT parser (big-endian, Paper 1.21 serializeAsBytes format).
 * Keine externen Dependencies.
 */

class NbtReader {
  private buf: Buffer;
  public offset = 0;

  constructor(buf: Buffer) {
    this.buf = buf;
  }

  byte(): number { return this.buf[this.offset++]; }
  short(): number { const v = this.buf.readInt16BE(this.offset); this.offset += 2; return v; }
  int(): number   { const v = this.buf.readInt32BE(this.offset); this.offset += 4; return v; }
  long(): bigint  { const v = this.buf.readBigInt64BE(this.offset); this.offset += 8; return v; }
  float(): number { const v = this.buf.readFloatBE(this.offset); this.offset += 4; return v; }
  double(): number{ const v = this.buf.readDoubleBE(this.offset); this.offset += 8; return v; }

  string(): string {
    const len = this.buf.readUInt16BE(this.offset); this.offset += 2;
    const s = this.buf.toString('utf8', this.offset, this.offset + len);
    this.offset += len;
    return s;
  }

  skipByteArray() { const n = this.int(); this.offset += n; }
  skipIntArray()  { const n = this.int(); this.offset += n * 4; }
  skipLongArray() { const n = this.int(); this.offset += n * 8; }

  /** Reads payload for a known type, returns only string values (for id / count extraction). */
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

  /** Parses a named root tag (type byte + 2-byte name length + name bytes + payload). */
  namedRoot(): Record<string, unknown> {
    const type = this.byte();
    const nameLen = this.buf.readUInt16BE(this.offset); this.offset += 2;
    this.offset += nameLen; // skip name
    if (type !== 10) throw new Error('Root tag is not a compound');
    return this.compound();
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export type ParsedItem = {
  id: string;          // e.g. "minecraft:diamond_sword"
  count: number;
  customName?: string;
};

/** Parses one NBT byte buffer (from Paper 1.21 ItemStack.serializeAsBytes). */
export function parseItemNbtBuffer(buf: Buffer): ParsedItem | null {
  try {
    const reader = new NbtReader(buf);
    const root = reader.namedRoot();

    const id = root['id'] as string | undefined;
    if (!id || id === 'minecraft:air') return null;

    const count =
      (root['count'] as number | undefined) ??
      (root['Count'] as number | undefined) ??
      1;

    let customName: string | undefined;
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

    return { id, count, customName };
  } catch {
    return null;
  }
}

/**
 * Parses the custom binary format written by PlayerDataSerializer.serializeItemStacks().
 * Format: int(slotCount) | for each slot: bool(hasItem) [+ int(nbtLen) + nbtBytes]
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
      const nbtBuf = buf.subarray(pos, pos + nbtLen);
      pos += nbtLen;
      slots.push(parseItemNbtBuffer(nbtBuf));
    }

    return slots;
  } catch {
    return [];
  }
}

