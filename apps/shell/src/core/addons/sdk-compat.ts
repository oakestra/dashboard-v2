import semver from 'semver';

export type SdkCompatibility = { compatible: true } | { compatible: false; reason: string };

/**
 * Checks the shell's SDK version against the range an addon was built for.
 *
 * Prereleases of the shell are accepted so a `1.1.0-rc.1` shell can be tested with existing
 * addons; semver would otherwise reject every range for a prerelease version.
 */
export function checkSdkCompatibility(
  shellSdkVersion: string,
  addonRange: string,
): SdkCompatibility {
  const range = semver.validRange(addonRange);
  if (range === null) {
    return { compatible: false, reason: `"${addonRange}" is not a valid semver range` };
  }
  if (semver.satisfies(shellSdkVersion, range, { includePrerelease: true })) {
    return { compatible: true };
  }
  return {
    compatible: false,
    reason: `Addon requires dashboard SDK ${addonRange}, this dashboard provides ${shellSdkVersion}`,
  };
}
