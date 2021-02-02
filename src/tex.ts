import * as fs from "fs-extra";
import * as path from "path";
import { BufferData, buffer2number } from "./util";

class TexReader {
  filePath: string;

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
  }

  async load() {
    const buffer = await fs.readFile(this.filePath);
    const data = new BufferData(buffer);

    // KTEX
    if (data.readChars(4) !== "KTEX") {
      throw new Error("Not a .tex file");
    }

    const b = data.readByte(4);
    const aaa = buffer2number(b, [3, 3, 3, 4, 1, 18], [4, 5, 4, 5, 2, 12]);
    console.log(b, aaa);
  }
}

export default TexReader;
