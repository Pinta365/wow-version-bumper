import type { ConfigManager } from "./config.ts";

/**
 * Manages git operations including commits, tags, and pushes.
 */
export class GitManager {
    private configManager: ConfigManager;

    constructor(configManager: ConfigManager) {
        this.configManager = configManager;
    }

    /**
     * Creates a git tag for the version bump operation.
     *
     * Performs git operations including committing changes, creating tags,
     * and pushing to remote repository.
     *
     * @param version - The version number for the tag
     * @param commitMessage - Optional custom commit message
     * @param targetAddon - Optional addon name for targeted operations
     * @param dryRun - Whether to perform a dry run without making changes
     */
    public async createGitTag(
        version: string,
        commitMessage?: string,
        targetAddon?: string,
        dryRun?: boolean,
    ): Promise<void> {
        const tagName = version;

        if (dryRun) {
            console.log(`\n🏷️  Would create tag: ${tagName}`);
            console.log(
                `📝 Would commit with message: ${
                    commitMessage || (targetAddon ? `Bump ${targetAddon} version to ${version}` : `Bump version to ${version}`)
                }`,
            );
            console.log(`📤 Would push changes and tag to remote`);
            return;
        }

        try {
            const workingDir = targetAddon ? `${this.configManager.getAddonsDirectory()}/${targetAddon}` : Deno.cwd();

            const status = await this.runCommandInDir(
                "git status --porcelain",
                workingDir,
            );
            if (status.trim()) {
                console.log("\n📝 Committing changes...");
                await this.runCommandInDir("git add .", workingDir);
                const message = commitMessage ||
                    (targetAddon ? `Bump ${targetAddon} version to ${version}` : `Bump version to ${version}`);
                await this.runCommandInDir(`git commit -m ${message}`, workingDir);
            }

            console.log(`\n🏷️  Creating tag: ${tagName}`);
            await this.runCommandInDir(`git tag ${tagName}`, workingDir);

            console.log("📤 Pushing changes and tag...");
            await this.runCommandInDir(`git push origin HEAD ${tagName}`, workingDir);

            console.log("✅ Version bump completed and pushed!");
            console.log(
                `\n🚀 GitHub Actions will now create a release for version ${version}`,
            );
        } catch (error) {
            console.error(`❌ Git operations failed: ${(error as Error).message}`);
        }
    }

    /**
     * Executes a command in a specific directory.
     *
     * Handles special cases for git commit commands and provides
     * proper error handling for command execution.
     *
     * @param command - The command to execute
     * @param workingDir - The working directory for command execution
     * @returns The command output as a string
     * @throws Error if the command fails
     */
    private async runCommandInDir(
        command: string,
        workingDir: string,
    ): Promise<string> {
        if (command.startsWith("git commit")) {
            const parts = command.split(" ");
            const messageIndex = parts.findIndex((arg) => arg === "-m");
            if (messageIndex !== -1 && messageIndex + 1 < parts.length) {
                const message = parts.slice(messageIndex + 1).join(" ");
                const process = new Deno.Command("git", {
                    args: ["commit", "-m", message],
                    cwd: workingDir,
                    stdout: "piped",
                    stderr: "piped",
                });

                const { code, stdout, stderr } = await process.output();
                const output = new TextDecoder().decode(stdout);
                const error = new TextDecoder().decode(stderr);

                if (code !== 0) {
                    throw new Error(`Command failed: ${command}\nError: ${error}`);
                }

                return output;
            }
        }

        const cmd = command.split(" ");
        const process = new Deno.Command(cmd[0], {
            args: cmd.slice(1),
            cwd: workingDir,
            stdout: "piped",
            stderr: "piped",
        });

        const { code, stdout, stderr } = await process.output();
        const output = new TextDecoder().decode(stdout);
        const error = new TextDecoder().decode(stderr);

        if (code !== 0) {
            throw new Error(`Command failed: ${command}\nError: ${error}`);
        }

        return output;
    }
}
