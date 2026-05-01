const STABLE_VERSION_REGEX = /^(?<year>\d{4})\.(?<month>[1-9]\d?)\.(?<day>[1-9]\d?)$/;
const BETA_VERSION_REGEX =
  /^(?<year>\d{4})\.(?<month>[1-9]\d?)\.(?<day>[1-9]\d?)-beta\.(?<beta>[1-9]\d*)$/;
const CORRECTION_VERSION_REGEX =
  /^(?<year>\d{4})\.(?<month>[1-9]\d?)\.(?<day>[1-9]\d?)-(?<correction>[1-9]\d*)$/;
const SEMVER_STABLE_VERSION_REGEX =
  /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)$/;
const SEMVER_BETA_VERSION_REGEX =
  /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)-beta\.(?<beta>[1-9]\d*)$/;

/**
 * @typedef {object} ParsedReleaseVersion
 * @property {string} version
 * @property {string} baseVersion
 * @property {"stable" | "beta"} channel
 * @property {number} year
 * @property {number} month
 * @property {number} day
 * @property {number | undefined} [betaNumber]
 * @property {number | undefined} [correctionNumber]
 * @property {Date} date
 */

/**
 * @typedef {object} NpmPublishPlan
 * @property {"stable" | "beta"} channel
 * @property {"latest" | "beta"} publishTag
 * @property {("latest" | "beta")[]} mirrorDistTags
 */

/**
 * @typedef {object} NpmDistTagMirrorAuth
 * @property {boolean} hasAuth
 * @property {"node-auth-token" | "npm-token" | "none"} source
 */

/**
 * @typedef {"--dry-run" | "--publish"} NpmPublishMode
 */

/**
 * @param {string} version
 * @param {Record<string, string | undefined>} groups
 * @param {"stable" | "beta"} channel
 * @returns {ParsedReleaseVersion | null}
 */
function parseDateParts(version, groups, channel) {
  const year = Number.parseInt(groups.year ?? "", 10);
  const month = Number.parseInt(groups.month ?? "", 10);
  const day = Number.parseInt(groups.day ?? "", 10);
  const betaNumber = channel === "beta" ? Number.parseInt(groups.beta ?? "", 10) : undefined;

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  if (channel === "beta" && (!Number.isInteger(betaNumber) || (betaNumber ?? 0) < 1)) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    version,
    baseVersion: `${year}.${month}.${day}`,
    channel,
    year,
    month,
    day,
    betaNumber,
    date,
  };
}

/**
 * @param {string} version
 * @param {Record<string, string | undefined>} groups
 * @param {"stable" | "beta"} channel
 * @returns {ParsedReleaseVersion | null}
 */
function parseSemverParts(version, groups, channel) {
  const major = Number.parseInt(groups.major ?? "", 10);
  const minor = Number.parseInt(groups.minor ?? "", 10);
  const patch = Number.parseInt(groups.patch ?? "", 10);
  const betaNumber = channel === "beta" ? Number.parseInt(groups.beta ?? "", 10) : undefined;

  if (
    !Number.isInteger(major) ||
    !Number.isInteger(minor) ||
    !Number.isInteger(patch) ||
    major < 0 ||
    minor < 0 ||
    patch < 0
  ) {
    return null;
  }
  if (channel === "beta" && (!Number.isInteger(betaNumber) || (betaNumber ?? 0) < 1)) {
    return null;
  }

  return {
    version,
    baseVersion: `${major}.${minor}.${patch}`,
    channel,
    major,
    minor,
    patch,
    betaNumber,
    scheme: "semver",
  };
}

/**
 * @param {string} version
 * @returns {ParsedReleaseVersion | null}
 */
export function parseReleaseVersion(version) {
  const trimmed = version.trim();
  if (!trimmed) {
    return null;
  }

  const stableMatch = STABLE_VERSION_REGEX.exec(trimmed);
  if (stableMatch?.groups) {
    const parsed = parseDateParts(trimmed, stableMatch.groups, "stable");
    return parsed ? { ...parsed, scheme: "calver" } : null;
  }

  const betaMatch = BETA_VERSION_REGEX.exec(trimmed);
  if (betaMatch?.groups) {
    const parsed = parseDateParts(trimmed, betaMatch.groups, "beta");
    return parsed ? { ...parsed, scheme: "calver" } : null;
  }

  const correctionMatch = CORRECTION_VERSION_REGEX.exec(trimmed);
  if (correctionMatch?.groups) {
    const parsedCorrection = parseDateParts(trimmed, correctionMatch.groups, "stable");
    const correctionNumber = Number.parseInt(correctionMatch.groups.correction ?? "", 10);
    if (parsedCorrection === null || !Number.isInteger(correctionNumber) || correctionNumber < 1) {
      return null;
    }

    return {
      ...parsedCorrection,
      correctionNumber,
      scheme: "calver",
    };
  }

  const semverStableMatch = SEMVER_STABLE_VERSION_REGEX.exec(trimmed);
  if (semverStableMatch?.groups) {
    return parseSemverParts(trimmed, semverStableMatch.groups, "stable");
  }

  const semverBetaMatch = SEMVER_BETA_VERSION_REGEX.exec(trimmed);
  if (semverBetaMatch?.groups) {
    return parseSemverParts(trimmed, semverBetaMatch.groups, "beta");
  }

  return null;
}

