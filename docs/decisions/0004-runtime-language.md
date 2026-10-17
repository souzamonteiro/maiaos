# ADR 0004: ES8 source, C89 device target

**Status:** Proposed, pending MaiaJS compiler audit.

**Decision:** Keep the reusable decoder and interpreter authored in ES8; generate C89 for device using MaiaJS. Do not require C++11+ or JS runtime in firmware. Restrict hot-path features if needed after measurement.

**Consequences:** Strong self-hosting story, but translation correctness and runtime footprint are gating risks.
