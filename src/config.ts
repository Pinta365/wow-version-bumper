import type { Config } from "./types.ts";

/**
 * Configuration manager for the version bumper.
 * Handles loading and managing configuration settings.
 */
export class ConfigManager {
    private config: Config;
    private verbose: boolean;

    constructor(verbose: boolean = false) {
        this.verbose = verbose;
        this.config = this.loadConfig();
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
            console.warn(
                `⚠️  Could not load config.json, using defaults: ${(error as Error).message}`,
            );
            return {
                whitelistedAddons: [],
                addonsDirectory: "./addons",
            };
        }
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
     * Displays the current whitelist of addons.
     *
     * Shows all addons that are currently whitelisted for processing,
     * along with the total count.
     */
    public showWhitelist(): void {
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
        console.log(`📁 Addons Directory: ${this.config.addonsDirectory}`);
        console.log(`📋 Whitelisted Addons: ${this.config.whitelistedAddons.length}`);
        for (const addon of this.config.whitelistedAddons) {
            console.log(`  ✅ ${addon}`);
        }
        console.log(`\n💡 To modify the whitelist, edit config.json`);
    }
}
