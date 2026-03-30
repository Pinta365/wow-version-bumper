import type { Config, RuntimeMode } from "./types.ts";

/**
 * Configuration manager for the version bumper.
 * Handles loading and managing configuration settings.
 */
export class ConfigManager {
    private config: Config;
    private verbose: boolean;
    private mode: RuntimeMode;
    private cwd: string;

    constructor(verbose: boolean = false) {
        this.verbose = verbose;
        this.cwd = Deno.cwd();
        this.config = this.loadConfig();
        this.mode = this.detectMode();

        if (this.verbose) {
            console.log(`⚙️  Runtime mode: ${this.mode}`);
        }
    }

    /**
     * Loads configuration from config.json file.
     *
     * Reads the configuration file and sets up whitelisted addons and
     * addons directory path. Falls back to defaults if config file is missing.
     */
    private loadConfig(): Config {
        try {
            const configContent = Deno.readTextFileSync("config.json");
            const config: Config = JSON.parse(configContent);
            if (this.verbose) {
                console.log(`📋 Loaded configuration`);
            }
            return config;
        } catch (error) {
            if (this.verbose) {
                console.warn(
                    `⚠️  Could not load config.json, using local addon mode: ${(error as Error).message}`,
                );
            }
            return {
                whitelistedAddons: [this.getCurrentAddonName()],
                addonsDirectory: this.cwd,
            };
        }
    }

    /**
     * Detects runtime mode based on whether config.json exists.
     */
    private detectMode(): RuntimeMode {
        try {
            const stat = Deno.statSync("config.json");
            if (stat.isFile) {
                return "config";
            }
        } catch {
            // Fall through to local mode.
        }
        return "local";
    }

    /**
     * Gets addon name fallback from current working directory.
     */
    private getCurrentAddonName(): string {
        const normalized = this.cwd.replace(/\\/g, "/").replace(/\/$/, "");
        const parts = normalized.split("/").filter(Boolean);
        return parts.length > 0 ? parts[parts.length - 1] : "current-addon";
    }

    /**
     * Gets the current runtime mode.
     */
    public getMode(): RuntimeMode {
        return this.mode;
    }

    /**
     * Returns true when running in addon-local auto-discovery mode.
     */
    public isLocalMode(): boolean {
        return this.mode === "local";
    }

    /**
     * Gets the whitelisted addons.
     *
     * @returns A copy of the whitelisted addons array
     */
    public getWhitelistedAddons(): string[] {
        return [...this.config.whitelistedAddons];
    }

    /**
     * Gets the addons directory path.
     *
     * @returns The addons directory path
     */
    public getAddonsDirectory(): string {
        return this.config.addonsDirectory;
    }

    /**
     * Resolves working directory for git operations.
     */
    public getWorkingDirectory(targetAddon?: string): string {
        if (this.isLocalMode()) {
            return this.cwd;
        }
        return targetAddon ? `${this.config.addonsDirectory}/${targetAddon}` : this.cwd;
    }

    /**
     * Displays the current whitelist of addons.
     *
     * Shows all addons that are currently whitelisted for processing,
     * along with the total count.
     */
    public showWhitelist(): void {
        if (this.isLocalMode()) {
            console.log("Whitelist is not used in local addon mode.");
            console.log("TOC files are auto-discovered from the current directory.");
            return;
        }

        console.log("Whitelisted addons:");
        console.log("=".repeat(30));
        for (const addon of this.config.whitelistedAddons) {
            console.log(`✅ ${addon}`);
        }
        console.log(`\nTotal: ${this.config.whitelistedAddons.length} addons whitelisted`);
    }

    /**
     * Displays the current configuration settings.
     *
     * Shows the addons directory path and the list of whitelisted addons,
     * along with helpful information about configuration.
     */
    public showConfig(): void {
        console.log("Current Configuration:");
        console.log("=".repeat(30));
        console.log(`⚙️  Mode: ${this.mode}`);
        console.log(`📁 Addons Directory: ${this.config.addonsDirectory}`);
        if (this.isLocalMode()) {
            console.log("📋 Whitelist: auto (local mode)");
        } else {
            console.log(`📋 Whitelisted Addons: ${this.config.whitelistedAddons.length}`);
            for (const addon of this.config.whitelistedAddons) {
                console.log(`  ✅ ${addon}`);
            }
        }
        console.log(`\n💡 To modify the whitelist, edit config.json`);
    }
}
