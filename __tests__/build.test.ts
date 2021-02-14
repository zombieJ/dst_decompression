import { BuildReader } from "../src";
import * as fs from "fs-extra";
import * as path from "path";

// const ANIM_PATH = "farm_plant_tomato";
// const ANIM_PATH = "poop";
const ANIM_PATH = "treasure_chest";

describe("Build", () => {
  it("get path", async () => {
    const build = new BuildReader(
      path.resolve(__dirname, ANIM_PATH, "build.bin")
    );
    await build.load();

    await fs.writeFile(
      path.resolve(__dirname, ANIM_PATH, "build.json"),
      JSON.stringify(build.getSnapshot(), null, 2),
      "utf8"
    );
  });

  it("get image", async () => {
    const build = new BuildReader(
      path.resolve(__dirname, ANIM_PATH, "build.bin")
    );
	await build.load();
	
	await build.getImage();
  });
});
