import path from 'node:path';
import { onShutdown } from '@netlify/server';
import { createApp, initDatabase } from '../../server/index.js';
import { closeDb } from '../../server/db/connection.js';

export const config = {
  includedFiles: ['../../dist/index.html', '../../server/migrations/**'],
};

const distDir = path.resolve(import.meta.dirname, '../../dist');
const indexHtmlPath = path.resolve(import.meta.dirname, '../../dist/index.html');

await initDatabase();

const app = createApp({ distDir, indexHtmlPath });
const port = Number(process.env.PORT) || 3000;

const server = await new Promise((resolve) => {
  const s = app.listen(port, () => resolve(s));
});

onShutdown(async ({ drained }) => {
  server.close();
  await drained;
  closeDb();
});
