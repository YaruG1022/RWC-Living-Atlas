# Workflows

## `notify-chatbot-docs.yml`

The RWC Living Atlas Helper Chatbot lives in its own repository and keeps a
Markdown knowledge base describing how this app works. That knowledge base is a
hand-written copy, so it drifts whenever this app's user-facing documentation
changes and nobody remembers to update it.

This workflow makes the drift visible. When a push to `main` touches

- `LivingAtlas1-main/client/src/UserManual.js`
- `LivingAtlas1-main/client/src/ChangelogHistory.js`
- `LivingAtlas1-main/client/src/ChangelogModal.js`

it sends a `repository_dispatch` event to the chatbot repo, which opens an issue
there asking someone to review its docs. Nothing in this repository is changed
and no build is blocked.

### Configuration

| Kind | Name | Value |
|------|------|-------|
| Secret | `CHATBOT_DISPATCH_TOKEN` | Fine-grained PAT scoped to the chatbot repo only, with **Contents: read and write** (the permission GitHub requires for the dispatches endpoint) |
| Variable | `CHATBOT_REPO` | `YaruG1022/RWC-Living-Atlas-Chatbot` |

Both live under *Settings → Secrets and variables → Actions*. If either is
missing the workflow logs a warning and exits successfully, so an unconfigured
fork is never blocked by it.

### Adding another documentation source

Add the path to the `on.push.paths` list **and** to the `git diff` pathspec in
the "Collect what changed" step — the first decides whether the workflow runs,
the second decides what the issue says changed.
