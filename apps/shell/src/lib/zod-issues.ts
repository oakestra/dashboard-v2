interface Issue {
  code: string;
  message: string;
  path: readonly PropertyKey[];
}

/** `services.0.image` as `services[0].image`, the way a JSON author counts. */
export function formatIssuePath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((text, part) => {
    if (typeof part === 'number') return `${text}[${part}]`;
    return text ? `${text}.${String(part)}` : String(part);
  }, '');
}

/**
 * One Zod issue for someone who wrote the JSON by hand. Zod words a missing field as "expected
 * string, received undefined", which reads like a bug report, so that becomes "x is required".
 * `subject` names the whole document when the issue has no path.
 */
export function formatIssue(issue: Issue, subject = 'The value'): string {
  const path = formatIssuePath(issue.path);
  if (issue.code === 'invalid_type' && /received undefined$/.test(issue.message)) {
    return `${path || subject} is required`;
  }
  return path ? `${path}: ${issue.message}` : issue.message;
}
