import * as fs from "fs-extra";
import * as path from "path";
import { BufferData, debug } from "./util";
import TexReader from "./tex";
import { RGBA } from "./dxt";

class AnimReader {
  filePath: string;

  version: number;
  elementCount: number;
  frameCount: number;
  eventCount: number;
  animCount: number;
  anims: {}[];
  hashNames: Record<string, string>;

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
  }

  async load() {
    const buffer = await fs.readFile(this.filePath);
    const data = new BufferData(buffer);

    // BILD
    if (data.readChars(4) !== "ANIM") {
      throw new Error("Not a anim.bin file");
    }

    // Version: 3 or 4
    this.version = data.readUint32();

    this.elementCount = data.readUint32();
    this.frameCount = data.readUint32();
    this.eventCount = data.readUint32();
    this.animCount = data.readUint32();

    this.anims = data.loop(this.animCount, () => {
      const anim = {
        name: data.readStr(),
        facingBtye: data.readByte(),
        bankHash: data.readUint32(),
        frameRate: data.readFloat(),
        frameCount: data.readUint32(),
      };

      // 遍历帧
      const frames = data.loop(anim.frameCount, () => {
        const frame = {
          x: data.readFloat(),
          y: data.readFloat(),
          w: data.readFloat(),
          h: data.readFloat(),
          eventCount: data.readUint32(),
        };

        // 遍历事件
        const eventHashes = data.loop(frame.eventCount, () =>
          data.readUint32()
        );

        const elementCount = data.readUint32();
        const elements = data.loop(elementCount, () => ({
          hash: data.readUint32(),
          buildFrame: data.readUint32(),
          layerNameHash: data.readUint32(),
          m_a: data.readFloat(),
          m_b: data.readFloat(),
          m_c: data.readFloat(),
          m_d: data.readFloat(),
          m_tx: data.readFloat(),
          m_tz: data.readFloat(),
          z: data.readFloat(),
        }));

        return { ...frame, eventHashes, elementCount, elements };
      });

      return { ...anim, frames };
    });

    // Hash Table
    const hashTableSize = data.readUint32();
    const hashTable = data.loop(hashTableSize, () => ({
      hashValue: data.readUint32(),
      hashName: data.readStr(),
    }));

    this.hashNames = {};
    hashTable.forEach(({ hashValue, hashName }) => {
      this.hashNames[hashValue] = hashName;
    });
  }
}

export default AnimReader;
