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



20 62 fd ff
00100000011000101111110111111111
00000000000000000000000000001111

  0111(7)
& 1111
> 0111 (maskedval)

data = (data & ~mask) | maskedval;
0 & 1000 = 0000 | 0001 = 1



bits					len		offset			val		val bits
111						 4		 0		>>>		0		0
111						 5		 4		>>>		2		10
111						 4		 9		>>>		1		1
1110					 5		13		>>>		11		1011
1						 2		18		>>>		3		11
001000000110001011		12		20		>>>		4095	111111111111

543358463


*/
