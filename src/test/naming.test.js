// Naming guard (docs/engineering/V1-F-DESIGN.md §12.1 W1, §12.5).
//
// Two product names, one each: the daily item is a "Daily Win" and the reward
// a child saves towards is a "Big Goal". The word "goal" alone names neither,
// and the weekly figure is a "weekly target". This file parses the app and the
// server with @babel/parser and reads only what can reach a screen: string
// literals, template text and JSX text. Comments, identifiers, import sources
// and identifier keys are never read.
//
// What it cannot see: text assembled from pieces at run time. The browser
// journey reads the rendered screens for the retired words (§12.5).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';

const ROOT = path.resolve(__dirname, '../..');
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

// ---------------------------------------------------------------- the rule

// A text is checked only when it reads as prose: it has a space, or it starts
// with a capital letter. Paths, keys and single class names ("goals",
// "/api/todays-goals", "bigger-rewards") have neither.
export function readsAsProse(text) {
  const t = text.trim();
  return /\s/.test(t) || /^[A-Z]/.test(t);
}

// A token with an underscore is a column or field name (is_bigger_goal,
// today_goals), not wording: W1 changes no column or field name. Only such
// tokens are set aside; the words around them are still checked.
const SNAKE_CASE = /\w*_\w*/g;

const RETIRED = /bigger|\broutines?\b|Today.s Goal/i;

// The retired word found in a text, or null. "goal" and "goals" pass only as
// the product name, directly after "Big " (capital B).
export function retiredWord(text) {
  const t = text.replace(SNAKE_CASE, ' ').replace(/\s+/g, ' ');
  for (const m of t.matchAll(/\bgoals?\b/gi)) {
    if (t.slice(Math.max(0, m.index - 4), m.index) !== 'Big ') return m[0];
  }
  const other = t.match(RETIRED);
  return other ? other[0] : null;
}

// The whole rule for one text: the retired word, or null when the text is not
// prose or is clean.
export function offence(text) {
  return readsAsProse(text) ? retiredWord(text) : null;
}

// ------------------------------------------------------------ the allow-list
//
// Exact texts only, each in the files named, each with its reason. An entry
// that no longer matches anything fails the test below, so the list stays
// short.
const STORED_PREFIX = 'Today’s Goal: ';
const ALLOWED = [
  // The note a completion writes (server/todaysGoals.js). It is a stored value
  // (W1: no stored value changes), parsed by Activity.jsx::goalTitleOf and
  // shown by the family report as "Daily Win: ".
  { text: STORED_PREFIX, files: ['server/todaysGoals.js', 'src/pages/Activity.jsx', 'src/lib/familyReport.js'] },
  // The name of a behaviour ICON in the approved register (the Settings icon
  // picker reads it as the icon's label). It names a picture, not a Daily Win.
  { text: 'Routines', files: ['src/lib/categoryIcons.js'] },
  // The "Goal Getter" badge definition is not shown on any V1 screen (§12.5).
  { text: 'Goal Getter', files: ['src/data/badge-definitions.js'] },
  // The family-goals API (/api/family-goals) has no screen (§12.5).
  { text: 'Goal title is required', files: ['server/routes.js'] },
  { text: 'Goal not found or already completed', files: ['server/routes.js'] },
  // Server log labels: written to the server log with the error, never sent to
  // a client (todaysGoals.js::fail and routes.js::serverError answer with a
  // fixed message).
  { text: 'List today goals', files: ['server/todaysGoals.js'] },
  { text: 'Create today goal', files: ['server/todaysGoals.js'] },
  { text: 'Edit today goal', files: ['server/todaysGoals.js'] },
  { text: 'Archive today goal', files: ['server/todaysGoals.js'] },
  { text: 'Complete today goal', files: ['server/todaysGoals.js'] },
  { text: 'Goal redeem error', files: ['server/routes.js'] },
  { text: 'Contribute to goal error:', files: ['server/routes.js'] },
  // Context names of the approved-icon register: a generated file keyed by the
  // design register (src/test/approvedIcons.test.js fails if it is edited by
  // hand). They are lookup keys and are never rendered.
  { text: 'Goals', files: ['src/components/icons/approvedIcons.js'] },
  { text: 'Routines', files: ['src/components/icons/approvedIcons.js'] },
];
// `value` is the text exactly as written in the source (white space included).
const isAllowed = (file, value) => ALLOWED.some((a) => a.text === value && a.files.includes(file));

