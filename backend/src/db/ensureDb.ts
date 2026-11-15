import net from 'net';
import path from 'path';

export async function isPortOpen(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

export async function ensurePostgres() {
  const isOpen = await isPortOpen(5432);
  if (isOpen) {
    console.log('🐘 PostgreSQL is already running on port 5432');
    return;
  }
  try {
    const EmbeddedPostgres = require('embedded-postgres').default;
    const dbDir = path.resolve(__dirname, '../../data/db');
    const ep = new EmbeddedPostgres({
      password: 'postgres',
      port: 5432,
      databaseDir: dbDir,
      persistent: true
    });
    await ep.initialise();
    await ep.start();
    try {
      await ep.createDatabase('pos_db');
    } catch {}
    console.log('🐘 Embedded PostgreSQL started automatically on port 5432');
  } catch (err: any) {
    console.warn('⚠️ Could not start embedded PostgreSQL:', err.message);
  }
}
