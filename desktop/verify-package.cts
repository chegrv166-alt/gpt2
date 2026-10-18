import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { extractFile, listPackage } from '@electron/asar';

const directory = process.argv[2];
assert(directory, 'Provide the packaged application directory');
const executable = readFileSync(path.join(directory, 'Ashen Covenant.exe'));
assert.equal(executable.toString('ascii', 0, 2), 'MZ', 'Expected a Windows executable');
const header = executable.readUInt32LE(0x3c);
assert.equal(executable.readUInt32LE(header), 0x00004550, 'Invalid PE header');
assert.equal(executable.readUInt16LE(header + 4), 0x8664, 'Expected Windows x64');
const archive = path.join(directory, 'resources/app.asar');
const entries = listPackage(archive, { isPack: false }).map((entry) => entry.replaceAll('\\', '/'));
assert(entries.includes('/dist/index.html') && entries.includes('/desktop-dist/main.cjs'), 'Missing bundled game or launcher');
assert(!entries.some((entry) => entry.startsWith('/node_modules/')), 'Development/source dependencies must not be shipped');
const html = extractFile(archive, 'dist/index.html').toString();
assert(html.includes('./assets/'), 'Bundled assets must use file-compatible relative paths');
console.log(`Verified Windows x64 executable and ${entries.length} bundled entries`);