// ------------------------------------------------------------- the collector

// Two kinds of text are not wording and are excused.
//
// Tailwind class strings, by where they stand, never by how they look: the
// value of a className attribute, or an argument of cn()/cva()/clsx()/
// twMerge(). Lower-case prose anywhere else is still checked.
//
// SQL, by its shape: a string or a whole template that starts with an
// upper-case SQL verb and goes on to an upper-case SQL clause. W1 changes no
// table or column (is_bigger_goal, a "goals" alias, a "--" note inside a
// query). The test is case-sensitive, so "Select a goal from the list" is
// prose and is checked.
const CLASS_ATTRIBUTE = /^class(Name)?$|ClassName$/;
const CLASS_FUNCTIONS = new Set(['cn', 'cva', 'clsx', 'twMerge']);

const NEVER = new Set(['loc', 'extra', 'comments', 'tokens', 'errors', 'leadingComments', 'trailingComments', 'innerComments']);
// Module sources and specifier names are not text.
const SKIP = {
  ImportDeclaration: ['source', 'specifiers', 'attributes'],
  ExportAllDeclaration: ['source', 'exported', 'attributes'],
  ExportNamedDeclaration: ['source', 'specifiers', 'attributes'],
  ImportExpression: ['source', 'options'],
};
const SQL = /^\s*(?:SELECT|WITH|INSERT INTO|UPDATE|DELETE FROM)\s[\s\S]*\b(?:FROM|SET|VALUES|WHERE)\b/;
export const looksLikeSql = (text) => SQL.test(text);
const isModuleCall = (node) => node.type === 'CallExpression' &&
  (node.callee.type === 'Import' || (node.callee.type === 'Identifier' && node.callee.name === 'require'));

// Every string literal, template text and JSX text in a source file, as
// { line, text, value, excused }. `text` is trimmed with its white space
// collapsed; `value` is as written, for finding the line of a word; `excused`
// is null, 'class' or 'sql'.
export function collectTexts(code) {
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });
  const out = [];
  const add = (node, value, excused) => {
    if (typeof value !== 'string') return;
    const text = value.replace(/\s+/g, ' ').trim();
    if (text) out.push({ line: node.loc.start.line, text, value, excused });
  };
  const cooked = (quasi) => quasi.value.cooked ?? quasi.value.raw;
  const visit = (node, excused) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'JSXText') return add(node, node.value, excused);
    if (node.type === 'StringLiteral') return add(node, node.value, excused || (looksLikeSql(node.value) ? 'sql' : null));
    if (node.type === 'TemplateElement') return add(node, cooked(node), excused);
    if (isModuleCall(node)) return;
    let within = excused;
    if (node.type === 'JSXAttribute' && node.name.type === 'JSXIdentifier' && CLASS_ATTRIBUTE.test(node.name.name)) within = within || 'class';
    // A whole template is judged at once, so the pieces between its ${} and
    // the texts inside them are excused with it.
    if (node.type === 'TemplateLiteral' && looksLikeSql(node.quasis.map(cooked).join('?'))) within = within || 'sql';
    const classCall = node.type === 'CallExpression' && node.callee.type === 'Identifier' && CLASS_FUNCTIONS.has(node.callee.name);
    const skip = SKIP[node.type] || [];
    for (const key of Object.keys(node)) {
      if (NEVER.has(key) || skip.includes(key)) continue;
      const child = node[key];
      const childExcused = within || (classCall && key === 'arguments' ? 'class' : null);
      if (Array.isArray(child)) child.forEach((c) => visit(c, childExcused));
      else if (child && typeof child === 'object') visit(child, childExcused);
    }
  };
  visit(ast.program, null);
  return out;
}

// The line a word stands on inside a text that spans lines (JSX text, template
// text): the text's first line plus the line breaks before the word.
function lineOf(entry, word) {
  const at = entry.value.indexOf(word);
  return entry.line + (at > 0 ? (entry.value.slice(0, at).match(/\n/g) || []).length : 0);
}

// Every offence in one source file, as { file, line, text, word }.
export function offencesIn(code, file) {
  return collectTexts(code)
    .filter((e) => !e.excused)
    .map((e) => ({ e, word: offence(e.text) }))
    .filter(({ e, word }) => word && !isAllowed(file, e.value))
    .map(({ e, word }) => ({ file, line: lineOf(e, word), text: e.text, word }))
    .sort((a, b) => a.line - b.line);
}

