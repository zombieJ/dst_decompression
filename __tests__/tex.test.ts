import { TexReader } from '../src';
import { setDebugLevel } from '../src/util';
import * as path from 'path';

// const ANIM_PATH = "farm_plant_tomato";
const ANIM_PATH = "poop";

describe('Tex', () => {
	beforeEach(() => {
		setDebugLevel(1);
	});

	it('get path', async () => {
		const tex = new TexReader(path.resolve(__dirname, ANIM_PATH, "atlas-0.tex"));
		await tex.load();

		await tex.saveImg(path.resolve(__dirname, ANIM_PATH, "atlas-0.png"));
	});
});