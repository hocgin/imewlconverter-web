import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanBuildOutputDir, writeAssets, writeRootConfig, writeWorkerConfig, readBuildOutput } from '@cloudflare/build-output-utils';
import config from '../cloudflare.config.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
await cleanBuildOutputDir(root);
const { worker, ...settings } = config;
await writeRootConfig(root, settings, { mode: 'production', isPreview: false });
await writeWorkerConfig({ root, config: worker });
await writeAssets({ root, sourceDirectory: resolve(root, 'dist') });
await readBuildOutput(root);
console.log('Cloudflare assets-only deployment prepared.');
