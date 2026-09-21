import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareDataDirectory } from '../bootstrap.mjs';

function fixture({ uid = 1000, symlink = false, directory = true, writable = true } = {}) {
  const calls = [];
  let currentUid = uid, currentGid = uid;
  const io = {
    mkdirSync: (...a) => calls.push(['mkdir', ...a]),
    lstatSync: () => ({ isDirectory: () => directory, isSymbolicLink: () => symlink }),
    chownSync: (...a) => calls.push(['chown', ...a]),
    chmodSync: (...a) => calls.push(['chmod', ...a]),
    accessSync: () => { calls.push(['access', currentUid]); if (!writable) throw new Error('EACCES'); }
  };
  const identity = {
    getuid: () => currentUid, getgid: () => currentGid,
    setgroups: a => calls.push(['groups', a]),
    setgid: n => { calls.push(['gid', n]); currentGid = n; },
    setuid: n => { calls.push(['uid', n]); currentUid = n; }
  };
  return { io, identity, calls };
}
const hosted = { RAILWAY_ENVIRONMENT_ID: 'test', RAILWAY_VOLUME_MOUNT_PATH: '/app/data', DATA_DIR: '/app/data' };

test('Railway refuses ephemeral storage without a volume', () => {
  const f = fixture();
  assert.throws(() => prepareDataDirectory({ RAILWAY_ENVIRONMENT_ID: 'test' }, f.io, f.identity), /persistent Railway volume/);
  assert.equal(f.calls.length, 0);
});
test('Railway refuses a mismatched data path', () => {
  const f = fixture();
  assert.throws(() => prepareDataDirectory({ ...hosted, DATA_DIR: '/tmp/data' }, f.io, f.identity), /exactly at DATA_DIR/);
});
test('root repairs only the volume directory and drops groups, gid and uid before access', () => {
  const f = fixture({ uid: 0 });
  assert.deepEqual(prepareDataDirectory(hosted, f.io, f.identity), { dataDir: '/app/data', uid: 1000, gid: 1000 });
  assert.deepEqual(f.calls.map(c => c[0]), ['mkdir','chown','chmod','groups','gid','uid','access']);
  assert.deepEqual(f.calls[1], ['chown', '/app/data', 1000, 1000]);
  assert.deepEqual(f.calls.at(-1), ['access', 1000]);
});
test('non-root startup never calls privileged operations', () => {
  const f = fixture();
  prepareDataDirectory(hosted, f.io, f.identity);
  assert.deepEqual(f.calls.map(c => c[0]), ['mkdir','access']);
});
test('symlink data directory fails closed', () => {
  const f = fixture({ uid: 0, symlink: true });
  assert.throws(() => prepareDataDirectory(hosted, f.io, f.identity), /not a symlink/);
  assert.equal(f.calls.some(c => c[0] === 'chown'), false);
});
test('non-directory data path fails closed', () => {
  const f = fixture({ directory: false });
  assert.throws(() => prepareDataDirectory(hosted, f.io, f.identity), /real directory/);
});
test('root cannot change ownership of arbitrary system paths', () => {
  const f = fixture({ uid: 0 });
  assert.throws(() => prepareDataDirectory({ DATA_DIR: '/etc' }, f.io, f.identity), /Refusing privileged/);
  assert.equal(f.calls.length, 0);
});
test('unwritable storage fails before serving', () => {
  const f = fixture({ writable: false });
  assert.throws(() => prepareDataDirectory(hosted, f.io, f.identity), /EACCES/);
});
