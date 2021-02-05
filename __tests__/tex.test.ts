import { TexReader } from '../src';
import { setDebugLevel } from '../src/util';
import * as path from 'path';

describe('Tex', () => {
	beforeEach(() => {
		setDebugLevel(1);
	});

	it('get path', async () => {
		const tex = new TexReader(path.resolve(__dirname, "farm_plant_tomato", "atlas-0.tex"));
		await tex.load();

		await tex.saveImg(path.resolve(__dirname, "farm_plant_tomato", "atlas-0.png"), 1);
	});
});