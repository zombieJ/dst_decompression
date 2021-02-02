import { BuildReader } from '../src';
import * as path from 'path';

describe('Build', () => {
	it('get path', async () => {
		const build = new BuildReader(path.resolve(__dirname, "farm_plant_tomato", "build.bin"));
		await build.load();
	});
});