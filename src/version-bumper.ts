import type { TocFile, VersionBumpOptions } from "./types.ts";
import { ConfigManager } from "./config.ts";
import { TocManager } from "./toc-manager.ts";
import { VersionManager } from "./version-manager.ts";
import { GitManager } from "./git-manager.ts";

/**
 * Main class for managing WoW addon version bumping operations.
 *
 * This class handles reading TOC files, parsing versions, updating version numbers,
 * and performing git operations for version management.
 */
export class VersionBumper {
    private configManager: ConfigManager;
    private tocManager: TocManager;
    private versionManager: VersionManager;
    private gitManager: GitManager;
    private verbose: boolean;

    /**
     * Creates a new VersionBumper instance and initializes it.
     *
     * This constructor loads the configuration and scans for TOC files
     * in the configured addons directory.
     *
     * @param verbose - Whether to enable verbose output
     */
    constructor(verbose: boolean = false) {
        this.verbose = verbose;
        this.configManager = new ConfigManager(verbose);
        this.tocManager = new TocManager(this.configManager, verbose);
        this.versionManager = new VersionManager(this.tocManager);
        this.gitManager = new GitManager(this.configManager);
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
        this.versionManager.showCurrentVersions(targetAddon);
    }

    /**
     * Lists all available addons found in the TOC files.
     *
     * Displays a list of all addons that have TOC files, along with
     * the count of TOC files for each addon.
     */
    public listAddons(): void {
        this.tocManager.listAddons();
    }

    /**
     * Displays the current whitelist of addons.
     *
     * Shows all addons that are currently whitelisted for processing,
     * along with the total count.
     */
    public showWhitelist(): void {
        this.configManager.showWhitelist();
    }

    /**
     * Gets the list of whitelisted addons.
     *
     * @returns A copy of the whitelisted addons array
     */
    public getWhitelistedAddons(): string[] {
        return this.configManager.getWhitelistedAddons();
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
        return this.versionManager.getNextVersion(targetAddon, bumpType);
    }

    /**
     * Displays the current configuration settings.
     *
     * Shows the addons directory path and the list of whitelisted addons,
     * along with helpful information about configuration.
     */
    public showConfig(): void {
        this.configManager.showConfig();
    }

    /**
     * Performs version bumping operations on TOC files.
     *
     * Updates version numbers in TOC files and optionally creates git tags.
     * Can target a specific addon or bump all addons to individual versions.
     *
     * @param options - Configuration options for the version bump operation
     */
    public async bumpVersion(options: VersionBumpOptions): Promise<void> {
        if (options.targetAddon) {
            const filesToUpdate = this.tocManager.getTocFilesForAddon(options.targetAddon);

            if (filesToUpdate.length === 0) {
                console.error(
                    `❌ No .toc files found for addon: ${options.targetAddon}`,
                );
                return;
            }

            console.log(
                `\nBumping ${options.targetAddon} to version: ${options.newVersion}`,
            );
            console.log("=".repeat(60));

            this.updateFiles(filesToUpdate, options);

            // Create git tag for the specific addon
            await this.gitManager.createGitTag(
                options.newVersion,
                options.commitMessage,
                options.targetAddon,
                options.dryRun,
            );
        } else {
            const allTocFiles = this.tocManager.getTocFiles();
            const addonGroups = new Map<string, TocFile[]>();
            for (const file of allTocFiles) {
                if (!addonGroups.has(file.addonName)) {
                    addonGroups.set(file.addonName, []);
                }
                addonGroups.get(file.addonName)!.push(file);
            }

            if (options.newVersion && options.newVersion !== "") {
                console.log(`\nBumping all addons to version: ${options.newVersion}`);
                console.log("=".repeat(60));

                for (const [addonName, files] of addonGroups) {
                    console.log(`\n📦 ${addonName}:`);
                    this.updateFiles(files, options);
                }

                if (options.dryRun) {
                    console.log("\n🏷️  Would create git tags for all addons...");
                } else {
                    console.log("\n🏷️  Creating git tags for all addons...");
                }
                for (const [addonName, _files] of addonGroups) {
                    console.log(
                        `\n📦 ${options.dryRun ? "Would create tag for" : "Creating tag for"} ${addonName}:`,
                    );
                    await this.gitManager.createGitTag(
                        options.newVersion,
                        `Bump ${addonName} version to ${options.newVersion}`,
                        addonName,
                        options.dryRun,
                    );
                }
            } else {
                // Auto-increment each addon to individual versions
                console.log(`\nBumping all addons to individual versions:`);
                console.log("=".repeat(60));

                for (const [addonName, files] of addonGroups) {
                    const addonNextVersion = this.getNextVersion(
                        addonName,
                        options.bumpType,
                    );
                    if (addonNextVersion) {
                        console.log(`\n📦 ${addonName}:`);
                        this.updateFiles(files, { ...options, newVersion: addonNextVersion });
                    }
                }

                if (options.dryRun) {
                    console.log("\n🏷️  Would create git tags for all addons...");
                } else {
                    console.log("\n🏷️  Creating git tags for all addons...");
                }
                for (const [addonName, _files] of addonGroups) {
                    const addonNextVersion = this.getNextVersion(
                        addonName,
                        options.bumpType,
                    );
                    if (addonNextVersion) {
                        console.log(
                            `\n📦 ${options.dryRun ? "Would create tag for" : "Creating tag for"} ${addonName}:`,
                        );
                        await this.gitManager.createGitTag(
                            addonNextVersion,
                            `Bump ${addonName} version to ${addonNextVersion}`,
                            addonName,
                            options.dryRun,
                        );
                    }
                }
            }
        }
    }

    /**
     * Updates version numbers in a list of TOC files.
     *
     * @param files - Array of TOC files to update
     * @param options - Configuration options for the update operation
     */
    private updateFiles(files: TocFile[], options: VersionBumpOptions): void {
        if (options.dryRun) {
            console.log("🔍 DRY RUN MODE - No files will be modified");
        }

        for (const file of files) {
            const newContent = this.tocManager.updateVersionInContent(
                file.content,
                options.newVersion,
            );
            const relativePath = file.path.replace("./addons/", "");

            if (options.dryRun) {
                console.log(
                    `  ${relativePath}: ${file.version} → ${options.newVersion}`,
                );
            } else {
                try {
                    Deno.writeTextFileSync(file.path, newContent);
                    console.log(
                        `  ✅ Updated ${relativePath}: ${file.version} → ${options.newVersion}`,
                    );
                } catch (error) {
                    console.error(
                        `  ❌ Failed to update ${relativePath}: ${(error as Error).message}`,
                    );
                }
            }
        }
    }
}
