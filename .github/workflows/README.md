# Manual release workflows

`notify-chatbot-docs.yml` validates the shared manual, component regressions and production build on PRs and main. The build captures versioned manual screenshots; artifacts contain both the release marker and full generated package.

Only main/manual publication runs wait for the exact deployed app/text revision and matching screenshot inventory. The importer validates the deployed content-addressed image catalog, so browser/font differences between builds do not masquerade as an app revision mismatch. Failed/cancelled app deploys never dispatch.

`CHATBOT_DISPATCH_TOKEN` (target repository Contents write) enables immediate `atlas-manual-published` dispatch. Without that optional secret, publication is still verified and the chatbot’s serialized scheduled sync reconciles the published marker. Override `ATLAS_MANUAL_BASE_URL` / `CHATBOT_REPO` repository variables for forks. Do not put tokens in files or event payloads.

Legacy `atlas-docs-changed` notifications and handwritten-document drift issues are retired. Maintenance/configuration/recovery: [manual pipeline](../../documentation/MANUAL_KNOWLEDGE_PIPELINE.zh-CN.md).