/**
 * @param {string} left
 * @param {string} right
 * @returns {number | null}
 */
export function compareReleaseVersions(left, right) {
  const parsedLeft = parseReleaseVersion(left);
  const parsedRight = parseReleaseVersion(right);
  if (parsedLeft === null || parsedRight === null) {
    return null;
  }
  if (parsedLeft.scheme !== parsedRight.scheme) {
    return null;
  }

  if (parsedLeft.scheme === "semver" && parsedRight.scheme === "semver") {
    if (parsedLeft.major !== parsedRight.major) {
      return Math.sign(parsedLeft.major - parsedRight.major);
    }
    if (parsedLeft.minor !== parsedRight.minor) {
      return Math.sign(parsedLeft.minor - parsedRight.minor);
    }
    if (parsedLeft.patch !== parsedRight.patch) {
      return Math.sign(parsedLeft.patch - parsedRight.patch);
    }

    if (parsedLeft.channel !== parsedRight.channel) {
      return parsedLeft.channel === "stable" ? 1 : -1;
    }
    if (parsedLeft.channel === "beta" && parsedRight.channel === "beta") {
      return Math.sign((parsedLeft.betaNumber ?? 0) - (parsedRight.betaNumber ?? 0));
    }
    return 0;
  }

  const dateDelta = parsedLeft.date.getTime() - parsedRight.date.getTime();
  if (dateDelta !== 0) {
    return Math.sign(dateDelta);
  }

  if (parsedLeft.channel !== parsedRight.channel) {
    return parsedLeft.channel === "stable" ? 1 : -1;
  }

  if (parsedLeft.channel === "beta" && parsedRight.channel === "beta") {
    return Math.sign((parsedLeft.betaNumber ?? 0) - (parsedRight.betaNumber ?? 0));
  }

  return Math.sign((parsedLeft.correctionNumber ?? 0) - (parsedRight.correctionNumber ?? 0));
}

/**
 * @param {string} version
 * @param {string | null} [currentBetaVersion]
 * @returns {NpmPublishPlan}
 */
export function resolveNpmPublishPlan(version, currentBetaVersion) {
  const parsedVersion = parseReleaseVersion(version);
  if (parsedVersion === null) {
    throw new Error(`Unsupported release version "${version}".`);
  }

  if (parsedVersion.channel === "beta") {
    return {
      channel: "beta",
      publishTag: "beta",
      mirrorDistTags: [],
    };
  }

  const normalizedCurrentBeta = currentBetaVersion?.trim();
  if (normalizedCurrentBeta) {
    const betaVsStable = compareReleaseVersions(normalizedCurrentBeta, version);
    if (betaVsStable !== null && betaVsStable > 0) {
      return {
        channel: "stable",
        publishTag: "latest",
        mirrorDistTags: [],
      };
    }
  }

  return {
    channel: "stable",
    publishTag: "latest",
    mirrorDistTags: ["beta"],
  };
}

/**
 * @param {{
 *   nodeAuthToken?: string | null | undefined;
 *   npmToken?: string | null | undefined;
 * }} [params]
 * @returns {NpmDistTagMirrorAuth}
 */
export function resolveNpmDistTagMirrorAuth(params = {}) {
  const nodeAuthToken = params.nodeAuthToken?.trim();
  if (nodeAuthToken) {
    return { hasAuth: true, source: "node-auth-token" };
  }

  const npmToken = params.npmToken?.trim();
  if (npmToken) {
    return { hasAuth: true, source: "npm-token" };
  }

  return { hasAuth: false, source: "none" };
}

/**
 * @param {{
 *   mode: NpmPublishMode;
 *   mirrorDistTags: string[] | readonly string[];
 *   hasAuth: boolean;
 * }} params
 * @returns {boolean}
 */
export function shouldRequireNpmDistTagMirrorAuth(params) {
  return (
    params.mode === "--publish" &&
    params.mirrorDistTags.some((distTag) => distTag.trim().length > 0) &&
    !params.hasAuth
  );
}
