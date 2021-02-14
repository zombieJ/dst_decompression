import * as fs from "fs-extra";
import * as path from "path";
import * as xml from "xml";
import * as chalk from "chalk";
import BuildReader from "./build";
import { getAnimationName } from "./scmlUtil";
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

  async scml(buildPath: string) {
    // =============================== 需要加载贴图信息 ===============================
    const build = new BuildReader(buildPath);
    await build.load();

    // 贴图文件映射
    interface FileInfo {
      name: string;
      width: number;
      height: number;
      pivot_x: number;
      pivot_y: number;
    }

    const fileMap: Record<string, FileInfo> = {};

    // 读取文件信息
    const folders = build.symbols.map((symbol) => {
      // 文件夹
      const folderName = build.hashNames[symbol.hash];

      return {
        name: folderName,
        files: symbol.frames.map(({ frame, w, h, x, y }) => {
          const fileName = `${folderName}-${frame}.png`;

          const width = Math.ceil(w);
          const height = Math.ceil(h);

          const file = {
            name: fileName,
            width,
            height,
            pivot_x: 0.5 - x / width,
            pivot_y: 0.5 + y / height,
          };

          // 填充一下
          fileMap[`${symbol.hash}-${frame}`] = file;

          return file;
        }),
      };
    });

    let xmlStr: string = xml(
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

          // spriter_data > [LOOP] folder
          ...folders.map((folder, folderIndex) => {
            return {
              folder: [
                {
                  _attr: {
                    id: folderIndex,
                    name: folder.name,
                  },
                },

                // spriter_data > [LOOP] folder > [LOOP] file
                ...folder.files.map((file, fileIndex) => {
                  return {
                    file: [
                      {
                        _attr: {
                          id: fileIndex,
                          name: `${folder.name}/${file.name}`,
                          width: file.width,
                          height: file.height,
                          pivot_x: file.pivot_x.toFixed(6),
                          pivot_y: file.pivot_y.toFixed(6),
                        },
                      },
                    ],
                  };
                }),
              ],
            };
          }),

          // spriter_data > entity
          {
            entity: [
              {
                _attr: { id: "0", name: "poop" },
              },

              // spriter_data > entity > [LOOP] animation
              ...[...this.anims].reverse().map((anim, animIndex) => {
                const {
                  frameRate,
                  frameCount,
                  frames,
                  name,
                  facingBtye,
                } = anim;
                const frameDuration = 1000 / frameRate;
                const frameLength = frameCount * frameDuration;

                // 填充最后一帧
                const mergedFrames = [...frames];
                if (frames.length) {
                  mergedFrames.push(frames[frames.length - 1]);
                }

                // 图层
                const layers: number[] = [];

                const animationName = getAnimationName(name, facingBtye);

                return {
                  animation: [
                    {
                      _attr: {
                        id: animIndex,
                        // 名字需要根据 facingBtye 自动转换
                        name: animationName,
                        length: Math.floor(frameLength),
                      },
                    },

                    // spriter_data > entity > [LOOP] animation > mainline
                    {
                      mainline: [
                        ...mergedFrames.map((frame, frameIndex) => {
                          const { elements, elementCount } = frame;

                          // spriter_data > entity > [LOOP] animation > mainline > key
                          return {
                            key: [
                              {
                                _attr: {
                                  id: frameIndex,
                                  time: Math.floor(frameIndex * frameDuration),
                                },
                              },
                              // spriter_data > entity > [LOOP] animation > mainline > key > [LOOP] object_ref
                              ...elements.map((element, elementIndex) => {
                                const {
                                  hash,
                                  buildFrame,
                                  layerNameHash,
                                } = element;

                                // 填充图层
                                let layerIndex = layers.indexOf(layerNameHash);
                                if (layerIndex === -1) {
                                  layerIndex = layers.length;
                                  layers.push(layerNameHash);
                                }

                                const fileNameHash = `${hash}-${buildFrame}`;
                                let fileInfo = fileMap[fileNameHash];

                                if (!fileInfo) {
                                  const externalFileName = this.hashNames[hash];
                                  debug(
                                    1,
                                    chalk.cyan(
                                      `External resource: ${externalFileName} (${hash})`
                                    )
                                  );

                                  fileInfo = {
                                    name: externalFileName,
                                    width: 0,
                                    height: 0,
                                    pivot_x: 0,
                                    pivot_y: 0,
                                  };
                                }

                                return {
                                  object_ref: [
                                    {
                                      _attr: {
                                        id: 0, // TODO: 这个 id 是啥意思？
                                        name: this.hashNames[hash],

                                        // 坐标信息
                                        abs_x: 0,
                                        abs_y: 0,
                                        abs_pivot_x: fileInfo.pivot_x.toFixed(
                                          6
                                        ),
                                        abs_pivot_y: fileInfo.pivot_y.toFixed(
                                          6
                                        ),
                                        abs_angle: 0,
                                        abs_scale_x: 1,
                                        abs_scale_y: 1,
                                        abs_a: 1,
                                        timeline: layerIndex,
                                        // key: animsymmeta.getKeyId(),
                                        z_index: elementCount - elementIndex,
                                      },
                                    },
                                  ],
                                };
                              }),
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

    // 标注信息
    xmlStr = `<?xml version="1.0" encoding="UTF-8"?>\n${xmlStr}`;

    // 清理闭标签
    xmlStr = xmlStr.replace(/>[\s\r\n]*<\/file>/g, " />");
    xmlStr = xmlStr.replace(/>[\s\r\n]*<\/object_ref>/g, " />");

    return xmlStr;
  }
}

export default AnimReader;
