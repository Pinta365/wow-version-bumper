import { format, increment, parse } from "@std/semver";
import type { TocFile } from "./types.ts";
import type { TocManager } from "./toc-manager.ts";

/**
 * Manages version operations including calculations and updates.
 */
export class VersionManager {
    private tocManager: TocManager;

    constructor(tocManager: TocManager) {
        this.tocManager = tocManager;
    }

    /**
     * Displays current versions across all TOC files.
     *
     * Shows version information for all TOC files, grouped by addon.
     * Optionally filters to show only a specific addon's versions.
     *
     * @param targetAddon - Optional addon name to filter results
     */
    public showCurrentVersions(targetAddon?: string): void {
        console.log("Current versions across .toc files:");
        console.log("=".repeat(60));

        const allTocFiles = this.tocManager.getTocFiles();
        const filesToShow = targetAddon ? this.tocManager.getTocFilesForAddon(targetAddon) : allTocFiles;

        if (filesToShow.length === 0) {
            if (targetAddon) {
                console.log(`❌ No .toc files found for addon: ${targetAddon}`);
            } else {
                console.log("❌ No .toc files found in any addon directories");
            }
            return;
        }

        const addonGroups = new Map<string, TocFile[]>();
        for (const file of filesToShow) {
            if (!addonGroups.has(file.addonName)) {
                addonGroups.set(file.addonName, []);
            }
            addonGroups.get(file.addonName)!.push(file);
        }

        for (const [addonName, files] of addonGroups) {
            console.log(`\n📦 ${addonName}:`);
            for (const file of files) {
                const relativePath = file.path.replace("./addons/", "");
                console.log(`  ${relativePath}: ${file.version}`);
            }

            const versions = [...new Set(files.map((f) => f.version))];
            if (versions.length > 1) {
                console.log(`  ⚠️  WARNING: Inconsistent versions in ${addonName}!`);
                console.log(`     Versions found: ${versions.join(", ")}`);
            } else {
                console.log(`  ✅ All files have consistent version: ${versions[0]}`);
            }
        }
    }

    /**
     * Calculates the next version for an addon based on current versions.
     *
     * Analyzes all TOC files for the specified addon (or all addons if none specified)
     * and determines the next version based on the highest current version and
     * the specified bump type.
     *
     * @param targetAddon - Optional addon name to calculate version for
     * @param bumpType - Type of version bump (major, minor, or patch)
     * @returns The next version string or null if no versions found
     */
    public getNextVersion(
        targetAddon?: string,
        bumpType: "major" | "minor" | "patch" = "patch",
    ): string | null {
        const allTocFiles = this.tocManager.getTocFiles();

        if (allTocFiles.length === 0) {
            return null;
        }

        const filesToCheck = targetAddon ? this.tocManager.getTocFilesForAddon(targetAddon) : allTocFiles;

        if (filesToCheck.length === 0) {
            console.error(`❌ No .toc files found for addon: ${targetAddon}`);
            return null;
        }

        const versions = filesToCheck.map((file) => {
            const parts = file.version.split(".").map(Number);
            return {
                major: parts[0] || 0,
                minor: parts[1] || 0,
                patch: parts[2] || 0,
                original: file.version,
                addonName: file.addonName,
            };
        });

        const highest = versions.reduce((max, current) => {
            if (current.major > max.major) return current;
            if (current.major < max.major) return max;
            if (current.minor > max.minor) return current;
            if (current.minor < max.minor) return max;
            if (current.patch > max.patch) return current;
            return max;
        });

        const currentSemver = parse(highest.original);
        const nextSemver = increment(currentSemver, bumpType);
        const nextVersion = format(nextSemver);

        if (targetAddon) {
            console.log(
                `📊 Current highest version for ${targetAddon}: ${highest.original}`,
            );
            console.log(
                `📈 Next version for ${targetAddon} will be: ${nextVersion} (${bumpType} bump)`,
            );
        } else {
            console.log(`📊 Current highest version: ${highest.original}`);
            console.log(`📈 Next version will be: ${nextVersion} (${bumpType} bump)`);
        }

        return nextVersion;
    }
}
