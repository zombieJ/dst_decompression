import * as fs from "fs-extra";
import * as path from "path";
import * as xml from "xml";
import * as chalk from "chalk";
import BuildReader from "./build";
import { decomposeMatrix, getAnimationName, Layers } from "./scmlUtil";
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
    // this.anims = this.anims.filter((anim) => anim.name === "anim");

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
      pivot_x_format: number;
      pivot_y_format: number;
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

          const pivot_x = 0.5 - x / width;
          const pivot_y = 0.5 + y / height;

          const file = {
            name: fileName,
            width,
            height,
            pivot_x,
            pivot_y,
            pivot_x_format: Number(pivot_x.toFixed(6)),
            pivot_y_format: Number(pivot_y.toFixed(6)),
          };

          // 填充一下
          fileMap[`${symbol.hash}-${frame}`] = file;

          return file;
        }),
      };
    });

    // =================================== 生成文件 ===================================
    const missingFiles: Record<string, Set<number>> = {};

    const entityName = this.hashNames[this.anims[0]?.bankHash];

    // 生成目录
    const folderXML = folders.map((folder, folderIndex) => {
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
                    pivot_x: file.pivot_x_format,
                    pivot_y: file.pivot_y_format,
                  },
                },
              ],
            };
          }),
        ],
      };
    });

    // 遍历生成实体
    const xmlEntity = {
      entity: [
        {
          _attr: { id: "0", name: entityName },
        },

        // spriter_data > entity > [LOOP] animation
        ...[...this.anims]
          .sort((a, b) => (a.name < b.name ? -1 : 1))
          .map((anim, animIndex) => {
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

            // 图层收集，我们需要遍历所有帧
            const layers = new Layers();
            mergedFrames.slice(0, 2).forEach(({ elements }, frameIndex) => {
              layers.startRecord();

              elements.forEach((element) => {
                layers.add(element, frameIndex);
              });

              layers.flushRecord();
            });

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
                            const { hash, buildFrame, z } = element;

                            const fileNameHash = `${hash}-${buildFrame}`;
                            let fileInfo = fileMap[fileNameHash];

                            if (!fileInfo) {
                              const externalFileName = this.hashNames[hash];
                              missingFiles[hash] =
                                missingFiles[hash] || new Set();
                              missingFiles[hash].add(buildFrame);
                              debug(
                                2,
                                chalk.cyan(
                                  `External resource: ${externalFileName} (${hash} - ${buildFrame})`
                                )
                              );

                              fileInfo = {
                                name: externalFileName,
                                width: 0,
                                height: 0,
                                pivot_x: 0,
                                pivot_y: 0,
                                pivot_x_format: 0,
                                pivot_y_format: 0,
                              };
                            }

                            return {
                              object_ref: [
                                {
                                  _attr: {
                                    // 看起来是和 timeline 对应的
                                    id: layers.getLayerIndex(z),
                                    name: this.hashNames[hash],

                                    // 坐标信息
                                    abs_x: 0,
                                    abs_y: 0,
                                    abs_pivot_x: fileInfo.pivot_x_format,
                                    abs_pivot_y: fileInfo.pivot_y_format,
                                    abs_angle: 0,
                                    abs_scale_x: 1,
                                    abs_scale_y: 1,
                                    abs_a: 1,
                                    timeline: layers.getLayerIndex(z),
                                    // key: animsymmeta.getKeyId(), 看起来没用，我们先不管了
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

                // spriter_data > entity > [LOOP] animation > [LOOP] timeline
                ...layers
                  .getList()
                  .map(({ hash, zIndex, elementFrames }, layerIndex) => {
                    let lastElementFrameAngle = 0;

                    return {
                      timeline: [
                        {
                          _attr: {
                            id: layerIndex,
                            name: this.hashNames[hash],
                            [`data-zIndex`]: zIndex,
                            [`data-hash`]: hash,
                          },
                        },

                        // spriter_data > entity > [LOOP] animation > [LOOP] timeline > [LOOP] key
                        ...elementFrames.map(({ frame, ...element }) => {
                          // 找到对应的文件
                          const foloderIndex = folders.findIndex(
                            (folder) =>
                              folder.name === this.hashNames[element.hash]
                          );

                          if (foloderIndex === -1) {
                            debug(
                              1,
                              `Not found foloder: ${
                                this.hashNames[element.hash]
                              }`
                            );
                          }

                          // 根据 element matrix 转回属性
                          const transform = decomposeMatrix({
                            a: element.m_a,
                            b: element.m_b,
                            c: element.m_c,
                            d: element.m_d,
                            e: element.m_tx,
                            f: element.m_ty,
                          });

                          const angle = (360 - transform.rotation) % 360;

                          // spin 是根据上一帧的 angle 计算的
                          let spin =
                            Math.abs(angle - lastElementFrameAngle) <= 180
                              ? 1
                              : -1;

                          if (angle < lastElementFrameAngle) {
                            spin = -spin;
                          }

                          lastElementFrameAngle = angle;

                          return {
                            key: [
                              {
                                _attr: {
                                  id: frame,
                                  time: Math.floor(frame * frameDuration),
                                  spin,
                                },
                              },
                              // spriter_data > entity > [LOOP] animation
                              // > [LOOP] timeline > [LOOP] key > object
                              {
                                object: [
                                  {
                                    _attr: {
                                      // folder="0" file="0"
                                      folder: foloderIndex,
                                      file: element.buildFrame,
                                      x: Number(
                                        transform.translateX.toFixed(2)
                                      ),
                                      y: -Number(
                                        transform.translateY.toFixed(2)
                                      ),
                                      scale_x: Number(
                                        transform.scaleX.toFixed(6)
                                      ),
                                      scale_y: Number(
                                        transform.scaleY.toFixed(6)
                                      ),
                                      angle: Number(angle.toFixed(3)),
                                    },
                                  },
                                ],
                              },
                            ],
                          };
                        }),
                      ],
                    };
                  }),
              ],
            };
          }),
      ],
    }

    const xmlData = {
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
        ...folderXML,

        // spriter_data > entity
        xmlEntity,
      ],
    };

    let xmlStr: string = xml(xmlData, true);

    // 标注信息
    xmlStr = `<?xml version="1.0" encoding="UTF-8"?>\n${xmlStr}`;

    // 清理闭标签
    xmlStr = xmlStr.replace(/>[\s\r\n]*<\/(file|object_ref|object)>/g, " />");

    // 格式化 tab
    xmlStr = xmlStr.replace(/    /g, "\t");

    // 打印一下报告
    debug(
      1,
      [
        chalk.cyan("Missing Symbols:"),
        ...Object.keys(missingFiles).map((hash) => {
          const externalFileName = this.hashNames[hash];
          return `${externalFileName} (${hash}): ${Array.from(
            missingFiles[hash]
          )
            .sort((a, b) => a - b)
            .join(",")}`;
        }),
      ].join("\n")
    );

    return xmlStr;
  }
}

export default AnimReader;
