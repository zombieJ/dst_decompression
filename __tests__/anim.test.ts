import { AnimReader } from "../src";
import * as fs from "fs-extra";
import * as path from "path";

// const ANIM_PATH = "farm_plant_tomato";
const ANIM_PATH = "poop";

describe("Anim", () => {
  it("get path", async () => {
    const anim = new AnimReader(
      path.resolve(__dirname, ANIM_PATH, "anim.bin")
    );
    await anim.load();

    await fs.writeFile(
      path.resolve(__dirname, ANIM_PATH, "anim.json"),
      JSON.stringify(anim, null, 2),
      "utf8"
    );

    await fs.writeFile(
      path.resolve(__dirname, ANIM_PATH, "anim.xml"),
      anim.scml(),
      "utf8"
    );
  });
});
