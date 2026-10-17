import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGuestPath} from '../components/maia-vfs/api.js';
import {MemoryVfsAdapter, VFS_FLAGS} from '../runtime/maia-vfs.js';
test('normalizes guest paths', () => assert.equal(normalizeGuestPath('/home/a/../b'), '/home/b'));
test('rejects escapes', () => assert.throws(() => normalizeGuestPath('/../../etc'), /escapes/));
test('rejects relative paths', () => assert.throws(() => normalizeGuestPath('home/file'), /absolute/));

test('memory VFS reads system files and enforces read-only mounts', () => {
	const vfs = new MemoryVfsAdapter();
	const handle = vfs.open('/system/welcome.txt', VFS_FLAGS.READ);
	assert.ok(handle > 0);
	const bytes = vfs.read(handle, 256);
	assert.match(new TextDecoder().decode(bytes), /C\+\+ kernel read this text/);
	assert.equal(vfs.read(handle, 16).byteLength, 0);
	assert.equal(vfs.write(handle, new Uint8Array([1])), -3);
	assert.equal(vfs.close(handle), 0);
	assert.equal(vfs.close(handle), -7);
	assert.equal(vfs.open('/system/new.txt', VFS_FLAGS.WRITE | VFS_FLAGS.CREATE), -3);
});

test('memory VFS writes app files and bounds open handles', () => {
	const vfs = new MemoryVfsAdapter({maxOpenFiles: 1, appId: 'test.app'});
	const handle = vfs.open('/home/test.app/note.txt', VFS_FLAGS.WRITE | VFS_FLAGS.CREATE);
	assert.ok(handle > 0);
	assert.equal(vfs.open('/home/test.app/other.txt', VFS_FLAGS.READ), -4);
	assert.equal(vfs.write(handle, new TextEncoder().encode('saved')), 5);
	assert.equal(vfs.close(handle), 0);
	const readHandle = vfs.open('/home/test.app/note.txt', VFS_FLAGS.READ);
	assert.equal(new TextDecoder().decode(vfs.read(readHandle, 10)), 'saved');
});

test('memory VFS confines home files to the app id', () => {
	const vfs = new MemoryVfsAdapter({
		appId: 'app.one',
		files: {'/home/app.two/private.txt': 'private'},
	});
	assert.equal(vfs.open('/home/app.one/note.txt', VFS_FLAGS.WRITE | VFS_FLAGS.CREATE) > 0, true);
	assert.equal(vfs.open('/home/app.two/private.txt', VFS_FLAGS.READ), -3);
	assert.equal(vfs.open('/home/note.txt', VFS_FLAGS.READ), -3);
});
