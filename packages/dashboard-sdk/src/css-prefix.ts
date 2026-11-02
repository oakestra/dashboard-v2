/**
 * Finds class selectors in an addon stylesheet that do not carry the addon's Tailwind prefix.
 *
 * The addon stylesheet loads after the shell's, in the same cascade layer, so an unprefixed
 * utility in it (`.hidden`, `.md\:flex`) beats the shell's own classes on shell markup and can
 * hide the sidebar. Without a prefix Tailwind also generates classes for class-like words in
 * comments, so this happens easily and silently. Loaded by Node from vite.config.ts: no
 * browser-only imports, `.ts` extensions on relative imports.
 */

/** What Tailwind v4 accepts in `prefix(...)`. */
const TAILWIND_PREFIX = /^[a-z]+$/;

export function assertValidPrefix(prefix: unknown): asserts prefix is string {
  if (typeof prefix !== 'string' || !TAILWIND_PREFIX.test(prefix)) {
    throw new Error(
      `oakestraAddon(): prefix ${JSON.stringify(prefix)} is not a valid Tailwind prefix. Use ` +
        `lowercase letters a-z only, the same value as prefix(...) on the tailwindcss/theme.css ` +
        `import in addon.css, for example prefix: 'ex' with prefix(ex).`,
    );
  }
}

/**
 * Selectors of all style rules, nested ones included, split at top-level commas. Comments are
 * dropped (Tailwind's license banner contains `tailwindcss.com`), at-rule preludes are skipped
 * (`@media (min-width:40rem)`), declarations are never looked at. Works on minified and
 * unminified CSS; it is a tokenizer for strings, escapes and blocks, not a full CSS parser, which
 * is enough for the rule boundaries that matter here.
 */
export function collectSelectors(css: string): string[] {
  const selectors: string[] = [];
  let prelude = '';
  for (let i = 0; i < css.length; i++) {
    const char = css[i]!;
    if (char === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? css.length : end + 1;
      continue;
    }
    if (char === '"' || char === "'") {
      let end = i + 1;
      while (end < css.length && css[end] !== char) end += css[end] === '\\' ? 2 : 1;
      prelude += css.slice(i, end + 1);
      i = end;
      continue;
    }
    if (char === '\\') {
      prelude += css.slice(i, i + 2);
      i++;
      continue;
    }
    if (char === '{') {
      const text = prelude.trim();
      if (text !== '' && !text.startsWith('@')) selectors.push(...splitSelectorList(text));
      prelude = '';
      continue;
    }
    // A declaration ends with `;`, a block with `}`; neither belongs to the next prelude.
    if (char === ';' || char === '}') {
      prelude = '';
      continue;
    }
    prelude += char;
  }
  return selectors;
}

