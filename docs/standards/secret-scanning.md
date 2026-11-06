# Secret-scanning standard v1

This repo must not contain secrets. The pre-commit hook runs Gitleaks on every commit. A full-history scan runs before a public release.

## What the standard requires

- Pin Gitleaks in `.pre-commit-config.yaml` to a released tag. The current pin is `v8.30.1`.
- Install hooks with `scripts/install-hooks.sh` after every clone.
- Keep `.env`, `*.env`, `*.pem`, the Tesla private key, and the local token store out of git. `.gitignore` lists these names.
- Never commit with `--no-verify`. That flag skips the hook.
- Never commit tokens, keys, VINs, or other personal data.

## Install the hooks

1. Clone the repo.
2. Run `scripts/install-hooks.sh` from the repo root.
3. If `pre-commit` is missing, the script installs it with `python3 -m pip`.
4. Confirm git shows a pre-commit hook under `.git/hooks/pre-commit`.

If you skip the script, the hook is not installed. Commits on that clone are not scanned.

If `core.hooksPath` is set, the script installs into `.git/hooks`, then restores that path.

## What the hook does

The hook runs `gitleaks git --pre-commit --redact --staged --verbose`. It scans the staged diff. It redacts secret values in its output.

If Gitleaks finds a leak, the commit fails. Remove the secret. Rotate the real credential. Stage the fix. Commit again.

## Full-history scan

The hook does not scan old commits. Before you finish a public change, scan all history:

```
gitleaks git --redact --report-path /tmp/gitleaks-report.json
```

Keep the report outside the repo. A clean result prints `no leaks found` and exits 0.

## `--no-verify` is never allowed

Do not run `git commit --no-verify`. Do not run `SKIP=gitleaks git commit`. Both skip secret scanning.

If a commit is blocked, fix the leak. Do not bypass the hook.
