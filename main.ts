import { CLI } from "./src/cli.ts";

/**
 * Main entry point for the WoW Addon Version Bumper application.
 *
 * Parses command line arguments and executes the appropriate operations
 * based on the provided commands. Supports various operations including
 * showing versions, listing addons, and performing version bumps.
 *
 * Available commands:
 * - `show [addon]` - Show current versions
 * - `list` - List available addons
 * - `whitelist` - Show whitelisted addons
 * - `config` - Show current configuration
 * - `bump <version> [addon]` - Bump to specific version
 * - `bump all --major/minor/patch` - Bump all addons
 * - `bump [addon] --major/minor/patch` - Bump specific addon
 * - `bump [addon] --dry` - Dry run mode
 * - `bump [addon] --verbose` - Verbose output mode
 */
async function main() {
    const verbose = Deno.args.includes("--verbose");
    const cli = new CLI(verbose);
    await cli.run(Deno.args);
}

if (import.meta.main) {
    main();
}
