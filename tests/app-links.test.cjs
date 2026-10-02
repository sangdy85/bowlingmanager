// Run: node --test tests/app-links.test.cjs
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..');

test('assetlinks declares only the production Play-signed Android app', () => {
  const filename = path.join(repositoryRoot, 'public/.well-known/assetlinks.json');
  const raw = fs.readFileSync(filename, 'utf8');
  const document = JSON.parse(raw);

  assert.equal(Array.isArray(document), true);
  assert.equal(document.length, 1);
  assert.deepEqual(document[0], {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'kr.co.bowlingmanager.app',
      sha256_cert_fingerprints: [
        '46:EE:87:E2:14:DC:CE:D6:62:7F:4C:1D:98:C2:67:5D:FC:07:FC:94:A9:58:AA:05:E4:BA:2B:95:0A:15:4D:21',
      ],
    },
  });
  assert.doesNotMatch(raw, /private[_-]?key|client[_-]?secret|api[_-]?key/i);
});

test('Android manifest verifies only the www HTTPS team invite path', () => {
  const manifest = fs.readFileSync(
    path.join(repositoryRoot, 'mobile/android/app/src/main/AndroidManifest.xml'),
    'utf8',
  );
  const verifiedFilter = manifest.match(
    /<intent-filter android:autoVerify="true">([\s\S]*?)<\/intent-filter>/,
  );
  assert.ok(verifiedFilter, 'verified intent filter');
  const filter = verifiedFilter[1];
  for (const value of [
    'android.intent.action.VIEW',
    'android.intent.category.DEFAULT',
    'android.intent.category.BROWSABLE',
    'android:scheme="https"',
    'android:host="www.bowlingmanager.co.kr"',
    'android:pathPrefix="/invite/team/"',
  ]) {
    assert.ok(filter.includes(value), value);
  }
  assert.doesNotMatch(filter, /android:scheme="http"/);
  assert.doesNotMatch(filter, /android:host="bowlingmanager\.co\.kr"/);
  assert.ok(manifest.includes('android.intent.action.MAIN'));
  assert.ok(manifest.includes('android.intent.category.LAUNCHER'));
});

test('team invite path remains outside the sitemap', () => {
  const sitemap = fs.readFileSync(
    path.join(repositoryRoot, 'src/app/sitemap.ts'),
    'utf8',
  );
  assert.doesNotMatch(sitemap, /invite\/team/);
});
