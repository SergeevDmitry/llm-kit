/**
 * Extracts every TypeScript snippet from the public package READMEs and
 * typechecks it against that package's real source.
 *
 * README examples must compile in CI: do not release a package whose README
 * example is untested.
 *
 * Fence conventions:
 *   ```ts            → extracted and typechecked
 *   ```typescript    → extracted and typechecked
 *   ```ts no-check   → deliberately illustrative, skipped (use sparingly)
 *   ```text / ```js  → never extracted
 *
 * Run: pnpm run validate:readme  [-- <package> ...]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PUBLIC_PACKAGES, REPO_ROOT, Violations, publicPackageDir } from './lib/workspace.js';

const violations = new Violations();
const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));

/**
 * The root README is checked alongside the six package READMEs, because it is
 * the page every reader of the project sees first, it carries the
 * repository's headline pricing claim, and the rule that every README example
 * must be tested before release does not carve it out.
 *
 * `<root>` is not a package name, so it is skipped when specific packages are
 * requested on the command line, and has no `publicPackageDir`.
 */
const ROOT_README_LABEL = '<root>';
const targets =
  requested.length > 0 ? requested : [...Object.keys(PUBLIC_PACKAGES), ROOT_README_LABEL];

interface Snippet {
  readonly code: string;
  /** 1-based line of the opening fence, for error messages. */
  readonly line: number;
}

function extractSnippets(markdown: string): { checked: Snippet[]; skipped: number } {
  const lines = markdown.split('\n');
  const checked: Snippet[] = [];
  let skipped = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const fence = /^```(\S+)(.*)$/.exec(line.trim());
    if (fence === null) continue;

    const language = (fence[1] ?? '').toLowerCase();
    const modifiers = (fence[2] ?? '').trim();
    const isTypeScript = language === 'ts' || language === 'typescript' || language === 'tsx';

    const start = index + 1;
    let end = start;
    while (end < lines.length && (lines[end] ?? '').trim() !== '```') {
      end += 1;
    }

    if (isTypeScript) {
      if (modifiers.includes('no-check')) {
        skipped += 1;
      } else {
        checked.push({ code: lines.slice(start, end).join('\n'), line: index + 1 });
      }
    }
    index = end;
  }

  return { checked, skipped };
}

const workRoot = mkdtempSync(join(tmpdir(), 'llm-kit-readme-'));

try {
  for (const name of targets) {
    const isRoot = name === ROOT_README_LABEL;
    if (!isRoot && PUBLIC_PACKAGES[name] === undefined) {
      violations.error(`unknown package "${name}"`);
      continue;
    }
    const readmePath = isRoot
      ? join(REPO_ROOT, 'README.md')
      : join(publicPackageDir(name), 'README.md');
    if (!existsSync(readmePath)) {
      violations.error(`${name}: README.md is missing`);
      continue;
    }

    const markdown = readFileSync(readmePath, 'utf8');
    const isScaffoldPlaceholder = markdown.includes('**Status: scaffold.**');
    const { checked, skipped } = extractSnippets(markdown);

    if (checked.length === 0) {
      // A placeholder README is a known, tracked gap. A real README without a
      // compilable example is a release blocker.
      const message = `${name}: README contains no checkable TypeScript snippet (${String(skipped)} marked no-check)`;
      if (isScaffoldPlaceholder) {
        violations.warn(`${message} — still the scaffold placeholder`);
      } else {
        violations.error(message);
      }
      continue;
    }

    // `<root>` is not filesystem-friendly as a directory name.
    const snippetDir = join(workRoot, isRoot ? 'root-readme' : name);
    mkdirSync(snippetDir, { recursive: true });

    const fileNames: string[] = [];
    checked.forEach((snippet, snippetIndex) => {
      const fileName = `snippet-${String(snippetIndex + 1)}-line-${String(snippet.line)}.ts`;
      // `export {}` forces module scope so snippets cannot collide in globals.
      writeFileSync(join(snippetDir, fileName), `${snippet.code}\nexport {};\n`);
      fileNames.push(fileName);
    });

    // Map the package's own name to its source so snippets read exactly the
    // way a consumer would write them.
    const paths: Record<string, string[]> = {};
    for (const dependency of Object.keys(PUBLIC_PACKAGES)) {
      paths[dependency] = [join(REPO_ROOT, 'packages', dependency, 'src', 'index.ts')];
    }

    writeFileSync(
      join(snippetDir, 'tsconfig.json'),
      `${JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            lib: ['ES2023'],
            module: 'ESNext',
            moduleResolution: 'Bundler',
            strict: true,
            noEmit: true,
            skipLibCheck: true,
            allowImportingTsExtensions: true,
            types: ['node'],
            typeRoots: [join(REPO_ROOT, 'node_modules', '@types')],
            baseUrl: '.',
            paths,
          },
          include: fileNames,
        },
        null,
        2,
      )}\n`,
    );

    try {
      execFileSync(
        'node',
        [join(REPO_ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', '.'],
        { cwd: snippetDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
      console.log(
        `${name}: ${String(checked.length)} README snippet(s) compile (${String(skipped)} skipped)`,
      );
    } catch (error) {
      const detail =
        error instanceof Error && 'stdout' in error
          ? String((error as { stdout?: unknown }).stdout)
          : String(error);
      violations.error(`${name}: README snippets failed to compile:\n${detail}`);
    }
  }
} finally {
  rmSync(workRoot, { recursive: true, force: true });
}

violations.report('README examples');
