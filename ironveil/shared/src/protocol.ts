export const MSG_C_JOIN = 1;
export const MSG_C_INPUT = 2;
export const MSG_C_ACTION = 3;
export const MSG_C_PING = 4;
export const MSG_C_CHAT = 5;
export const MSG_C_LEAVE = 6;

export const MSG_S_WELCOME = 10;
export const MSG_S_SNAPSHOT = 11;
export const MSG_S_EVENTS = 12;
export const MSG_S_ROSTER = 13;
export const MSG_S_PONG = 14;
export const MSG_S_CHAT = 15;

export const MSG_S_KICK = 16;

export const MSG_S_PING = 17;

export const MSG_C_PONG = 18;
export const ACT_RELOAD = 1;
export const ACT_SLOT = 2;
export const ACT_NEXT = 3;
export const ACT_PREV = 4;
export const ACT_ABILITY_Q = 5;
export const ACT_ABILITY_E = 6;
export const ACT_SELECT_PRIMARY = 7;
export const ACT_SELECT_AGENT = 8;
export const ACT_QUICKCHAT = 9;

export const EV_SHOT = 1;
export const EV_IMPACT = 2;
export const EV_HITCONFIRM = 3;
export const EV_DAMAGED = 4;
export const EV_KILL = 5;
export const EV_FOOTSTEP = 6;
export const EV_RELOAD = 7;
export const EV_ABILITY = 8;
export const EV_BLINDED = 9;
export const EV_BANNER = 10;

export const EF_HEAD = 1;
export const EF_KILLED = 2;

export const ABK_SCAN = 1;
export const ABK_SILENT = 2;
export const ABK_WALL = 3;
export const ABK_FORTIFY = 4;
export const ABK_DASH = 5;
export const ABK_UPDRAFT = 6;
export const ABK_FIELD = 7;
export const ABK_FLARE = 8;
export const ABK_WALLDOWN = 9;

export const BANNER_ROUND_WIN_A = 1;
export const BANNER_ROUND_WIN_B = 2;
export const BANNER_DRAW = 3;
export const BANNER_MATCH_POINT = 4;
export const BANNER_MATCH_END = 5;
export const BANNER_HALF_SWAP = 6;

export const ENT_ALIVE = 1;
export const ENT_CROUCH = 2;
export const ENT_ADS = 4;
export const ENT_REVEALED = 8;
export const ENT_RELOADING = 16;

export class Writer {
  buf: ArrayBuffer;
  view: DataView;
  pos = 0;
  bytes: Uint8Array;

  constructor(cap = 1024) {
    this.buf = new ArrayBuffer(cap);
    this.view = new DataView(this.buf);
    this.bytes = new Uint8Array(this.buf);
  }

  reset(): void {
    this.pos = 0;
  }

  ensure(n: number): void {
    if (this.pos + n <= this.buf.byteLength) return;
    let cap = this.buf.byteLength * 2;
    while (cap < this.pos + n) cap *= 2;
    const nb = new ArrayBuffer(cap);
    new Uint8Array(nb).set(this.bytes);
    this.buf = nb;
    this.view = new DataView(nb);
    this.bytes = new Uint8Array(nb);
  }

  u8(v: number): void { this.ensure(1); this.view.setUint8(this.pos, v); this.pos += 1; }
  u16(v: number): void { this.ensure(2); this.view.setUint16(this.pos, v, true); this.pos += 2; }
  u32(v: number): void { this.ensure(4); this.view.setUint32(this.pos, v, true); this.pos += 4; }
  i8(v: number): void { this.ensure(1); this.view.setInt8(this.pos, v); this.pos += 1; }
  i16(v: number): void { this.ensure(2); this.view.setInt16(this.pos, v, true); this.pos += 2; }

  str(s: string): void {
    const enc = textEncoder;
    const arr = enc.encode(s);
    this.u8(arr.length);
    this.ensure(arr.length);
    this.bytes.set(arr, this.pos);
    this.pos += arr.length;
  }

  finish(): Uint8Array {
    return this.bytes.subarray(0, this.pos);
  }
}

const textEncoder = new TextEncoder();
let textDecoder: TextDecoder;

export class Reader {
  view: DataView;
  pos = 0;
  len: number;

  constructor(data: ArrayBuffer | ArrayBufferView) {
    if (data instanceof ArrayBuffer) {
      this.view = new DataView(data);
      this.len = data.byteLength;
    } else {
      this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      this.len = data.byteLength;
    }
    if (!textDecoder) textDecoder = new TextDecoder();
  }

  u8(): number { const v = this.view.getUint8(this.pos); this.pos += 1; return v; }
  u16(): number { const v = this.view.getUint16(this.pos, true); this.pos += 2; return v; }
  u32(): number { const v = this.view.getUint32(this.pos, true); this.pos += 4; return v; }
  i8(): number { const v = this.view.getInt8(this.pos); this.pos += 1; return v; }
  i16(): number { const v = this.view.getInt16(this.pos, true); this.pos += 2; return v; }

  str(): string {
    const l = this.u8();
    const s = textDecoder.decode(new Uint8Array(this.view.buffer, this.view.byteOffset + this.pos, l));
    this.pos += l;
    return s;
  }

  remaining(): number {
    return this.len - this.pos;
  }
}
