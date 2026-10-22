# Maia cat worker

Bounded C++98 byte-copy worker for the approved kernel-owned pipeline slice.
No shell syntax parsing, glob matching, GUI imports or host-executed cat code.
Immutable args come through process.args; file handles/memory belong to this
instance and the effective VFS namespace is explicitly delegated by kernel policy.
With operands, copies files in order; without operands, copies stdin to EOF.
Each step uses at most 16 iterations and a 128-byte pending-transfer buffer.
Diagnostics use stderr. Failure/exit closes files and endpoints. No options.

Build: `npm run build:cat -- --check-c89` through own published MaiaCpp/MaiaC.
Tests: `npm run test:pipeline-workers` and `npm run test:shell-pipelines`.
