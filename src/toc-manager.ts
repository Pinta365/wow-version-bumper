import type { TocFile } from "./types.ts";
import type { ConfigManager } from "./config.ts";

/**
 * Manages TOC file operations including reading, parsing, and updating.
 */
export class TocManager {
    private tocFiles: TocFile[] = [];
    private readonly tocPattern = /^## Version: (.+)$/m;
    private readonly tocNamePattern = /^## Name: (.+)$/m;
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
        if (this.configManager.isLocalMode()) {
            this.loadLocalTocFiles();
            return;
        }

        this.loadConfiguredTocFiles();
    }

    /**
     * Loads TOC files using config whitelist/addons directory behavior.
     */
    private loadConfiguredTocFiles(): void {
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
     * Loads TOC files from the current repository in local addon mode.
     */
    private loadLocalTocFiles(): void {
        const root = Deno.cwd();
        const rootAddonName = this.getPathBaseName(root);
        const tocPaths = this.findLocalTocFiles(root);

        if (this.verbose) {
            console.log(`🔎 Local mode scanning for .toc files in: ${root}`);
        }

        for (const filePath of tocPaths) {
            try {
                const content = Deno.readTextFileSync(filePath);
                const versionMatch = content.match(this.tocPattern);
                if (!versionMatch) {
                    if (this.verbose) {
                        console.warn(`⚠️  Skipping ${filePath} (no ## Version)`);
                    }
                    continue;
                }

                const tocNameMatch = content.match(this.tocNamePattern);
                const parsedTocName = tocNameMatch?.[1]?.trim();
                const normalizedTocName = parsedTocName
                    ? parsedTocName.replace(/\|c[0-9a-fA-F]{8}/g, "").replace(/\|r/g, "").trim()
                    : undefined;

                this.tocFiles.push({
                    path: filePath,
                    content,
                    version: versionMatch[1],
                    addonName: normalizedTocName || rootAddonName,
                    tocName: normalizedTocName,
                });
            } catch (error) {
                console.warn(`Warning: Could not read ${filePath}: ${(error as Error).message}`);
            }
        }
    }

    /**
     * Finds TOC files in local mode.
     * Prefers git-aware discovery so ignored files are excluded.
     */
    private findLocalTocFiles(rootDir: string): string[] {
        const gitTocFiles = this.findTocFilesFromGit(rootDir);
        if (gitTocFiles.length > 0) {
            if (this.verbose) {
                console.log(`🧭 Using git-aware file discovery (${gitTocFiles.length} .toc files)`);
            }
            return gitTocFiles;
        }

        if (this.verbose) {
            console.log("🧭 Falling back to recursive scan (git unavailable or no tracked/unignored TOCs found)");
        }
        return this.findTocFilesRecursively(rootDir);
    }

    /**
     * Uses git ls-files so .gitignore is respected in local mode.
     */
    private findTocFilesFromGit(rootDir: string): string[] {
        try {
            const command = new Deno.Command("git", {
                args: ["ls-files", "--cached", "--others", "--exclude-standard", "--", "*.toc", "**/*.toc"],
                cwd: rootDir,
                stdout: "piped",
                stderr: "null",
            });

            const { code, stdout } = command.outputSync();
            if (code !== 0) {
                return [];
            }

            const output = new TextDecoder().decode(stdout).trim();
            if (!output) {
                return [];
            }

            const lines = output
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => line.length > 0)
                .map((relativePath) => `${rootDir}/${relativePath}`.replace(/\\/g, "/"));

            lines.sort((a, b) => a.localeCompare(b));
            return lines;
        } catch {
            return [];
        }
    }

    /**
     * Recursively finds .toc files from a root directory.
     */
    private findTocFilesRecursively(rootDir: string): string[] {
        const ignoreDirs = new Set([".git", ".vscode", "node_modules"]);
        const found: string[] = [];
        const stack: string[] = [rootDir];

        while (stack.length > 0) {
            const current = stack.pop()!;
            let entries: Deno.DirEntry[] = [];
            try {
                entries = Array.from(Deno.readDirSync(current));
            } catch {
                continue;
            }

            for (const entry of entries) {
                const fullPath = `${current}/${entry.name}`;
                if (entry.isDirectory) {
                    if (!ignoreDirs.has(entry.name)) {
                        stack.push(fullPath);
                    }
                    continue;
                }

                if (entry.isFile && entry.name.toLowerCase().endsWith(".toc")) {
                    found.push(fullPath);
                }
            }
        }

        // Prefer deterministic order for stable outputs and tests.
        found.sort((a, b) => a.localeCompare(b));
        return found;
    }

    /**
     * Gets the last path segment in a cross-platform way.
     */
    private getPathBaseName(path: string): string {
        const normalized = path.replace(/\\/g, "/").replace(/\/$/, "");
        const parts = normalized.split("/").filter(Boolean);
        return parts.length > 0 ? parts[parts.length - 1] : "current-addon";
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
