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

  readUint() {
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
    const len = this.readUint();
    const str = this.readChars(len);
    return str;
  }

  readByte(len: number) {
    const buffer = this.buffer.slice(this.pos, this.pos + len);
    this.pos += len;
    return buffer;
  }

  loop<T>(times: number, callback: (index: number) => T): T[] {
    const list: T[] = [];
    for (let i = 0; i < times; i += 1) {
      list.push(callback(i));
    }
    return list;
  }
}

export function buffer2number(
  buffer: Buffer,
  bitList: number[],
  maskList: number[]
) {
  let bits = "";
  for (let i = 0; i < buffer.length; i += 1) {
    bits += buffer[i].toString(2).padStart(8, "0");
  }
  console.log(bits, bits.length);

  let maskOffsetStart = 0;
  const maskOffsetList = maskList.map((maskLen) => {
    const current = maskOffsetStart;
    maskOffsetStart += maskLen;
    return current;
  });

  let start = 0;
  return bitList.map((len, index) => {
    const mini = bits.substr(start, len);
    const miniVal = parseInt(mini, 2);

    const maskLen = maskList[index];
    const maskOffset = maskOffsetList[index];
    const mask = ((1 << maskLen) - 1) << maskOffset;
    const maskedVal = (miniVal << maskOffset) & mask;
	const finalValue = (0 & ~mask) | maskedVal;
	const finalValue2 = (finalValue >> maskOffset) & ((1 << maskLen) - 1)

    console.log(index, "->", len, mini, miniVal);
    console.log(index, "=>", maskLen, maskOffset, mask, maskedVal);
    console.log(index, "~>", finalValue, finalValue2);

    throw new Error("br");

    start += len;

    return maskedVal;
  });
}

/*


543358463
20 62 fd ff
00100000011000101111110111111111

001000000110	00		10111	1110	11111	1111
4095			3		11		1		2		0
111111111111	11		1011	1		10		0


0010 00000 1100 01011 11 110111111111


0010000001100010111111011111 1111 & 1111			= 1111			0		0
000000100000011000101111110 11111 & 11111			= 11111			2		11
0000000000010000001100010111 1110 & 1111			= 1110			1		1
000000000000000100000011000 10111 & 11111			= 10111			11		1011
000000000000000000001000000110 00 & 11				= 00			3		11
00000000000000000000 001000000110 & 111111111111	= 001000000110	4095	111111111111



header |= 4095;
header <<= 2;
header |= File.Header.Flags;
header <<= 5;
header |= File.Header.NumMips;
header <<= 4;
header |= File.Header.TextureType;
header <<= 5;
header |= File.Header.PixelFormat;
header <<= 4;
header |= File.Header.Platform;

111111111111 11 01011 0001 00010 0000

ff fd 62 20

1111-1111 1111-1110 0110-0010 0010-0000
*/
