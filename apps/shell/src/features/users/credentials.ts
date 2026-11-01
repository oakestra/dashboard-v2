const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const ALL = UPPER + LOWER + DIGITS;

/** Random password without look-alike characters (0/O, 1/l/I), so it survives being read aloud. */
export function generatePassword(length = 16): string {
  const pick = (alphabet: string, random: number) => alphabet[random % alphabet.length]!;
  const random = crypto.getRandomValues(new Uint32Array(length));
  const chars = Array.from(random, (value) => pick(ALL, value));
  // Guarantee one of each class so password policies on the backend side never reject it.
  chars[0] = pick(UPPER, random[0]!);
  chars[1] = pick(LOWER, random[1]!);
  chars[2] = pick(DIGITS, random[2]!);
  // Shuffle so the guaranteed characters are not always at the front.
  const swaps = crypto.getRandomValues(new Uint32Array(length));
  for (let i = length - 1; i > 0; i--) {
    const j = swaps[i]! % (i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}

export interface Credentials {
  username: string;
  password: string;
  email: string;
  dashboardUrl: string;
}

export function formatCredentials({
  username,
  password,
  email,
  dashboardUrl,
}: Credentials): string {
  return [
    'Oakestra credentials',
    '',
    `Dashboard: ${dashboardUrl}`,
    `Username: ${username}`,
    `Email: ${email}`,
    `Password: ${password}`,
    '',
    'Please change the password after the first login.',
    '',
  ].join('\n');
}

export function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
