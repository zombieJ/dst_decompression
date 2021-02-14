import * as fs from "fs-extra";
import * as path from "path";
import { BufferData, debug } from "./util";
import TexReader from "./tex";
import { RGBA } from "./dxt";

const AtlasMarkedColor = new RGBA(0.3 * 255, 0.3 * 255, 0.3 * 255);

interface XYZ {
  x: number;
  y: number;
  z: number;
}

interface UVW {
  u: number;
  v: number;
  w: number;
}

type Triangle = XYZ & UVW;

interface Symbol {
  hash: number;
  frameCount: number;
  frames: {
    frame: number;
    duration: number;
    x: number;
    y: number;
    w: number;
    h: number;
    alphaIdx: number;
    alphaCount: number;
    atlasDepth: number;
    boundingBox: { left: number; right: number; top: number; bottom: number };
    triangles: { group: Triangle[] }[];
  }[];
}

class BuildReader {
  filePath: string;

  version: number;
  symbolCount: number;
  frameCount: number;
  buildName: string;
  atlasCount: number;
  atlases: { name: string; mask: number }[];
  hashTableSize: number;
  hashNames: Record<string, string>;
  symbols: Symbol[];

  texes: TexReader[];

  getSnapshot() {
    return {
      version: this.version,
      filePath: this.filePath,
      atlases: this.atlases.map((a) => a.name),
      hashNames: this.hashNames,
      symbols: this.symbols,
    };
  }

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
  }

  async load() {
    const buffer = await fs.readFile(this.filePath);
    const data = new BufferData(buffer);

    // BILD
    if (data.readChars(4) !== "BILD") {
      throw new Error("Not a build.bin file");
    }

    // Version: 5 or 6
    this.version = data.readUint32();

    // Symbols - 一个 symbol 对应一个文件夹
    this.symbolCount = data.readUint32();

    // Frames
    this.frameCount = data.readUint32();

    // Build Name
    this.buildName = data.readStr();

    // Atlases
    this.atlasCount = data.readUint32();

    // Atlases names
    const atlasNames = data.loop(this.atlasCount, () => data.readStr());
    this.atlases = atlasNames.map((atlasName) => {
      return {
        name: atlasName,
        mask: null,
      };
    });

    // Symbols
    const symbols = data.loop(this.symbolCount, () => {
      const hash = data.readUint32();
      const frameCount = data.readUint32();

      const symbol = {
        hash,
        frameCount,
        frames: data.loop(frameCount, () => ({
          frame: data.readUint32(),
          duration: data.readUint32(),
          x: data.readFloat(),
          y: data.readFloat(),
          w: data.readFloat(),
          h: data.readFloat(),
          alphaIdx: data.readUint32(),
          // 必须是 6 的倍数
          alphaCount: data.readUint32(),
        })),
      };

      return symbol;
    });

    // Alpha Verts???
    const alphaVerts = data.readUint32();

    // Triangles??? 遍历 Symbol
    const triangles = data.loop(this.symbolCount, (symbolIndex) => {
      const symbol = symbols[symbolIndex];
      const symbolFrameCount = symbol.frameCount;

      // 遍历帧
      const symbolFrames = data.loop(symbolFrameCount, (frameIndex) => {
        const frameAlphaCount = symbol.frames[frameIndex].alphaCount;
        const trianglesCount = frameAlphaCount / 3;

        // 贴图深度，如果大就会需要多个贴图文件（似乎最多 2 个贴图）
        let uvwdepth = null;

        let boundingBox: {
          left: number;
          right: number;
          top: number;
          bottom: number;
        } = null;

        // 遍历每个三角形？啥意思
        const frameTriangles = data.loop(trianglesCount, () => {
          // 又把3 乘回去，为啥？
          const group = data.loop(3, () => {
            const cell = {
              x: data.readFloat(),
              y: data.readFloat(),
              z: data.readFloat(),
              u: data.readFloat(),
              v: data.readFloat(),
              w: data.readFloat(),
            };

            if (uvwdepth === null) {
              uvwdepth = cell.w;
            } else if (Math.abs(uvwdepth - cell.w) >= 0.5) {
              throw new Error("Inconsistent uvw depth in build symbol frame.");
            }

            // 根据 uv 设置边界
            if (!boundingBox) {
              boundingBox = {
                left: cell.u,
                right: cell.u,
                top: cell.v,
                bottom: cell.v,
              };
            }

            boundingBox.left = Math.min(boundingBox.left, cell.u);
            boundingBox.right = Math.max(boundingBox.right, cell.u);
            boundingBox.top = Math.min(boundingBox.top, cell.v);
            boundingBox.bottom = Math.max(boundingBox.bottom, cell.v);

            return cell;
          });

          return { group };
        });

        return {
          triangles: frameTriangles,
          boundingBox,
          atlasDepth: uvwdepth === null ? 0 : Math.floor(uvwdepth + 0.5),
        };
      });

      return {
        frames: symbolFrames,
      };
    });

    const mergedSymbols = symbols.map((symbol, symbolIndex) => {
      const { frames } = symbol;
      const symbolTriangle = triangles[symbolIndex];

      return {
        ...symbol,
        frames: frames.map((frame, frameIndex) => {
          const triangleFrame = symbolTriangle.frames[frameIndex];

          return {
            ...frame,
            triangles: triangleFrame.triangles,
            boundingBox: triangleFrame.boundingBox,
            atlasDepth: triangleFrame.atlasDepth,
          };
        }),
      };
    });

    this.symbols = mergedSymbols;

    // Hash table size
    this.hashTableSize = data.readUint32();

    const hashTable = data.loop(this.hashTableSize, () => {
      const hashValue = data.readUint32();
      const hashName = data.readStr();

      return {
        hashValue,
        hashName,
      };
    });

    this.hashNames = {};
    hashTable.forEach(({ hashValue, hashName }) => {
      this.hashNames[hashValue] = hashName;
    });

    return this;
  }

  async loadTexes() {
    const promiseList = this.atlases.map(({ name }) => {
      const dirName = path.dirname(this.filePath);
      const texPath = path.resolve(dirName, name);
      const tex = new TexReader(texPath);
      return tex.load();
    });

    this.texes = await Promise.all(promiseList);
  }

  // 获取采样器偏离，不知道啥意思。但是可以据此拿出贴图数量
  samplerOffset: number = null;

  getSamplerOffset() {
    if (this.samplerOffset === null) {
      let maxDepth: number = null;

      this.symbols.forEach(({ frames }) => {
        frames.forEach(({ atlasDepth }) => {
          if (this.samplerOffset == null || atlasDepth < this.samplerOffset) {
            this.samplerOffset = atlasDepth;
          }
          if (maxDepth == null || atlasDepth > maxDepth) {
            maxDepth = atlasDepth;
          }
        });
      });

      // 如果需要的贴图数比提供的少就报错
      if (maxDepth - this.samplerOffset + 1 > this.atlases.length) {
        throw new Error(
          "Build has symbol frames requesting atlases the build does not possess."
        );
      }
    }

    return this.samplerOffset;
  }

  // 裁剪对应的图片
  async getImage(index = 0) {
    if (!this.texes) {
      await this.loadTexes();
    }

    const firstFrame = this.symbols[0].frames[0];
    const atlasIdx = firstFrame.atlasDepth - this.getSamplerOffset();

    const atlas = this.atlases[atlasIdx];
    const tex = this.texes[atlasIdx];
    console.log(atlas);

    // Geometry
    

    // Mask
    const drawableTrigs = [];
    const xs = new Set<number>();
    const ys = new Set<number>();

    firstFrame.triangles.forEach(({ group }) => {
      const { boundingBox } = firstFrame;
      const coords: { x: number; y: number }[] = [];

      const texLargestImg = tex.imgs[0];

      // a
      coords.push({
        x: (group[0].u - boundingBox.left) * texLargestImg.width,
        y: (group[0].v - boundingBox.top) * texLargestImg.height,
      });

      // b
      coords.push({
        x: (group[1].u - boundingBox.left) * texLargestImg.width,
        y: (group[1].v - boundingBox.top) * texLargestImg.height,
      });

      // c
      coords.push({
        x: (group[2].u - boundingBox.left) * texLargestImg.width,
        y: (group[2].v - boundingBox.top) * texLargestImg.height,
      });

      drawableTrigs.push(coords);

      coords.forEach(({ x, y }) => {
        xs.add(x);
        ys.add(y);
      });
    });

    console.log(drawableTrigs.length);
    console.log(
      Array.from(xs).sort((a, b) => a - b),
      Array.from(ys).sort((a, b) => a - b)
    );
  }
}

export default BuildReader;