function splitSelectorList(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const char = list[i];
    if (char === '\\') i++;
    else if (char === '"' || char === "'") {
      let end = i + 1;
      while (end < list.length && list[end] !== char) end += list[end] === '\\' ? 2 : 1;
      i = end;
    } else if (char === '(' || char === '[') depth++;
    else if (char === ')' || char === ']') depth--;
    else if (char === ',' && depth === 0) {
      parts.push(list.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(list.slice(start).trim());
  return parts.filter((part) => part !== '');
}

/** Quoted attribute values (`[href$=".pdf"]`) are no class selectors. */
const withoutStrings = (selector: string) =>
  selector.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');

/**
 * A class selector is a `.` that does not belong to a name or an escape (`.ex\:w-1\.5`). It must
 * be followed by the prefix and Tailwind's `\:` (`\3a ` is the same character in hex). The bare
 * `.dark` is allowed: it is the shell's theme class that the `dark:` variant refers to
 * (`.ex\:dark\:x:is(.dark *)`), while `.dark\:hidden` is an unprefixed class. The same rule as
 * the e2e test in e2e/tests/addon-runtime.spec.ts, which checks the stylesheet the browser parsed.
 */
const unprefixedClass = (prefix: string) =>
  new RegExp(String.raw`(?:^|[^\w\\-])\.(?!${prefix}(?:\\:|\\3[aA]))(?!dark(?![\w\\-]))`);

const prefixedClass = (prefix: string) =>
  new RegExp(String.raw`(?:^|[^\w\\-])\.${prefix}(?:\\:|\\3[aA])`);

/** Class names of a selector, escapes kept as written. Only used to word the messages. */
const classNames = (selector: string) =>
  [...withoutStrings(selector).matchAll(/(?:^|[^\w\\-])\.((?:[^\s.#:[\]()>+~,*\\]|\\.)*)/g)].map(
    (match) => match[1]!,
  );

export interface PrefixCheckResult {
  /** Selectors with at least one class that lacks the prefix, in order, without duplicates. */
  unprefixed: string[];
  /** Number of selectors with a prefixed class and no unprefixed one. */
  prefixed: number;
}

export function checkClassPrefix(css: string, prefix: string): PrefixCheckResult {
  const isUnprefixed = unprefixedClass(prefix);
  const isPrefixed = prefixedClass(prefix);
  const unprefixed = new Set<string>();
  let prefixed = 0;
  for (const selector of collectSelectors(css)) {
    const text = withoutStrings(selector);
    if (isUnprefixed.test(text)) unprefixed.add(selector);
    else if (isPrefixed.test(text)) prefixed++;
  }
  return { unprefixed: [...unprefixed], prefixed };
}

const LISTED_SELECTORS = 20;

/**
 * The message for one stylesheet, or undefined when it is fine. When no class has the prefix,
 * listing hundreds of selectors would hide the actual mistake: a prefix in addon.css that differs
 * from the configured one, or none at all.
 */
export function describePrefixProblem(
  file: string,
  prefix: string,
  result: PrefixCheckResult,
): string | undefined {
  const { unprefixed, prefixed } = result;
  if (unprefixed.length === 0) return undefined;

  const examples = (count: number) => unprefixed.slice(0, count).join(', ');
  if (prefixed === 0) {
    const otherPrefixes = new Set(
      unprefixed
        .flatMap(classNames)
        .filter((name) => name !== 'dark')
        .map((name) => /^([a-z]+)\\(?::|3[aA])/.exec(name)?.[1]),
    );
    const [other] = otherPrefixes;
    // `dark` is the `dark:` variant of an addon without any prefix, not a prefix of its own.
    if (otherPrefixes.size === 1 && other !== undefined && other !== 'dark') {
      return (
        `${file}: no class selector carries the configured prefix "${prefix}:", all of them ` +
        `start with "${other}:" (for example ${examples(3)}). addon.css probably imports ` +
        `tailwindcss/theme.css with prefix(${other}). Use the same prefix in both places: ` +
        `prefix: '${other}' in oakestraAddon() in vite.config.ts, or prefix(${prefix}) in ` +
        `addon.css together with "${prefix}:" on every class.`
      );
    }
    return (
      `${file}: no class selector carries the prefix "${prefix}:" (${unprefixed.length} ` +
      `without it, for example ${examples(5)}). Check that addon.css imports Tailwind's theme ` +
      `with the prefix, @import 'tailwindcss/theme.css' layer(theme) prefix(${prefix});, and ` +
      `that every class in your code starts with "${prefix}:". Without the prefix Tailwind ` +
      `generates plain utilities, also for class-like words in comments, and they override the ` +
      `shell's own classes.`
    );
  }

  const listed = unprefixed.slice(0, LISTED_SELECTORS).map((selector) => `  ${selector}`);
  if (unprefixed.length > LISTED_SELECTORS) {
    listed.push(`  ... and ${unprefixed.length - LISTED_SELECTORS} more`);
  }
  return [
    `${file}: ${unprefixed.length} class selector${unprefixed.length === 1 ? '' : 's'} without ` +
      `the addon prefix "${prefix}:":`,
    ...listed,
    `The addon stylesheet loads after the shell's in the same cascade layer, so these rules ` +
      `also apply to the shell's markup and can override its classes, for example hide the ` +
      `sidebar. Tailwind prefixes the utilities of your code; these come from CSS written by ` +
      `hand or imported. Define custom classes with @utility in addon.css (used as ` +
      `"${prefix}:<name>", Tailwind prefixes them too), and do not import stylesheets with ` +
      `global class names.`,
  ].join('\n');
}
