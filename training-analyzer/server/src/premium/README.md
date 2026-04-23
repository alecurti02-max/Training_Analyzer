# Premium module — NOT under AGPL

This directory is the boundary between the **AGPLv3 open core** and the **closed-source premium features** of Training Analyzer.

## Licensing

Code placed in `server/src/premium/**` is **proprietary** and **not covered by the AGPLv3 license** that applies to the rest of the repository. It is distributed only as part of the hosted SaaS offering.

If you self-host Training Analyzer from source, this directory is expected to be empty — the core application runs fully without it.

## What lives here (planned)

- **AI Coach** (v2): "suggested workout today", over-reaching detection, automated tapering
- **Third-party integrations** (v3): Garmin Connect, Strava, MyFitnessPal, Oura, Whoop OAuth flows
- **Notifications service**: weekly digest email, push notifications
- **Coach-grade PDF export**

## Integration pattern

Every premium feature must:

1. Live entirely inside `server/src/premium/`
2. Be mounted via a single entry point (e.g. `premium/index.js` exporting an Express router)
3. Be guarded by the `requirePremium` middleware (`server/src/middleware/requirePremium.js`)
4. Degrade gracefully when the directory is absent — the core app must start and serve free features even if this folder is missing

The free core never imports from this directory.