// ----------------------------------------------------------------- the files

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const isSource = (f) => /\.jsx?$/.test(f) && !/\.test\./.test(f);
// Every .js and .jsx under src except tests and src/test; every .js directly
// under server (not server/test, not the migrations).
const FILES = [
  ...walk(path.join(ROOT, 'src')).filter((f) => isSource(f) && !rel(f).startsWith('src/test/')),
  ...fs.readdirSync(path.join(ROOT, 'server'), { withFileTypes: true })
    .filter((e) => e.isFile() && /\.js$/.test(e.name) && !/\.test\./.test(e.name))
    .map((e) => path.join(ROOT, 'server', e.name)),
].map(rel).sort();

describe('naming guard: the rule (counter-examples)', () => {
  it.each([
    'Edit goal',
    'Manage goals',
    'Saving for something bigger',
    'Choose a routine',
    'weekly goal',
    'Goals',
    'Goal not found.',
    'Recurring routines and one-off achievements',
    'Today’s Goals',
    "Today's Goal: Tidy up",
    'Bigger achievement',
    'No bigger goals yet.',
    'big goal',
    'Edit Big Goal and another goal',
    'A big Goal',
    // Lower-case prose is not excused: only its place in the code can excuse a
    // text (a className), never its look.
    'could not save the goal',
    'flex items-center goal',
    'more than this goal needs',
  ])('"%s" fails', (text) => {
    expect(offence(text)).not.toBeNull();
  });

  it.each([
    'Edit Big Goal',
    'Big Goals',
    'Daily Wins',
    'weekly target',
    'Manage Daily Wins & Big Goals',
    'No Big Goals yet.',
    'More than this Big Goal needs',
    'Big\n  Goal',
    'Weekly target and Big Goals',
    'Could not update Daily Wins',
  ])('"%s" passes', (text) => {
    expect(offence(text)).toBeNull();
  });

  it('does not check keys, paths and single class names', () => {
    for (const text of ['goals', 'goal', '/api/todays-goals', 'bigger-rewards', 'is_bigger_goal', 'todaysGoals']) {
      expect(readsAsProse(text)).toBe(false);
      expect(offence(text)).toBeNull();
    }
  });

  it('sets aside column and field names, and nothing else, inside a text', () => {
    expect(offence('Unknown column is_bigger_goal in today_goals')).toBeNull();
    expect(offence('is_bigger_goal must be true for a bigger goal')).toBe('goal');
    expect(offence('Column is_bigger_goal marks a bigger reward')).toBe('bigger');
  });

  it('knows SQL by its shape, case-sensitively', () => {
    expect(looksLikeSql('SELECT id, is_bigger_goal FROM rewards WHERE id = $1')).toBe(true);
    expect(looksLikeSql('\n    WITH goals AS (SELECT 1) SELECT * FROM goals')).toBe(true);
    expect(looksLikeSql('UPDATE rewards SET is_bigger_goal = true WHERE id = $1')).toBe(true);
    for (const prose of ['Select a goal from the list', 'Update the goal where you set it', 'With goals from the family',
      'SELECT a goal', 'Delete this goal from the list?', 'could not save the goal']) {
      expect(looksLikeSql(prose)).toBe(false);
    }
  });
});

