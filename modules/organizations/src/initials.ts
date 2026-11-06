// Repeated in modules/users: packages cannot import each other.
export function initials(name: string): string {
  const [first = '', second] = name.split(/[\s._-]+/).filter(Boolean);
  return (second ? first.charAt(0) + second.charAt(0) : first.slice(0, 2)).toUpperCase();
}
