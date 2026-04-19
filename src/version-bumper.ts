import type { InterfaceUpdateOptions, TocFile, VersionBumpOptions } from "./types.ts";
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
     * Returns true when running in local addon auto-discovery mode.
     */
    public isLocalMode(): boolean {
        return this.configManager.isLocalMode();
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
        if (!options.targetAddon && this.isLocalMode()) {
            const addonNames = [...new Set(this.tocManager.getTocFiles().map((file) => file.addonName))];
            if (addonNames.length > 1) {
                console.error("❌ Multiple addons detected in local mode.");
                console.error(`   Found: ${addonNames.join(", ")}`);
                console.error("   Specify a target addon explicitly: deno task bump <addon>");
                return;
            }
        }

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
     * Updates TOC Interface values in targeted addon files.
     */
    public async updateInterface(options: InterfaceUpdateOptions): Promise<void> {
        if (!options.targetAddon && this.isLocalMode()) {
            const addonNames = [...new Set(this.tocManager.getTocFiles().map((file) => file.addonName))];
            if (addonNames.length > 1) {
                console.error("❌ Multiple addons detected in local mode.");
                console.error(`   Found: ${addonNames.join(", ")}`);
                console.error("   Specify a target addon explicitly: deno task interface <interface> <addon>");
                return;
            }
        }

        if (options.targetAddon) {
            const filesToUpdate = this.tocManager
                .getTocFilesForAddon(options.targetAddon)
                .filter((file) => this.isBaseTocFile(file));
            if (filesToUpdate.length === 0) {
                console.error(`❌ No base .toc file found for addon: ${options.targetAddon}`);
                console.error(`   Expected format: ${options.targetAddon}.toc`);
                return;
            }

            const action = options.overwrite ? "Overwriting" : "Adding";
            console.log(`\n${action} interface values for ${options.targetAddon}: ${options.interfaces.join(", ")}`);
            console.log("=".repeat(60));
            const changedFiles = this.updateInterfaceFiles(filesToUpdate, options);

            if (options.commit) {
                const commitMessage = this.buildInterfaceCommitMessage(options.targetAddon, options);
                await this.gitManager.stageAndCommitFiles(
                    changedFiles,
                    commitMessage,
                    options.targetAddon,
                    options.dryRun,
                );
            }
            return;
        }

        const allTocFiles = this.tocManager.getTocFiles();
        const addonGroups = new Map<string, TocFile[]>();
        for (const file of allTocFiles) {
            if (!addonGroups.has(file.addonName)) {
                addonGroups.set(file.addonName, []);
            }
            addonGroups.get(file.addonName)!.push(file);
        }

        const action = options.overwrite ? "Overwriting" : "Adding";
        console.log(`\n${action} interface values for all addons: ${options.interfaces.join(", ")}`);
        console.log("=".repeat(60));

        for (const [addonName, files] of addonGroups) {
            const baseFiles = files.filter((file) => this.isBaseTocFile(file));
            if (baseFiles.length === 0) {
                console.warn(`  ⚠️  Skipping ${addonName}: no base TOC file found (expected ${addonName}.toc)`);
                continue;
            }
            console.log(`\n📦 ${addonName}:`);
            const changedFiles = this.updateInterfaceFiles(baseFiles, options);

            if (options.commit) {
                const commitMessage = this.buildInterfaceCommitMessage(addonName, options);
                await this.gitManager.stageAndCommitFiles(
                    changedFiles,
                    commitMessage,
                    addonName,
                    options.dryRun,
                );
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
            const relativePath = this.toRelativePath(file.path);

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

    /**
     * Updates interface values in a list of TOC files.
     */
    private updateInterfaceFiles(files: TocFile[], options: InterfaceUpdateOptions): string[] {
        const changedFiles: string[] = [];

        if (options.dryRun) {
            console.log("🔍 DRY RUN MODE - No files will be modified");
        }

        for (const file of files) {
            const relativePath = this.toRelativePath(file.path);

            try {
                const currentInterfaces = this.tocManager.getInterfacesFromContent(file.content);
                if (currentInterfaces.length === 0) {
                    console.warn(`  ⚠️  Skipping ${relativePath}: no ## Interface line found`);
                    continue;
                }

                const nextInterfaces = options.overwrite
                    ? this.tocManager.normalizeInterfaceValues(options.interfaces.join(","))
                    : this.tocManager.normalizeInterfaceValues([...currentInterfaces, ...options.interfaces].join(","));

                const oldValue = currentInterfaces.join(", ");
                const newValue = nextInterfaces.join(", ");
                const newContent = this.tocManager.updateInterfaceInContent(file.content, nextInterfaces);

                if (oldValue === newValue) {
                    console.log(`  ℹ️  No change ${relativePath}: ${oldValue}`);
                    continue;
                }

                if (options.dryRun) {
                    console.log(`  ${relativePath}: ${oldValue} → ${newValue}`);
                    changedFiles.push(file.path);
                } else {
                    Deno.writeTextFileSync(file.path, newContent);
                    console.log(`  ✅ Updated ${relativePath}: ${oldValue} → ${newValue}`);
                    changedFiles.push(file.path);
                }
            } catch (error) {
                console.error(`  ❌ Failed to update ${relativePath}: ${(error as Error).message}`);
            }
        }

        return changedFiles;
    }

    /**
     * Converts a path to a human-friendly cwd-relative form.
     */
    private toRelativePath(filePath: string): string {
        const cwd = Deno.cwd().replace(/\\/g, "/");
        const normalized = filePath.replace(/\\/g, "/");
        if (normalized.startsWith(`${cwd}/`)) {
            return normalized.slice(cwd.length + 1);
        }
        return normalized;
    }

    /**
     * Returns true only for base TOC files in the form <addonName>.toc.
     *
     * Flavored TOCs like <addonName>-something.toc are intentionally excluded.
     */
    private isBaseTocFile(file: TocFile): boolean {
        const normalizedPath = file.path.replace(/\\/g, "/");
        const fileName = normalizedPath.split("/").pop() ?? "";
        return fileName.toLowerCase() === `${file.addonName}.toc`.toLowerCase();
    }

    /**
     * Builds a default commit message for interface updates.
     */
    private buildInterfaceCommitMessage(addonName: string, options: InterfaceUpdateOptions): string {
        const verb = options.overwrite ? "Set" : "Update";
        const values = options.interfaces.join(",");
        return `${verb} ${addonName} interface to ${values}`;
    }
}
