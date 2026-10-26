const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'extensions/band-photo-helper');
const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
const files = ['manifest.json', 'package.json', 'bridge.js', 'controller.js', 'transfer.js', 'store.js', 'worker.js', 'popup.html', 'popup.js', 'popup.css', 'README.md'];
const folder = path.join(root, 'scratch', 'band-photo-helper-' + manifest.version);
const zip = folder + '.zip';
assert(!fs.existsSync(zip), 'Versioned ZIP already exists; preserve it and use a new version.');
if (process.platform !== 'win32') throw Error('This local packaging command requires Windows .NET ZIP support.');
// A previous compression attempt may have left the complete copied folder.
// Reuse it only when every byte matches; never overwrite local changes.
if (fs.existsSync(folder)) {
    assert.deepEqual(fs.readdirSync(folder).sort(), [...files].sort(), 'Preserve a changed artifact folder.');
    for (const file of files) assert(fs.readFileSync(path.join(source, file)).equals(fs.readFileSync(path.join(folder, file))), 'Preserve a changed artifact file: ' + file);
} else {
    fs.mkdirSync(folder, { recursive: true });
    for (const file of files) fs.copyFileSync(path.join(source, file), path.join(folder, file));
}
const quote = value => "'" + value.replaceAll("'", "''") + "'";
// Use the framework ZIP API instead of the PS5/PS7 Archive module, whose module
// version may be incompatible with the child PowerShell process on this PC.
const entries = files.map(file => '[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,' + quote(path.join(folder, file)) + ',' + quote(file) + ',[IO.Compression.CompressionLevel]::Optimal) | Out-Null').join('; ');
const command = "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem; $archive=[IO.Compression.ZipFile]::Open(" + quote(zip) + ',[IO.Compression.ZipArchiveMode]::Create); try { ' + entries + ' } finally { $archive.Dispose() }';
cp.execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { stdio: 'inherit' });
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const info = {
    version: manifest.version, createdAt: new Date().toISOString(),
    sourceCommit: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    uncommitted: Boolean(cp.execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()),
    permissions: manifest.permissions, folder, zip, zipSha256: hash(zip),
    files: files.map(file => ({ name: file, sha256: hash(path.join(folder, file)) })),
};
fs.writeFileSync(folder + '-metadata.json', JSON.stringify(info, null, 2));
console.log(JSON.stringify({ folder, zip, version: info.version, files: files.length, sha256: info.zipSha256 }));
