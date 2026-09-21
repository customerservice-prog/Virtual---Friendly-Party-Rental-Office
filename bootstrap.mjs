import * as fs from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Railway mounts volumes as root. Repair only the data directory, then drop
// privileges BEFORE opening SQLite or accepting any network traffic.
export function prepareDataDirectory(env = process.env, io = fs, identity = process) {
  const dir = resolve(env.DATA_DIR || '/app/data');
  const mount = env.RAILWAY_VOLUME_MOUNT_PATH;
  if (env.RAILWAY_ENVIRONMENT_ID && (!mount || resolve(mount) !== dir)) {
    throw new Error('A persistent Railway volume must be mounted exactly at DATA_DIR.');
  }
  const root = identity.getuid?.() === 0;
  if (root && dir !== '/app/data' && (!mount || resolve(mount) !== dir || dir === '/')) {
    throw new Error('Refusing privileged preparation outside the configured data mount.');
  }
  io.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const info = io.lstatSync(dir);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('DATA_DIR must be a real directory, not a symlink.');
  if (root) {
    io.chownSync(dir, 1000, 1000);
    io.chmodSync(dir, 0o700);
    identity.setgroups([]);
    identity.setgid(1000);
    identity.setuid(1000);
    if (identity.getuid() !== 1000 || identity.getgid() !== 1000) throw new Error('Privilege drop failed.');
  }
  io.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK | fs.constants.X_OK);
  return { dataDir: dir, uid: identity.getuid?.(), gid: identity.getgid?.() };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const identity = prepareDataDirectory();
  console.log(`Office data directory ready; runtime uid=${identity.uid}, gid=${identity.gid}.`);
  // Run the existing server entrypoint, retaining its validation and signal handling.
  process.argv[1] = fileURLToPath(new URL('./server.mjs', import.meta.url));
  await import('./server.mjs');
}
