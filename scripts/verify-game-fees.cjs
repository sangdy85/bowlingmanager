#!/usr/bin/env node
'use strict';
// Local verification only: no commit, push, deployment, or migration of a configured database.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));
const allowed = new Set(['--server-only', '--mobile-only']);
if ([...args].some(arg => !allowed.has(arg)) || (args.has('--server-only') && args.has('--mobile-only'))) {
  console.error('Usage: node scripts/verify-game-fees.cjs [--server-only | --mobile-only]');
  process.exit(1);
}
const server = !args.has('--mobile-only');
const mobile = !args.has('--server-only');
const unitTests = ['tests/event-game-fees-db.test.cjs', 'tests/mobile-team-events.test.cjs',
  'tests/mobile-team-finance.test.cjs', 'tests/mobile-event-admin-operations.test.cjs'];
const mobileTests = ['test/club_game_fee_widgets_test.dart', 'test/club_payment_accounts_screen_test.dart',
  'test/club_event_models_test.dart', 'test/club_events_api_test.dart',
  'test/club_event_attendance_management_test.dart', 'test/club_event_team_layout_test.dart',
  'test/club_finance_form_target_test.dart'];

function run(command, commandArgs, cwd = root, capture = false) {
  console.log(`\n> ${path.basename(command)} ${commandArgs.join(' ')}`);
  // All shell arguments are fixed literals. Windows Flutter/npm launchers are batch files.
  const result = spawnSync(command, commandArgs, {
    cwd, stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8',
    shell: process.platform === 'win32' && (command === 'flutter' || command === 'npm'),
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', CHECKPOINT_DISABLE: '1' },
  });
  if (result.error) throw new Error(`${path.basename(command)} is unavailable: ${result.error.message}`);
  if (result.status !== 0) {
    if (capture) console.error((result.stdout ?? '') + (result.stderr ?? ''));
    throw new Error(`Command failed (${result.status}): ${path.basename(command)}`);
  }
  return result.stdout;
}
try {
  const requiredFiles = ['src/lib/mobile-api/event-game-fees.ts', 'tests/event-game-fees-http.test.cjs'];
  if (mobile) requiredFiles.push('mobile/lib/features/club/presentation/club_payment_accounts_screen.dart');
  for (const name of requiredFiles) {
    if (!fs.existsSync(path.join(root, name))) throw new Error(`Apply the complete game fee change first. Missing: ${name}`);
  }
  if (server) {
    if (Number(process.versions.node.split('.')[0]) !== 20) throw new Error(`Server verification requires Node 20.x; current ${process.version}. Mobile-only: --mobile-only`);
    if (!fs.existsSync(path.join(root, 'node_modules/prisma/build/index.js'))) throw new Error('Run npm.cmd ci (Windows) or npm ci in this repository first.');
  }
  if (mobile) {
    const result = run('flutter', ['--version', '--machine'], root, true);
    const start = result.indexOf('{');
    const version = JSON.parse(result.slice(start));
    const dart = /^(\d+)\.(\d+)\.(\d+)/.exec(version.dartSdkVersion ?? '');
    if (!dart || Number(dart[1]) !== 3 || Number(dart[2]) < 13 || (Number(dart[2]) === 13 && Number(dart[3]) < 3)) {
      throw new Error(`Project requires Dart >=3.13.3 <4.0.0. Current: ${version.dartSdkVersion}. Do not downgrade project dependencies to bypass this check.`);
    }
    console.log(`Flutter ${version.frameworkVersion}, Dart ${version.dartSdkVersion}`);
  }
  if (server) {
    run(process.execPath, ['node_modules/prisma/build/index.js', 'generate']);
    run(process.execPath, ['--test', ...unitTests]);
    run(process.execPath, ['--test', 'tests/event-game-fees-http.test.cjs']);
    run('npm', ['run', 'build']);
  }
  if (mobile) {
    const cwd = path.join(root, 'mobile');
    const lockPath = path.join(cwd, 'pubspec.lock');
    const lockBefore = fs.existsSync(lockPath) ? fs.readFileSync(lockPath) : null;
    if (!lockBefore) throw new Error('mobile/pubspec.lock is missing. Restore the project lockfile before verification.');
    run('flutter', ['pub', 'get'], cwd);
    if (!lockBefore.equals(fs.readFileSync(lockPath))) throw new Error('pubspec.lock changed during dependency resolution. Review its diff before continuing; verification stopped.');
    run('flutter', ['analyze', '--no-pub'], cwd);
    run('flutter', ['test', '--no-pub', ...mobileTests], cwd);
  }
  console.log(`\nPASS: ${server ? 'server' : ''}${server && mobile ? ' + ' : ''}${mobile ? 'mobile analyze/tests' : ''}`);
  console.log('No production database changes, deployment, commit, or push performed.');
  if (!mobile) console.log('Flutter verification was not run (--server-only).');
} catch (error) {
  console.error(`\nSTOP: ${error.message}`);
  console.error('No passing result is claimed for incomplete verification.');
  process.exitCode = 1;
}
