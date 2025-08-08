import type { TocFile } from "./types.ts";
import type { ConfigManager } from "./config.ts";

/**
 * Manages TOC file operations including reading, parsing, and updating.
 */
export class TocManager {
    private tocFiles: TocFile[] = [];
    private readonly tocPattern = /^## Version: (.+)$/m;
    private configManager: ConfigManager;
    private verbose: boolean;

    constructor(configManager: ConfigManager, verbose: boolean = false) {
        this.configManager = configManager;
        this.verbose = verbose;
        this.loadAllTocFiles();
    }

    /**
     * Scans the addons directory and loads all TOC files from whitelisted addons.
     *
     * This method reads the addons directory, filters for whitelisted addons,
     * and parses all .toc files to extract version information.
     */
    private loadAllTocFiles(): void {
        try {
            const addonsDirectory = this.configManager.getAddonsDirectory();
            const whitelistedAddons = this.configManager.getWhitelistedAddons();

            const allAddonDirs = Array.from(Deno.readDirSync(addonsDirectory))
                .filter((entry) => entry.isDirectory)
                .map((entry) => entry.name);

            const addonDirs = allAddonDirs.filter((dir) => whitelistedAddons.includes(dir));
            const excludedDirs = allAddonDirs.filter((dir) => !whitelistedAddons.includes(dir));

            if (this.verbose) {
                console.log(`Whitelisted addons: ${addonDirs.join(", ")}`);
                if (excludedDirs.length > 0) {
                    console.log(
                        `📁 Found ${excludedDirs.length} excluded addons (not shown)`,
                    );
                }
            }

            for (const addonDir of addonDirs) {
                const addonPath = `${addonsDirectory}/${addonDir}`;

                try {
                    const tocFiles = Array.from(Deno.readDirSync(addonPath))
                        .filter((entry) => entry.isFile && entry.name.endsWith(".toc"))
                        .map((entry) => entry.name);

                    if (this.verbose) {
                        console.log(
                            `Found .toc files in ${addonDir}: ${tocFiles.join(", ")}`,
                        );
                    }

                    for (const tocFile of tocFiles) {
                        const filePath = `${addonPath}/${tocFile}`;
                        try {
                            const content = Deno.readTextFileSync(filePath);
                            const match = content.match(this.tocPattern);
                            if (match) {
                                this.tocFiles.push({
                                    path: filePath,
                                    content,
                                    version: match[1],
                                    addonName: addonDir,
                                });
                            } else {
                                console.warn(`Warning: No version found in ${filePath}`);
                            }
                        } catch (error) {
                            console.warn(
                                `Warning: Could not read ${filePath}: ${(error as Error).message}`,
                            );
                        }
                    }
                } catch (error) {
                    console.warn(
                        `Warning: Could not read directory ${addonPath}: ${(error as Error).message}`,
                    );
                }
            }
        } catch (error) {
            console.error(
                `Error reading addons directory: ${(error as Error).message}`,
            );
            Deno.exit(1);
        }
    }

    /**
     * Updates the version number in TOC file content.
     *
     * @param content - The original TOC file content
     * @param newVersion - The new version to set
     * @returns The updated content with the new version
     */
    public updateVersionInContent(content: string, newVersion: string): string {
        return content.replace(this.tocPattern, `## Version: ${newVersion}`);
    }

    /**
     * Gets all TOC files.
     *
     * @returns Array of all TOC files
     */
    public getTocFiles(): TocFile[] {
        return [...this.tocFiles];
    }

    /**
     * Gets TOC files for a specific addon.
     *
     * @param addonName - The name of the addon
     * @returns Array of TOC files for the specified addon
     */
    public getTocFilesForAddon(addonName: string): TocFile[] {
        return this.tocFiles.filter((file) => file.addonName === addonName);
    }

    /**
     * Lists all available addons found in the TOC files.
     *
     * Displays a list of all addons that have TOC files, along with
     * the count of TOC files for each addon.
     */
    public listAddons(): void {
        const addons = [...new Set(this.tocFiles.map((f) => f.addonName))];
        console.log("Available addons:");
        console.log("=".repeat(30));
        for (const addon of addons) {
            const files = this.tocFiles.filter((f) => f.addonName === addon);
            console.log(`📦 ${addon} (${files.length} .toc files)`);
        }
    }
}
