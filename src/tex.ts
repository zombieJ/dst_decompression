import * as fs from "fs-extra";
import * as path from "path";
import { parseDXT5 } from "./dxt";
import { BufferData, debug } from "./util";

export const Platform = {
  12: "PC",
  11: "XBOX360",
  10: "PS3",
  0: "Unknown",
};

export const PixelFormat = {
  0: "DXT1",
  1: "DXT3",
  2: "DXT5",
  4: "ARGB",
  7: "Unknown",
};

export const TextureType = {
  0: "OneD",
  1: "TwoD",
  2: "ThreeD",
  3: "Cubemap",
};

class TexReader {
  filePath: string;

  platform: number;
  pixelFormat: number;
  textureType: number;
  numMips: number;
  flags: number;
  imgs: {
    width: number;
    height: number;
    pitch: number;
    dataSize: number;
    buffer: Buffer;
  }[];

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

    // Status
    const status = data.readBitInt32([4, 5, 4, 5, 2, 12]);
    [
      this.platform,
      this.pixelFormat,
      this.textureType,
      this.numMips,
      this.flags,
    ] = status;

    debug(0, status);
    debug(0, Platform[this.platform]);
    debug(0, PixelFormat[this.pixelFormat]);
    debug(0, TextureType[this.textureType]);

    // imgs
    this.imgs = data.loop(this.numMips, () => {
      const width = data.readUint16();
      const height = data.readUint16();
      const pitch = data.readUint16();
      const dataSize = data.readUint32();

      return {
        width,
        height,
        pitch,
        dataSize,
        buffer: null,
      };
    });

    data.loop(this.numMips, (index) => {
      const img = this.imgs[index];
      img.buffer = data.readBuffer(img.dataSize);
    });

    return this;
  }

  parseImg(imgIndex: number = 0) {
    const img = this.imgs[imgIndex];
    debug(1, 'Image Info:', img);
    const jimp = parseDXT5(img.buffer, img.width, img.height);
    return jimp;
  }

  saveImg(outputPath: string, imgIndex?: number) {
    const jimp = this.parseImg(imgIndex);

    if (imgIndex === undefined) {
      const img = this.imgs[0];
      jimp.resize(img.width / 2, img.height / 2);
    }

    jimp.write(outputPath);
  }
}

export default TexReader;
