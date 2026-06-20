import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const guardScript = join(__dirname, '..', 'plugins', 'gemini', 'hooks', 'guard-filter.mjs');

function runGuard(command) {
  const input = JSON.stringify({ tool_input: { command } });
  return runGuardRaw(input).json;
}

/** Run the guard with an arbitrary (possibly malformed) stdin payload. */
function runGuardRaw(input) {
  const result = spawnSync('node', [guardScript], {
    input,
    encoding: 'utf-8',
    timeout: 5000,
  });
  return { status: result.status, json: JSON.parse(result.stdout.trim() || '{}') };
}

describe('guard-filter', () => {
  describe('should trigger on package install commands', () => {
    const triggers = [
      ['npm install lodash', 'JavaScript/TypeScript'],
      ['yarn add react', 'JavaScript/TypeScript'],
      ['pnpm add express', 'JavaScript/TypeScript'],
      ['pip install requests', 'Python'],
      ['pip3 install flask', 'Python'],
      ['poetry add django', 'Python'],
      ['cargo add serde', 'Rust'],
      ['go get github.com/gin-gonic/gin', 'Go'],
      ['composer require laravel/framework', 'PHP'],
      ['gem install rails', 'Ruby'],
      ['brew install wget', 'System'],
      ['bun add hono', 'JavaScript/TypeScript'],
      ['uv add httpx', 'Python'],
      ['apt install nginx', 'System'],
      ['apt-get install curl', 'System'],
    ];

    for (const [cmd, eco] of triggers) {
      it(`triggers on: ${cmd}`, () => {
        const out = runGuard(cmd);
        assert.equal(out.type, 'prompt');
        assert.match(out.prompt, new RegExp(`Gemini ${eco} Guard`));
      });
    }
  });

  describe('should NOT trigger on non-package commands', () => {
    const passThrough = [
      'docker build .',
      'kubectl apply -f deploy.yaml',
      'terraform init',
      'aws s3 ls',
      'gcloud compute instances list',
      'git commit -m "test"',
      'ls -la',
      'node server.js',
      'npx create-react-app my-app',
      'pip download mypackage-installer',
      'echo "run npm install later"',
    ];

    for (const cmd of passThrough) {
      it(`passes through: ${cmd}`, () => {
        const out = runGuard(cmd);
        assert.equal(out.type, undefined);
      });
    }
  });

  describe('edge cases', () => {
    it('handles empty command', () => {
      const out = runGuard('');
      assert.equal(out.type, undefined);
    });

    it('handles command with only manager name', () => {
      const out = runGuard('npm');
      assert.equal(out.type, undefined);
    });

    it('npm run does not trigger', () => {
      const out = runGuard('npm run build');
      assert.equal(out.type, undefined);
    });

    it('npm test does not trigger', () => {
      const out = runGuard('npm test');
      assert.equal(out.type, undefined);
    });
  });

  describe('package extraction', () => {
    // Capture only the package list inside the `/gemini:audit <pkgs>` suggestion
    // (the "About to run" line echoes the full command verbatim).
    function auditPkgs(cmd) {
      const out = runGuard(cmd);
      const m = out.prompt.match(/\/gemini:audit ([^`]+)`/);
      return m ? m[1] : null;
    }

    it('lists a single package', () => {
      assert.equal(auditPkgs('npm install lodash'), 'lodash');
    });

    it('lists multiple packages', () => {
      assert.equal(auditPkgs('npm install lodash react'), 'lodash, react');
    });

    it('strips flags from the package list', () => {
      assert.equal(auditPkgs('npm install -D typescript'), 'typescript');
    });

    it('ignores chained commands after a shell operator', () => {
      assert.equal(auditPkgs('npm install express && rm -rf /tmp/x'), 'express');
    });
  });

  describe('malformed / empty hook stdin (fail open)', () => {
    it('emits {} and exits 0 on empty stdin', () => {
      const { status, json } = runGuardRaw('');
      assert.equal(status, 0);
      assert.equal(json.type, undefined);
    });

    it('emits {} and exits 0 on non-JSON stdin', () => {
      const { status, json } = runGuardRaw('{ this is not json');
      assert.equal(status, 0);
      assert.equal(json.type, undefined);
    });

    it('does not crash when command is missing', () => {
      const { status, json } = runGuardRaw(JSON.stringify({ tool_input: {} }));
      assert.equal(status, 0);
      assert.equal(json.type, undefined);
    });

    it('does not crash when command is a non-string', () => {
      const { status, json } = runGuardRaw(JSON.stringify({ tool_input: { command: 42 } }));
      assert.equal(status, 0);
      assert.equal(json.type, undefined);
    });
  });
});
