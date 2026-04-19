# WoW Addon TOC Bumper

A Deno-based automation tool for managing version numbers across multiple WoW addon `.toc` files. This tool helps maintain version consistency across
all your addons and integrates with Git for automated releases.

> **⚠️ DISCLAIMER**: This tool has been developed and tested on Windows. While it should work on other operating systems, some features (particularly Git integration) may behave differently on Linux or macOS. Please report any issues you encounter on non-Windows systems.

## Prerequisites

- [Deno](https://deno.land/) runtime installed
- WoW addons with separate Git repositories
- WoW addons with `.toc` files containing `## Version: x.x.x` lines

## Runtime Modes

The tool now supports two modes:

1. `config` mode: if `config.json` exists in the current working directory.
2. `local` mode: if no `config.json` is found. TOC files are auto-discovered from the current directory.

This keeps existing multi-addon workflows intact while making addon-local usage simple.

## Usage

### Recommended (JSR CLI, no local install)

Run directly from your addon folder:

```bash
deno run --allow-read --allow-write --allow-run=git jsr:@pinta365/toc-bumper/cli bump patch
```

Read-only version overview:

```bash
deno run --allow-read --allow-run=git jsr:@pinta365/toc-bumper/cli show
```

You can append flags like `--dry`, `--verbose`, `--major`, or `--minor`.

### Available Tasks

```bash
# Show help and available commands
deno task help

# List all available addons
deno task list

# Show whitelisted addons
deno task whitelist

# Show current configuration
deno task config

# Show current versions of all addons
deno task show

# Add interface value(s) to TOC Interface list
deno task interface 120005

# Replace Interface list entirely
deno task interface 120001,120005 --overwrite
```

> **Note**: By default, all bump operations include git integration (commit, tag, and push). Use `--dry` flag to preview changes without making any
> modifications.

> **Note**: Use `--verbose` flag to see detailed boot-up information.

#### Manual Version Bump

```bash
# Bump specific addon to version
deno task bump 1.2.3 YourAddonName

# Bump all addons to specific version
deno task bump 1.2.3

# Dry run - preview changes without writing files or git operations use the --dry flag
```

#### Automatic Semantic Version Bump

```bash
# Bump current addon if running from a standalone addon folder (with minimal deno.json).
deno task bump patch
deno task bump minor
deno task bump major

# Bump specific addon (patch version)
deno task bump YourAddonName

# Bump specific addon (major version)
deno task bump YourAddonName --major

# Bump specific addon (minor version)
deno task bump YourAddonName --minor

# Bump all addons (patch version)
deno task bump all

# Bump all addons (major version)
deno task bump all --major

# Bump all addons (minor version)
deno task bump all --minor

# Dry run - preview changes without writing files or git operations use the --dry flag
```

#### TOC Interface Updates

```bash
# Add one interface value to the base TOC for current addon or all addons
deno task interface 120005

# Add multiple interface values to base TOC files only
deno task interface 120005,120007

# Target a specific addon in config mode
deno task interface 120005 YourAddonName

# Replace the entire interface list (overwrite mode)
deno task interface 120001,120005 YourAddonName --overwrite

# Dry run to preview changes only
deno task interface 120005 --dry
```

Default behavior appends missing interface values and keeps existing ones.
Interface updates target only base TOC files in the format `<foldername>.toc`.
Flavored TOCs such as `<foldername>-something.toc` are intentionally skipped.
Use `--overwrite` to replace the entire `## Interface:` list.

## Addon-Local Setup (Recommended)

In each addon repository, create a minimal `deno.json`:

```json
{
    "tasks": {
        "bump": "deno run --allow-read --allow-write --allow-run=git jsr:@pinta365/toc-bumper/cli bump",
        "show": "deno run --allow-read --allow-run=git jsr:@pinta365/toc-bumper/cli show"
    }
}
```

Then run:

```bash
deno task bump patch
```

OR, just run the deno run command directly instead of defining them into deno tasks.

This is equivalent to running the JSR CLI command directly without defining tasks.

In local mode, the CLI scans the current repository for `.toc` files and reads `## Version:` directly from those files.

If no git repository is detected, file updates still happen and git commit/tag/push steps are skipped.

For `show`, `--allow-run=git` lets discovery respect `.gitignore`. Without it, discovery falls back to recursive scanning.

## Configuration

This started as a personal utility for my own addons, so some config examples and defaults may reflect that context.
Replace addon names and paths with your own setup if cloning the repo.

Edit `config.json` to customize the tool:

```json
{
    "whitelistedAddons": ["YourAddon1", "YourAddon2"],
    "addonsDirectory": "./addons"
}
```

### Configuration Options

- `whitelistedAddons`: Array of addon names/folders to manage (only these addons will be processed)
- `addonsDirectory`: Path to your WoW addons repository directory

Configuration is optional in addon-local mode.

### TOC File Format

Each `.toc` file should contain a version line:

```
## Version: 1.2.3
```
