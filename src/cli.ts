import type { InterfaceUpdateOptions, VersionBumpOptions } from "./types.ts";
import { VersionBumper } from "./version-bumper.ts";

/**
 * Handles command line interface operations and argument parsing.
 */
export class CLI {
    private bumper: VersionBumper;

    constructor(verbose: boolean = false) {
        this.bumper = new VersionBumper(verbose);
    }

    /**
     * Shows the help information and usage examples.
     */
    private showHelp(): void {
        console.log("WoW Addon TOC Bumper");
        console.log("=".repeat(40));
        console.log("\nAvailable Tasks:");
        console.log("  deno task help                              - Show this help information");
        console.log("  deno task list                              - List available addons");
        console.log("  deno task whitelist                         - Show whitelisted addons");
        console.log("  deno task config                            - Show current configuration");
        console.log("  deno task show                              - Show current versions of all addons");
        console.log("  deno task bump <version> [addon]            - Bump to specific version");
        console.log("  deno task bump all                          - Bump all addons (patch version)");
        console.log("  deno task bump all --major                  - Bump all addons major version");
        console.log("  deno task bump all --minor                  - Bump all addons minor version");
        console.log("  deno task bump [addon]                      - Bump specific addon (patch version)");
        console.log("  deno task bump [addon] --major              - Bump specific addon major version");
        console.log("  deno task bump [addon] --minor              - Bump specific addon minor version");
        console.log("  deno task bump [addon] --dry                - Dry run (no changes)");
        console.log("  deno task bump [addon] --verbose            - Verbose output");
        console.log("  deno task bump patch|minor|major            - Bump current addon by bump type");
        console.log("  deno task interface <interface> [addon]     - Add interface value(s)");
        console.log("  deno task interface <values> [addon] --overwrite - Replace interface list");

        console.log("\nExamples:");
        console.log("  deno task show");
        console.log("  deno task list");
        console.log("  deno task whitelist");
        console.log("  deno task config");
        console.log("  deno task bump 1.2.3 YourAddonName");
        console.log("  deno task bump 1.2.3");
        console.log("  deno task bump all --major --dry");
        console.log("  deno task bump YourAddonName --major --dry");
        console.log("  deno task bump YourAddonName --verbose");
        console.log("  deno task bump all --minor");
        console.log("  deno task bump patch");
        console.log("  deno task bump patch --dry");
        console.log("  deno task interface 120005");
        console.log("  deno task interface 120001,120005 YourAddonName --overwrite");
    }

    /**
     * Parses bump command arguments and returns the options.
     *
     * @param args - Command line arguments
     * @returns Parsed version bump options
     */
    private parseBumpArgs(args: string[]): VersionBumpOptions {
        const positionalArgs = args.filter((arg) => !arg.startsWith("--"));
        let newVersion: string;
        let targetAddon: string | undefined;

        let bumpType: "major" | "minor" | "patch" = "patch";
        if (args.includes("--major")) {
            bumpType = "major";
        } else if (args.includes("--minor")) {
            bumpType = "minor";
        } else if (args.includes("--patch")) {
            bumpType = "patch";
        }

        // Support shorthand: `bump patch`, `bump minor`, `bump major`.
        const bumpTypeShorthand = positionalArgs[0];
        if (["major", "minor", "patch"].includes(bumpTypeShorthand)) {
            bumpType = bumpTypeShorthand as "major" | "minor" | "patch";
            positionalArgs.shift();
        }

        if (positionalArgs.length === 0) {
            console.log(
                "🔍 No version provided, auto-incrementing highest version...",
            );
            const nextVersion = this.bumper.getNextVersion(undefined, bumpType);
            if (!nextVersion) {
                console.error("❌ Could not determine current version to increment");
                throw new Error("Could not determine current version to increment");
            }
            newVersion = nextVersion;
            console.log(`📈 Auto-incrementing to: ${newVersion}`);
        } else {
            if (/^\d+\.\d+\.\d+$/.test(positionalArgs[0])) {
                newVersion = positionalArgs[0];
                targetAddon = positionalArgs[1];
            } else if (positionalArgs[0] === "all") {
                console.log("🔍 Bumping all addons to individual versions...");
                newVersion = "auto";
            } else {
                targetAddon = positionalArgs[0];

                if (positionalArgs.length >= 2 && /^\d+\.\d+\.\d+$/.test(positionalArgs[1])) {
                    newVersion = positionalArgs[1];
                } else {
                    console.log(
                        "🔍 No version provided for specific addon, auto-incrementing...",
                    );
                    const nextVersion = this.bumper.getNextVersion(targetAddon, bumpType);
                    if (!nextVersion) {
                        console.error(
                            "❌ Could not determine current version to increment",
                        );
                        throw new Error("Could not determine current version to increment");
                    }
                    newVersion = nextVersion;
                    console.log(`📈 Auto-incrementing to: ${newVersion}`);
                }
            }
        }

        const dryRun = args.includes("--dry");
        const verbose = args.includes("--verbose");

        return {
            newVersion: newVersion === "auto" ? "" : newVersion,
            dryRun,
            targetAddon,
            bumpType,
            commitMessage: targetAddon ? `Bump ${targetAddon} version to ${newVersion}` : `Bump version to ${newVersion}`,
            verbose,
        };
    }

