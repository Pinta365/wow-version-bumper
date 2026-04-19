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
     * Stages and commits specific files without creating tags or pushing.
     */
    public async stageAndCommitFiles(
        filePaths: string[],
        commitMessage: string,
        targetAddon?: string,
        dryRun?: boolean,
    ): Promise<void> {
        if (filePaths.length === 0) {
            console.log("ℹ️  No TOC changes detected. Skipping commit step.");
            return;
        }

        const uniqueFilePaths = [...new Set(filePaths)];

        if (dryRun) {
            console.log(`\n📝 Would stage and commit ${uniqueFilePaths.length} TOC file(s):`);
            for (const filePath of uniqueFilePaths) {
                console.log(`  - ${filePath.replace(/\\/g, "/")}`);
            }
            console.log(`📝 Would commit with message: ${commitMessage}`);
            return;
        }

        try {
            const workingDir = this.configManager.getWorkingDirectory(targetAddon);

            if (!(await this.hasGitRepository(workingDir))) {
                console.log("ℹ️  No git repository detected. Skipping interface commit step.");
                return;
            }

            const gitPaths = uniqueFilePaths.map((filePath) => this.toGitRelativePath(filePath, workingDir));

            console.log("\n📝 Staging updated TOC file(s)...");
            await this.runGitArgsInDir(["add", "--", ...gitPaths], workingDir);

            const staged = await this.runGitArgsInDir(["diff", "--cached", "--name-only"], workingDir);
            if (!staged.trim()) {
                console.log("ℹ️  No staged TOC changes to commit.");
                return;
            }

            console.log("📝 Creating commit...");
            await this.runGitArgsInDir(["commit", "-m", commitMessage], workingDir);
            console.log("✅ Interface TOC changes committed (not pushed).");
        } catch (error) {
            console.error(`❌ Git commit step failed: ${(error as Error).message}`);
        }
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
            const workingDir = this.configManager.getWorkingDirectory(targetAddon);

            if (!(await this.hasGitRepository(workingDir))) {
                console.log("ℹ️  No git repository detected. Skipping commit/tag/push steps.");
                return;
            }

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
     * Checks whether a directory is inside a git repository.
     */
    private async hasGitRepository(workingDir: string): Promise<boolean> {
        try {
            const process = new Deno.Command("git", {
                args: ["rev-parse", "--is-inside-work-tree"],
                cwd: workingDir,
                stdout: "piped",
                stderr: "piped",
            });
            const { code, stdout } = await process.output();
            if (code !== 0) {
                return false;
            }
            const output = new TextDecoder().decode(stdout).trim().toLowerCase();
            return output === "true";
        } catch {
            return false;
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

    /**
     * Executes a git command using argument arrays to preserve spacing and quoting.
     */
    private async runGitArgsInDir(args: string[], workingDir: string): Promise<string> {
        const process = new Deno.Command("git", {
            args,
            cwd: workingDir,
            stdout: "piped",
            stderr: "piped",
        });

        const { code, stdout, stderr } = await process.output();
        const output = new TextDecoder().decode(stdout);
        const error = new TextDecoder().decode(stderr);

        if (code !== 0) {
            throw new Error(`Command failed: git ${args.join(" ")}\nError: ${error}`);
        }

        return output;
    }

    /**
     * Converts absolute file paths to paths relative to the working directory for git add.
     */
    private toGitRelativePath(filePath: string, workingDir: string): string {
        const normalizedPath = filePath.replace(/\\/g, "/");
        const normalizedWorkingDir = workingDir.replace(/\\/g, "/").replace(/\/$/, "");
        if (normalizedPath.toLowerCase().startsWith(`${normalizedWorkingDir.toLowerCase()}/`)) {
            return normalizedPath.slice(normalizedWorkingDir.length + 1);
        }
        return normalizedPath;
    }
}
