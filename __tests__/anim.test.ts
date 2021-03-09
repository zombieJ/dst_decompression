import * as jimp from "jimp";
import { AnimReader } from "../src";
import { setDebugLevel } from "../src/util";
import * as fs from "fs-extra";
import * as path from "path";

const ANIM_PATH = "farm_plant_tomato";
// const ANIM_PATH = "poop";
// const ANIM_PATH = "treasure_chest";
// const ANIM_PATH = "cook_pot";

setDebugLevel(1);

describe("Anim", () => {
  it("to scml", async () => {
    const anim = new AnimReader(path.resolve(__dirname, ANIM_PATH, "anim.bin"));
    await anim.load();

    await fs.writeFile(
      path.resolve(__dirname, ANIM_PATH, "anim.json"),
      JSON.stringify(anim, null, 2),
      "utf8"
    );

    // 读取 scml 内容
    const scmlInfo = await anim.scml(
      path.resolve(__dirname, ANIM_PATH, "build.bin")
    );

    // 保存 scml
    await fs.writeFile(
      path.resolve(__dirname, ANIM_PATH, "anim.xml"),
      scmlInfo.content,
      "utf8"
    );

    // 保存临时图片
    const placeholderPath = path.resolve(
      __dirname,
      ANIM_PATH,
      "img_placeholder"
    );
    await fs.remove(placeholderPath);

    for (let i = 0; i < scmlInfo.missingFiles.length; i += 1) {
      const filePath = scmlInfo.missingFiles[i];

      const mergedFilePath = path.resolve(placeholderPath, filePath);
      await fs.ensureDir(path.dirname(mergedFilePath));

      const img = new jimp(1, 1);
      img.setPixelColor(parseInt("FF000000", 16), 0, 0);
      img.write(mergedFilePath);
    }
  });
});
