# WoW Addon Version Bumper

A Deno-based automation tool for managing version numbers across multiple WoW addon `.toc` files. This tool helps maintain version consistency across
all your addons and integrates with Git for automated releases.

> **⚠️ DISCLAMER**: This tool has been developed and tested on Windows. While it should work on other operating systems, some features (particularly Git integration) may behave differently on Linux or macOS. Please report any issues you encounter on non-Windows systems.

## Prerequisites

- [Deno](https://deno.land/) runtime installed
- WoW addons with separate Git repositories
- WoW addons with `.toc` files containing `## Version: x.x.x` lines

## Installation

1. Clone this repository:

```bash
git clone https://github.com/Pinta365/wow-version-bumper
cd wow-version-bumper
```

2. Configure your addons and directory in `config.json` (see Configuration section below for details).

## Usage

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

## Configuration

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

### TOC File Format

Each `.toc` file should contain a version line:

```
## Version: 1.2.3
```
