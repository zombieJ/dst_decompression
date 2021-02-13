import * as fs from "fs-extra";
import * as path from "path";
import * as xml from "xml";
import { BufferData, debug } from "./util";

class AnimReader {
  filePath: string;

  version: number;
  elementCount: number;
  frameCount: number;
  eventCount: number;
  animCount: number;
  anims: {
    name: string;
    facingBtye: number;
    bankHash: number;
    frameRate: number;
    frameCount: number;
    frames: {
      x: number;
      y: number;
      w: number;
      h: number;
      eventCount: number;
      eventHashes: number[];
      elementCount: number;
      elements: {
        hash: number;
        buildFrame: number;
        layerNameHash: number;
        m_a: number;
        m_b: number;
        m_c: number;
        m_d: number;
        m_tx: number;
        m_ty: number;
        z: number;
      }[];
    }[];
  }[];
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
          m_ty: data.readFloat(),
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

  scml() {
    const xmlStr = xml(
      {
        // spriter_data
        spriter_data: [
          {
            _attr: {
              scml_version: "1.0",
              generator: "BrashMonkey Spriter",
              generator_version: "b5",
            },
          },

          // spriter_data > folder
          {
            folder: [
              {
                _attr: {},
              },
            ],
          },

          // spriter_data > entity
          {
            entity: [
              {
                _attr: { id: "0", name: "poop" },
              },

              // spriter_data > entity > [LOOP] animation
              ...[...this.anims].reverse().map((anim, animIndex) => {
                const { frameRate, frameCount, frames, bankHash } = anim;
                const frameDuration = 1000 / frameRate;
                const frameLength = frameCount * frameDuration;

                // 填充最后一帧
                const mergedFrames = [...frames];
                if (frames.length) {
                  mergedFrames.push(frames[frames.length - 1]);
                }

                return {
                  animation: [
                    {
                      _attr: {
                        id: animIndex,
                        name: "dump_90s",
                        length: Math.floor(frameLength),
                      },
                    },

                    // spriter_data > entity > [LOOP] animation > mainline
                    {
                      mainline: [
                        ...mergedFrames.map((frame, frameIndex) => {
                          // spriter_data > entity > [LOOP] animation > mainline > key
                          return {
                            key: [
                              {
                                _attr: {
                                  id: frameIndex,
                                  time: Math.floor(frameIndex * frameDuration),
                                },
                              },
                              // spriter_data > entity > [LOOP] animation > mainline > key > object_ref
                              {
                                object_ref: [
                                  {
                                    _attr: {
                                      id: 0,
                                      name: this.hashNames[bankHash],
                                    },
                                  },
                                ],
                              },
                            ],
                          };
                        }),
                      ],
                    },
                  ],
                };
              }),
            ],
          },
        ],
      },
      true
    );
    return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlStr}`;
  }
}

export default AnimReader;
