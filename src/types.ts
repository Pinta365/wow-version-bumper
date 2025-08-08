/**
 * Represents a TOC file with its metadata and content.
 */
export interface TocFile {
    /** The file path of the TOC file */
    path: string;
    /** The raw content of the TOC file */
    content: string;
    /** The current version extracted from the TOC file */
    version: string;
    /** The name of the addon this TOC file belongs to */
    addonName: string;
}

/**
 * Options for version bumping operations.
 */
export interface VersionBumpOptions {
    /** The new version to set (empty string for auto-increment) */
    newVersion: string;
    /** Whether to perform a dry run (no actual changes) */
    dryRun: boolean;
    /** Optional target addon name */
    targetAddon?: string;
    /** Type of version bump (major, minor, patch) */
    bumpType: "major" | "minor" | "patch";
    /** Git commit message */
    commitMessage: string;
    /** Whether to enable verbose output */
    verbose?: boolean;
}

/**
 * Configuration settings for the version bumper.
 */
export interface Config {
    /** List of addon names that are whitelisted for processing */
    whitelistedAddons: string[];
    /** Directory containing the addon folders */
    addonsDirectory: string;
}
