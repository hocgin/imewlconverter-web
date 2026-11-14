import { defineConfig } from 'cf/config';

export default defineConfig({
  accountId: 'b25e840a8b6b33b671e7f3032ac190d8',
  worker: {
    name: 'imewlconverter-web',
    compatibilityDate: '2026-11-14',
    domains: ['dict.aipan.app'],
    workersDev: true,
    assets: { notFoundHandling: 'none' },
  },
});
