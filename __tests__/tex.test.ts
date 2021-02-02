import { TexReader } from '../src';
import * as path from 'path';

describe('Tex', () => {
	it('get path', async () => {
		const tex = new TexReader(path.resolve(__dirname, "farm_plant_tomato", "atlas-0.tex"));
		await tex.load();
	});
});