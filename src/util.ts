export class BufferData {
  pos = 0;
  buffer: Buffer;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
  }

  readChar() {
    const byte = this.buffer[this.pos];
    this.pos += 1;
    return String.fromCharCode(byte);
  }

  readChars(len: number) {
    let str = "";
    for (let i = 0; i < len; i += 1) {
      str += this.readChar();
    }
    return str;
  }

  readUint16() {
    const int = this.buffer.readUInt16LE(this.pos);
    this.pos += 2;
    return int;
  }

  readUint32() {
    const int = this.buffer.readUInt32LE(this.pos);
    this.pos += 4;
    return int;
  }

  readFloat() {
    const float = this.buffer.readFloatLE(this.pos);
    this.pos += 4;
    return float;
  }

  readStr() {
    const len = this.readUint32();
    const str = this.readChars(len);
    return str;
  }

  readByte() {
    const byte = this.buffer[this.pos];
    this.pos += 1;
    return byte;
  }

  readBuffer(len: number) {
    const buffer = this.buffer.slice(this.pos, this.pos + len);
    this.pos += len;
    return buffer;
  }

  readBitInt32(bitsList: number[]) {
    let unit = this.readUint32();

    return bitsList.map((bits, index) => {
      const mask = (1 << bits) - 1;
      const value = unit & mask;

      unit >>= bits;

      return value;
    });
  }

  loop<T>(times: number, callback: (index: number) => T): T[] {
    const list: T[] = [];
    for (let i = 0; i < times; i += 1) {
      list.push(callback(i));
    }
    return list;
  }

  reachEnd() {
    return this.pos === this.buffer.length;
  }
}

// ========================== DEBUG ==========================
let debugLevel = 0;

export function setDebugLevel(lvl: number) {
  debugLevel = lvl;
}

export function debug(level: number, ...content: any) {
  if (level <= debugLevel) {
    console.log(...content);
  }
}