    /**
     * Parses interface command arguments and returns options.
     */
    private parseInterfaceArgs(args: string[]): InterfaceUpdateOptions {
        const positionalArgs = args.filter((arg) => !arg.startsWith("--"));
        if (positionalArgs.length === 0) {
            throw new Error("Missing interface value(s). Example: deno task interface 120005 [addon]");
        }

        const interfaceInput = positionalArgs[0];
        const targetAddonArg = positionalArgs[1];
        const targetAddon = targetAddonArg === "all" ? undefined : targetAddonArg;
        const overwrite = args.includes("--overwrite");
        const dryRun = args.includes("--dry");
        const verbose = args.includes("--verbose");

        const interfaces = interfaceInput
            .split(",")
            .map((value) => value.trim())
            .filter((value) => value.length > 0);

        if (interfaces.length === 0) {
            throw new Error("No interface values provided");
        }

        for (const value of interfaces) {
            if (!/^\d+$/.test(value)) {
                throw new Error(`Invalid interface value: ${value}. Expected numeric values like 120005`);
            }
        }

        return {
            interfaces,
            overwrite,
            dryRun,
            targetAddon,
            verbose,
        };
    }

    /**
     * Executes the main CLI logic based on command line arguments.
     *
     * @param args - Command line arguments
     */
    public async run(args: string[]): Promise<void> {
        if (args.length === 0) {
            this.showHelp();
            return;
        }

        const command = args[0];

        try {
            if (command === "show") {
                const targetAddon = args[1];
                this.bumper.showCurrentVersions(targetAddon);
            } else if (command === "list") {
                this.bumper.listAddons();
            } else if (command === "whitelist") {
                this.bumper.showWhitelist();
            } else if (command === "config") {
                this.bumper.showConfig();
            } else if (command === "bump") {
                const options = this.parseBumpArgs(args.slice(1));
                // Create a new bumper with verbose flag if needed
                if (options.verbose) {
                    this.bumper = new VersionBumper(true);
                }
                await this.bumper.bumpVersion(options);
            } else if (command === "interface") {
                const options = this.parseInterfaceArgs(args.slice(1));
                if (options.verbose) {
                    this.bumper = new VersionBumper(true);
                }
                this.bumper.updateInterface(options);
            } else {
                console.error(
                    "❌ Unknown command. Use 'show', 'list', 'whitelist', 'config', 'bump', or 'interface'",
                );
            }
        } catch (error) {
            console.error(`❌ Error: ${(error as Error).message}`);
            Deno.exit(1);
        }
    }
}