describe('naming guard: the collector (counter-examples)', () => {
  const FIXTURE = [
    "import Thing from './Manage goals';",                               // 1
    "// Edit goal in a comment",                                          // 2
    "/* Saving for something bigger */",                                  // 3
    "const goalRoutine = { goal: 1, 'A routine key': 2 };",               // 4
    "const lazy = () => import('./Bigger goals');",                       // 5
    "const msg = `Could not save the goal for ${goalRoutine.goal}`;",     // 6
    "export const View = () => (",                                        // 7
    "  <section className=\"goal bigger routine\" aria-label=\"Edit goal\">", // 8
    "    {/* Choose a routine */}",                                       // 9
    "    <p className={cn('weekly goal', cond && 'bigger goal')}>",       // 10
    "      could not save",                                               // 11
    "      the goal",                                                     // 12
    "    </p>",                                                           // 13
    "    <b>Big Goals</b>",                                               // 14
    "  </section>",                                                       // 15
    ");",                                                                 // 16
    "export { View as default } from './Choose a routine';",              // 17
    "const one = 'SELECT 1 FROM today_goals WHERE is_bigger_goal -- a goal';", // 18
    "const two = `",                                                      // 19
    "  WITH goals AS (SELECT 1 FROM rewards WHERE ${cond ? `r.goal -- the goal's` : 'no bigger goal'})", // 20
    "  SELECT * FROM goals`;",                                            // 21
    "const three = `Select ${one} a goal from the list`;",                // 22
  ].join('\n');

  it('reads string literals, template text and JSX text, with their lines', () => {
    expect(offencesIn(FIXTURE, 'fixture.jsx').map((o) => `${o.line}: ${o.text} [${o.word}]`)).toEqual([
      '4: A routine key [routine]',
      '6: Could not save the goal for [goal]',
      '8: Edit goal [goal]',
      '12: could not save the goal [goal]',
      '22: a goal from the list [goal]',
    ]);
  });

  it('never reads comments, identifiers, identifier keys or import sources', () => {
    const texts = collectTexts(FIXTURE).map((t) => t.text);
    for (const unread of ['./Manage goals', './Bigger goals', './Choose a routine', 'Edit goal in a comment',
      'Saving for something bigger', 'Choose a routine', 'goalRoutine', 'goal']) {
      expect(texts).not.toContain(unread);
    }
  });

  it('excuses a class string only by its place: className, cn()', () => {
    const classes = collectTexts(FIXTURE).filter((t) => t.excused === 'class').map((t) => t.text);
    expect(classes).toEqual(['goal bigger routine', 'weekly goal', 'bigger goal']);
    // The same words outside a className are checked.
    expect(offencesIn("const c = 'goal bigger routine';", 'fixture.js')).toHaveLength(1);
  });

  it('excuses SQL only by its shape: a query string, a whole query template', () => {
    const sql = collectTexts(FIXTURE).filter((t) => t.excused === 'sql').map((t) => t.line);
    expect(sql.sort((a, b) => a - b)).toEqual([18, 19, 20, 20, 20]);
  });

  it('allows an exact text only in the file named beside it', () => {
    const code = `const NOTE = '${STORED_PREFIX}';`;
    expect(offencesIn(code, 'src/pages/Activity.jsx')).toEqual([]);
    expect(offencesIn(code, 'src/pages/Children.jsx')).toHaveLength(1);
    expect(offencesIn(`const NOTE = '${STORED_PREFIX}Tidy up';`, 'src/pages/Activity.jsx')).toHaveLength(1);
  });
});

describe('naming guard: the app and the server (§12.1 W1)', () => {
  const sources = FILES.map((file) => ({ file, code: fs.readFileSync(path.join(ROOT, file), 'utf8') }));

  it('the scan sees the app and the server (control)', () => {
    expect(FILES).toContain('src/pages/Children.jsx');
    expect(FILES).toContain('src/lib/todaysGoals.js');
    expect(FILES).toContain('server/routes.js');
    expect(FILES).toContain('server/todaysGoals.js');
    expect(FILES.some((f) => /\.test\.|^src\/test\/|^server\/test\//.test(f))).toBe(false);
    const server = collectTexts(sources.find((s) => s.file === 'server/todaysGoals.js').code).map((t) => t.value);
    expect(server).toContain(STORED_PREFIX);
    expect(server).toContain('Daily Win not found.');
  });

  it('no text names a Daily Win or a Big Goal by a retired word', () => {
    const found = sources.flatMap(({ file, code }) => offencesIn(code, file));
    if (found.length) {
      const lines = found.map((o) => `  ${o.file}:${o.line}  [${o.word}]  ${JSON.stringify(o.text)}`);
      expect.fail(`${found.length} text(s) use a retired name (use "Daily Win", "Big Goal" or "weekly target"):\n${lines.join('\n')}`);
    }
  });

  it('every allow-list entry still matches a text in each file it names', () => {
    const stale = [];
    for (const entry of ALLOWED) {
      for (const file of entry.files) {
        const source = sources.find((s) => s.file === file);
        const present = source && collectTexts(source.code).some((t) => t.value === entry.text);
        if (!present) stale.push(`${file}: ${JSON.stringify(entry.text)}`);
      }
    }
    expect(stale).toEqual([]);
  });
});
