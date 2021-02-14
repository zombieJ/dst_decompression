import { AnimReader } from "../src";
import { setDebugLevel } from "../src/util";
import * as fs from "fs-extra";
import * as path from "path";

// const ANIM_PATH = "farm_plant_tomato";
// const ANIM_PATH = "poop";
// const ANIM_PATH = "treasure_chest";
const ANIM_PATH = "cook_pot";

setDebugLevel(99);

describe("Anim", () => {
  it("to scml", async () => {
    const anim = new AnimReader(path.resolve(__dirname, ANIM_PATH, "anim.bin"));
    await anim.load();

    await fs.writeFile(
      path.resolve(__dirname, ANIM_PATH, "anim.json"),
      JSON.stringify(anim, null, 2),
      "utf8"
    );

    await fs.writeFile(
      path.resolve(__dirname, ANIM_PATH, "anim.xml"),
      await anim.scml(path.resolve(__dirname, ANIM_PATH, "build.bin")),
      "utf8"
    );
  });
});
