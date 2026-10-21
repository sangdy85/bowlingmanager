// Isolated, in-memory rendering of the real page. Never connects to a database.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../..');
const nativeRequire = createRequire(path.join(root, 'package.json'));
const ts = nativeRequire('typescript');
const React = nativeRequire('react');
const { renderToStaticMarkup } = nativeRequire('react-dom/server');
const postcss = nativeRequire('postcss');

function createRenderer({ records = [], authenticated = true, hasTeam = true, manager = true, name = '테스트 볼러', role = 'USER', pathname, admin = {}, moduleOverrides = {} } = {}) {
  let currentPath = pathname || '/personal';
  const styles = new Map();
  const cache = new Map();
  const team = { id: 'fixture-team', name: '테스트 볼링클럽', ownerId: manager ? 'fixture-user' : 'another-user', User: [] };
  const user = { id: 'fixture-user', name, teamMemberships: hasTeam ? [{ teamId: team.id, team }] : [] };
  const prisma = {
    user: { findUnique: async () => user, count: async () => admin.userCount ?? 0, findMany: async () => (admin.users ?? []).map(user => ({ ownedCenters: [], managedCenters: [], ...user })) },
    team: { count: async () => admin.teamCount ?? 0, findMany: async () => admin.teams ?? [] },
    bowlingCenter: { findUnique: async ({ where }) => (admin.centers ?? []).find(center => center.id === where.id) ?? null, count: async () => admin.centerCount ?? 0, findMany: async () => (admin.centers ?? []).map(center => ({ owner: { id: "fixture-owner", name: "테스트 소유자", email: "owner@example.invalid" }, managers: [], ...center })) },
    score: { findMany: async () => records },
    leagueMatchupIndividualScore: { findMany: async () => [] },
    tournamentScore: { findMany: async () => [] },
  };
  const overrides = {
    '@/auth': { auth: async () => authenticated ? { user: { id: user.id, role } } : null },
    '@/lib/prisma': prisma,
    '@/app/actions/admin': Object.fromEntries(['createBowlingCenter', 'deleteBowlingCenter', 'deleteUser', 'deleteTeam', 'setTeamBowlerHiddenEnabled', 'updateUserRole'].map(name => [name, () => { throw new Error('Mutation forbidden in UI fixture: ' + name); }])),
    'next/link': ({ children, href, ...props }) => React.createElement('a', { href, ...props }, children),
    'next/navigation': { usePathname: () => currentPath, redirect: destination => { throw new Error(`REDIRECT:${destination}`); }, useRouter: () => ({ push() {} }), useSearchParams: () => new URLSearchParams('year=2026') },
    'next-auth/react': { signOut() {} },
    ...moduleOverrides,
  };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    if (filename.endsWith('.css')) {
      const prefix = path.basename(filename, '.module.css').replace(/\W/g, '_');
      const map = {};
      const ast = postcss.parse(fs.readFileSync(filename, 'utf8'));
      ast.walkRules(rule => {
        const globals = [];
        let selector = rule.selector.replace(/:global\(/g, 'GLOBAL(');
        let index;
        while ((index = selector.indexOf('GLOBAL(')) >= 0) {
          let end = index + 7, level = 1;
          for (; level && end < selector.length; end++) { if (selector[end] === '(') level++; if (selector[end] === ')') level--; }
          const inner = selector.slice(index + 7, end - 1);
          const key = `__GLOBAL_${globals.length}__`; globals.push(inner);
          selector = selector.slice(0, index) + key + selector.slice(end);
        }
        selector = selector.replace(/\.([a-zA-Z_][\w-]*)/g, (_, name) => { map[name] = `${prefix}_${name}`; return `.${map[name]}`; });
        rule.selector = selector.replace(/__GLOBAL_(\d+)__/g, (_, n) => globals[n]);
      });
      styles.set(filename, ast.toString());
      return map;
    }
    const mod = { exports: {} }; cache.set(filename, mod);
    const localRequire = id => {
      if (Object.hasOwn(overrides, id)) return overrides[id];
      if (id.startsWith('@/') || id.startsWith('.')) {
        const base = id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : path.resolve(path.dirname(filename), id);
        const resolved = [base, `${base}.tsx`, `${base}.ts`, `${base}.cjs`].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
        if (!resolved) throw new Error(`Unresolved ${id}`);
        return load(resolved);
      }
      return nativeRequire(id);
    };
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', output)(localRequire, mod, mod.exports);
    return mod.exports;
  }
  async function render(page = 'personal') {
    currentPath = pathname || '/' + page;
    const Page = load(path.join(root, `src/app/${page}/page.tsx`)).default;
    const content = await Page({ searchParams: Promise.resolve({ year: '2026' }) });
    if (page === 'admin' || page.startsWith('admin/')) {
      const Layout = load(path.join(root, 'src/app/admin/layout.tsx')).default;
      return renderToStaticMarkup(await Layout({ children: content }));
    }
    return renderToStaticMarkup(content);
  }
  async function document(page = 'personal') {
    const markup = await render(page);
    const Navbar = load(path.join(root, 'src/components/Navbar.tsx')).default;
    const Footer = load(path.join(root, 'src/components/Footer.tsx')).default;
    const nav = renderToStaticMarkup(React.createElement(Navbar, { isLoggedIn: authenticated, userRole: role }));
    const footer = renderToStaticMarkup(React.createElement(Footer));
    const tokens = fs.readFileSync(path.join(root, 'src/app/dashboard-tokens.css'), 'utf8');
    const globals = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8').replace('@import "./dashboard-tokens.css";', tokens);
    return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Phase 1 UI 검증 — 가상 테스트 데이터</title><style>${globals}\n${[...styles.values()].join('\n')}</style><body><div class="min-h-screen bg-background text-foreground flex flex-col justify-between"><div>${nav}<main class="container mx-auto px-4 py-8">${markup}</main></div>${footer}</div></body></html>`;
  }
  return { render, document, load };
}

function fixtureRecords(scores = [180, 215, 164, 202, 225, 189, 231, 208, 0, 310]) {
  return scores.map((score, index) => ({ id: `fixture-${index}`, userId: 'fixture-user', score, gameDate: new Date(Date.UTC(2026, 9, index + 1)), createdAt: new Date(Date.UTC(2026, 9, index + 1)), gameType: '정기전', teamId: 'fixture-team', Team: { id: 'fixture-team', name: '테스트 볼링클럽' }, memo: null }));
}
module.exports = { createRenderer, fixtureRecords };
