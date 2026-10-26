import { networkInterfaces } from 'node:os';
import { createAppServer } from './app.js';

const production = process.argv.includes('--production');
const port = Number(process.env.PORT ?? 3000);
const server = await createAppServer({ production, development: !production });
server.http.listen(port, '0.0.0.0', () => {
  console.log(`LAST LIGHT · ${production ? 'production' : 'development'} · http://localhost:${port}`);
  for (const addresses of Object.values(networkInterfaces())) for (const address of addresses ?? []) {
    if (address.family === 'IPv4' && !address.internal) console.log(`Same Wi-Fi: http://${address.address}:${port}`);
  }
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void server.close().then(() => process.exit(0)); });
