const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const artifactsDir = path.join(repoRoot, 'docs', 'verification-artifacts');

if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

function getGitCommit() {
  try {
    const { execSync } = require('child_process');
    return execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim();
  } catch (e) {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    return `v${pkg.version} (branch master, uncommitted repository state)`;
  }
}

const commands = [
  {
    name: 'typecheck',
    command: 'npm',
    args: ['--prefix', 'backend', 'run', 'typecheck'],
    filename: 'typecheck.raw.txt'
  },
  {
    name: 'build-backend',
    command: 'npm',
    args: ['--prefix', 'backend', 'run', 'build'],
    filename: 'build-backend.raw.txt'
  },
  {
    name: 'test-portal',
    command: 'npm',
    args: ['--prefix', 'backend', 'run', 'test:portal'],
    filename: 'test-portal.raw.txt'
  },
  {
    name: 'test-regression',
    command: 'npm',
    args: ['--prefix', 'backend', 'test'],
    filename: 'test-regression.raw.txt'
  },
  {
    name: 'smoke-manual',
    command: 'npm',
    args: ['--prefix', 'backend', 'run', 'smoke:manual'],
    filename: 'smoke-manual.raw.txt'
  },
  {
    name: 'build-frontend',
    command: 'npm',
    args: ['--prefix', 'frontend', 'run', 'build'],
    filename: 'build-frontend.raw.txt'
  }
];

async function runCommand(cmdConfig) {
  const fullCommand = `${cmdConfig.command} ${cmdConfig.args.join(' ')}`;
  console.log(`\n======================================================`);
  console.log(`RUNNING: ${fullCommand}`);
  console.log(`======================================================`);

  const startTime = new Date().toISOString();
  const gitCommit = getGitCommit();
  let stdout = '';
  let stderr = '';

  const isWindows = process.platform === 'win32';
  const executable = isWindows ? `${cmdConfig.command}.cmd` : cmdConfig.command;

  return new Promise((resolve) => {
    const proc = spawn(executable, cmdConfig.args, {
      cwd: repoRoot,
      env: { ...process.env, CI: 'true', FORCE_COLOR: '0' },
      shell: isWindows
    });

    proc.stdout.on('data', (data) => {
      const str = data.toString();
      stdout += str;
      process.stdout.write(str);
    });

    proc.stderr.on('data', (data) => {
      const str = data.toString();
      stderr += str;
      process.stderr.write(str);
    });

    proc.on('close', (code) => {
      const endTime = new Date().toISOString();
      const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
      const exitCode = code === null ? 1 : code;

      console.log(`\nCOMPLETED: ${fullCommand}`);
      console.log(`EXIT CODE: ${exitCode}`);
      console.log(`DURATION: ${durationMs}ms`);

      const rawContent = [
        `================================================================================`,
        `COMMAND: ${fullCommand}`,
        `DIRECTORY: ${repoRoot}`,
        `GIT COMMIT: ${gitCommit}`,
        `START TIMESTAMP: ${startTime}`,
        `END TIMESTAMP: ${endTime}`,
        `DURATION: ${durationMs}ms (${(durationMs / 1000).toFixed(2)}s)`,
        `EXIT CODE: ${exitCode}`,
        `================================================================================`,
        `\n--- STDOUT ---\n`,
        stdout,
        `\n--- STDERR ---\n`,
        stderr,
        `\n--- COMBINED RAW STREAM ---\n`,
        stdout + (stderr ? `\n[STDERR]\n${stderr}` : '')
      ].join('\n');

      const targetPath = path.join(artifactsDir, cmdConfig.filename);
      fs.writeFileSync(targetPath, rawContent, 'utf8');
      console.log(`SAVED ARTIFACT: ${targetPath} (${fs.statSync(targetPath).size} bytes)`);

      resolve({
        name: cmdConfig.name,
        command: fullCommand,
        gitCommit,
        startTime,
        endTime,
        durationMs,
        exitCode,
        targetFile: targetPath,
        stdoutLength: stdout.length,
        stderrLength: stderr.length
      });
    });
  });
}

async function main() {
  const filter = process.argv[2];
  const targetCommands = filter ? commands.filter(c => c.name === filter) : commands;

  const results = [];
  for (const cmd of targetCommands) {
    const res = await runCommand(cmd);
    results.push(res);
  }

  const summaryPath = path.join(artifactsDir, 'verification_summary.json');
  let existingSummary = [];
  if (fs.existsSync(summaryPath)) {
    try {
      existingSummary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    } catch (e) {}
  }

  // Merge or update results
  for (const res of results) {
    const idx = existingSummary.findIndex(item => item.name === res.name);
    if (idx >= 0) {
      existingSummary[idx] = res;
    } else {
      existingSummary.push(res);
    }
  }

  fs.writeFileSync(summaryPath, JSON.stringify(existingSummary, null, 2), 'utf8');
  console.log(`\nUpdated summary at: ${summaryPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
