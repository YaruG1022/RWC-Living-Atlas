# Security policy

## Reporting a vulnerability

Please avoid posting vulnerability details, credentials, personal data, or exploit instructions in public issues and pull requests.

If GitHub private vulnerability reporting is enabled for this repository, use [Report a vulnerability](https://github.com/YaruG1022/RWC-Living-Atlas/security/advisories/new). Otherwise, check the [maintainer's GitHub profile](https://github.com/YaruG1022) for a published private contact method. If no private channel is available, open an issue containing only a request for a private security contact; omit the vulnerability details until a private channel is established.

Include the affected commit or release, the relevant component, expected and observed behavior, impact, and a minimal reproducer using synthetic data. Redact tokens, passwords, connection strings, user information, and sensitive service URLs. Test only systems and accounts you are authorized to use; use an isolated environment for destructive or load tests.

## Supported versions and fixes

Maintenance focuses on the current `main` branch and the latest published release. Older releases do not have a separate security backport commitment. Check [Releases](https://github.com/YaruG1022/RWC-Living-Atlas/releases) for published fixes and known limitations.

The project is maintained independently and does not promise a fixed response time. The maintainer will assess reports, coordinate a fix and disclosure when possible, and document affected versions and remediation. Application dependencies, hosted service configuration, and third-party service credentials also need review; a passing CI run does not establish that a deployment is secure.
