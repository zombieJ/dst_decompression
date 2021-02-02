import * as fs from "fs-extra";
import * as path from "path";
import { BufferData } from "./util";

class BuildReader {
  filePath: string;

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
    const version = data.readUint();

    // Symbols
    const symbolCount = data.readUint();

    // Frames
    const frameCount = data.readUint();

    // Build Name
    const buildName = data.readStr();

    // Atlases
    const atlasCount = data.readUint();

    // Atlases names
    const atlasNames = data.loop(atlasCount, () => data.readStr());

    // Symbols
    const symbols = data.loop(symbolCount, () => {
      const hash = data.readUint();
      const frameCount = data.readUint();

      const symbol = {
        hash,
        frameCount,
        frames: data.loop(frameCount, () => ({
          frame: data.readUint(),
          duration: data.readUint(),
          x: data.readFloat(),
          y: data.readFloat(),
          w: data.readFloat(),
          h: data.readFloat(),
          alphaIdx: data.readUint(),
          alphaCount: data.readUint(),
        })),
      };

      return symbol;
	});
	
    // Alpha Verts???
    const alphaVerts = data.readUint();

    // Triangles???
    const triangles = data.loop(symbolCount, (symbolIndex) => {
	const symbol = symbols[symbolIndex];
	const symbolFrameCount = symbol.frameCount;

      return data.loop(symbolFrameCount, (frameIndex) => {
		const frameAlphaCount = symbol.frames[frameIndex].alphaCount;

        return data.loop(frameAlphaCount / 3, () => {
          return data.loop(3, () => ({
            x: data.readFloat(),
            y: data.readFloat(),
            z: data.readFloat(),
            u: data.readFloat(),
            v: data.readFloat(),
            w: data.readFloat(),
          }));
        });
      });
	});
	
	// Hash table size
	const hashTableSize = data.readUint();
	console.log('S:', hashTableSize);

	const hashTable = data.loop(hashTableSize, () => {
		const hashValue = data.readUint();
		const hashName = data.readStr();

		return {
			hashValue,
			hashName,
		};
	});

	console.log('=>', hashTable);

    // console.log(">>>", atlasCount, atlasNames, symbolCount);
    // console.log(JSON.stringify(symbols, null, 2));
    
    // console.log(JSON.stringify(triangles, null, 2));
  }
}

export default BuildReader;
