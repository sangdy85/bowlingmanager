const { rm } = require('node:fs/promises');
const { basename, resolve, sep } = require('node:path');

function storedPostImagePath(url, rootDirectory = process.cwd()) {
  const prefixes = ['/api/images/', '/uploads/'];
  const prefix = prefixes.find((candidate) => url.startsWith(candidate));
  if (!prefix) return null;

  const encoded = url.slice(prefix.length);
  let filename;
  try {
    filename = decodeURIComponent(encoded);
  } catch {
    return null;
  }
  if (!filename || filename !== basename(filename) || !/^[A-Za-z0-9._-]+$/.test(filename)) {
    return null;
  }

  const directory = resolve(rootDirectory, 'public', 'uploads');
  const path = resolve(directory, filename);
  return path.startsWith(`${directory}${sep}`) ? path : null;
}

async function removeStoredPostImagePathsStrict(paths) {
  const results = await Promise.allSettled(paths.map((path) => rm(path, { force: true })));
  if (results.some((result) => result.status === 'rejected')) {
    const error = new Error('Some post images could not be removed.');
    error.code = 'IMAGE_CLEANUP_FAILED';
    throw error;
  }
}

module.exports = { removeStoredPostImagePathsStrict, storedPostImagePath };
