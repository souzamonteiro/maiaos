# MaiaOS — Mandatory Engineering Instructions for AI Agents

> **Scope:** MaiaOS and any related work involving MaiaCC, MaiaC, MaiaWASM, MaiaWASMVM, the shell, system calls, graphical applications, or LVGL.
>
> **Priority:** This file is a project-level engineering contract. Read it at the beginning of every task, after every context handoff, and before proposing any architectural change. If an instruction conflicts with a higher-priority instruction or a documented repository decision, stop and ask for clarification. Do not silently choose an alternative architecture.

## 1. Mission

Build **MaiaOS as specified by the project's architecture and interfaces**. Correctness includes preserving architectural boundaries, not merely making code compile or producing a convincing demonstration.

A visually similar replacement is **not** equivalent to the required implementation. A prototype that bypasses a system interface is **not** evidence that the interface works.

## 2. Non-negotiable rules

1. **Never replace an agreed subsystem with a shortcut.** In particular, do not substitute HTML/CSS/JavaScript, DOM widgets, browser rendering, canvas imitations, screenshots, or mock interfaces for a required LVGL-based GUI or MaiaOS graphical system-call path.
2. **Use the actual MaiaOS APIs and system calls.** Applications intended to exercise MaiaOS must call the implemented MaiaOS interfaces. Do not bypass them with host APIs, ad hoc bridges, direct browser calls, or test-only shims unless explicitly approved and clearly isolated.
3. **Preserve component responsibilities.** Do not move parser, compiler, WebAssembly runtime, shell, kernel/system-service, or GUI responsibilities across boundaries to make a task easier. Consult current repository documentation for the exact responsibilities.
4. **Never weaken tests to make an implementation pass.** Do not delete failing tests, rewrite expected results to match incorrect output, hide errors, or replace integration tests with mock-only tests without explicit approval.
5. **Never claim success from compilation alone.** A change is complete only when relevant functional, integration, and architecture-conformance tests pass.
6. **Never perform broad refactors without approval.** Restrict modifications to the current task. If a change requires redesign of another component or repository, explain the dependency and request authorization.
7. **Never rewrite history or destroy work.** No `git reset --hard`, `git clean -fd`, force push, destructive rebases, bulk deletion, or overwriting unrelated work without explicit authorization. Never commit secrets. Do not commit temporary build outputs, caches, or test artifacts. Generated parsers and other generated artifacts may be versioned only when required by documented repository policy or explicitly approved by the project owner; preserve their generation sources and reproducible generation commands.
8. **Do not invent missing APIs.** Inspect actual declarations, implementations, build scripts, and tests. If an API is missing, propose the smallest compatible addition and request approval for any public-interface change.
9. **Do not hide an incomplete implementation behind a demonstration.** Clearly label mocks, stubs, placeholders, host-only implementations, and unimplemented features.
10. **Stop rather than improvise when blocked.** Explain the obstacle, attempted approaches, affected interfaces, and proposed next steps. Ask before changing the agreed architecture.

## 3. MaiaOS-specific architecture safeguards

### Shell
- Follow the documented POSIX shell grammar and the project's selected compliance scope.
- Generate parsers and lexers automatically from the project's EBNF exclusively through MaiaCC/tREx. Never replace them with handwritten syntax or tokenization rules, and never manually edit generated files. Collectors, token transport, and host adapters must not duplicate grammar rules.
- If a target-language backend does not generate a required lexer or parser, report the limitation and request approval to fix the MaiaCC generator. Do not silently compensate with a handwritten implementation. A C++ parser tested with tokens from the generated JavaScript lexer is parser/collector validation, not evidence of a generated C++ lexer or complete runtime integration.
- Fix grammar defects in the EBNF and generator defects in MaiaCC/tREx, then regenerate and rerun the relevant tests. Validate JavaScript parser/collector behavior first, then compare the target-language parser/collector on the same corpus and expected trees. Test the target lexer and final guest integration separately.
- Keep lexical analysis, parsing, AST construction, validation, execution, and system integration conceptually distinct.
- Validate parsing against representative scripts and expected ASTs, including quoting, expansions, pipelines, redirections, compound commands, and error cases as applicable to the documented scope.
- Do not treat a displayed AST as evidence that shell execution works.
- Do not silently reduce the supported grammar or accept nonconforming syntax just to pass a demo.

### Compiler and WebAssembly components
- Respect the documented interfaces of MaiaCC, MaiaC, MaiaWASM, and MaiaWASMVM.
- Preserve established regression suites and known-good compiler/runtime behavior.
- Do not modify related repositories simply to accommodate an incorrect MaiaOS integration.
- If a cross-repository change is necessary, specify the exact API contract, compatibility impact, and tests before making it.

### Submodules and publication
- Obtain explicit authorization before committing, pushing, changing release versions, or publishing packages. Authorization to edit or test is not authorization to publish. Do not bump versions or publish to npm merely to synchronize Git submodules.
- For authorized cross-repository publication, proceed in dependency order: deepest dependency first, then its consumers, and MaiaOS last. Validate and publish each dependency commit before recording its gitlink in a consumer.
- Verify every recorded submodule commit exists in the intended remote repository, recursively. Do not present a dirty submodule checkout or an unpublished commit as a reproducible dependency.
- Keep standalone repositories and their nested submodule checkouts aligned without overwriting local work. Preserve unrelated edits and disclose any changes that remain uncommitted or unpublished; ask before using stash or a destructive synchronization strategy.
- Before an authorized npm release, confirm the version is available for publication and verify the package contents with `npm pack --dry-run`. After publication, verify the registry version and package checksums against the intended release artifacts. Git publication and npm publication are distinct steps; report their status separately.

### LVGL and graphical applications
- **LVGL is an implementation requirement wherever the architecture specifies LVGL**, not a visual style reference.
- GUI applications must exercise the actual intended graphical stack and MaiaOS system-call interfaces.
- Do not render HTML that imitates LVGL and describe it as LVGL integration.
- Do not replace real event handling, display drivers, input handling, or GUI calls with static visual approximations.
- A calculator or other sample application must demonstrate real integration, not merely look correct.
- If native LVGL integration cannot yet run on a target, report the limitation and propose a separately labeled test harness; do not silently substitute a different stack.

## 4. Mandatory task-start protocol

Before editing code:

1. Read this `AGENTS.md` in full.
2. Read the repository's `README`, architecture documentation, relevant interface contracts, and existing tests.
3. Inspect `git status`, current branch, and recent commits. Do not assume the working tree is clean.
4. Identify the exact task, affected files, affected repositories, and required architectural path.
5. Write a short plan stating **what will change, what will not change, and how it will be tested**.
6. If the plan changes a public API, architectural boundary, rendering technology, execution model, or another repository, obtain explicit approval **before editing**.

Do not start with a broad rewrite or automatic mass-edit.

## 5. Implementation protocol

- Work in small, reviewable increments.
- Prefer the smallest change that satisfies the documented requirement.
- Keep working behavior and regression tests intact.
- Add or update tests alongside the implementation.
- Check relevant integration points rather than only the modified file.
- Never make speculative repository-wide changes based on an unverified assumption.
- Maintain clear English comments and documentation where appropriate.
- Before each commit, review the diff for unrelated modifications and architecture violations.

## 6. Agent handoff and context recovery

A change of agent, model, conversation, or context window **does not authorize changing the architecture**.

On every handoff, the incoming agent must:

1. Re-read this file and the applicable architecture documentation.
2. Inspect the current Git state and the last known passing tests.
3. Read `docs/AGENT_HANDOFF.md` if present.
4. Distinguish verified facts from assumptions and unfinished experiments.
5. Continue from the documented task and acceptance criteria; do not restart or redesign it by default.

Before handing off, the outgoing agent should update `docs/AGENT_HANDOFF.md` with:

- Current objective and acceptance criteria.
- Architectural decisions that must remain unchanged.
- Files and repositories modified.
- Commands/tests executed and exact outcomes.
- Known failures and unresolved questions.
- Next smallest safe action.
- Last known good commit identifier, when available.

A handoff note is a progress record, **not permission to override this file**.

## 7. Definition of done

A task is complete only if all applicable items are true:

- [ ] The implementation follows the agreed architecture and actual system interfaces.
- [ ] No unauthorized technology substitution or bypass was introduced.
- [ ] Relevant builds succeed on the intended toolchain/target, or limitations are explicitly documented.
- [ ] Relevant unit, regression, and integration tests pass.
- [ ] Tests demonstrate the required behavior rather than merely a visual approximation.
- [ ] Existing unrelated functionality remains intact.
- [ ] `git diff` contains only justified changes.
- [ ] Documentation and handoff notes reflect the actual implementation.
- [ ] Any unimplemented feature is clearly identified, not presented as complete.

## 8. Mandatory final report format

For every completed task, report:

**Objective:** What was requested.

**Implementation:** Files changed and actual interfaces used.

**Architecture compliance:** Why the implementation follows the agreed architecture; explicitly identify the LVGL/system-call path when applicable.

**Verification:** Exact build/test commands and results. Say "not run" if not run.

**Git state:** Branch, relevant commit, and remaining uncommitted changes.

**Limitations / next action:** Outstanding problems, assumptions, and the next safe step.

## 9. Escalation rule

If you believe the agreed architecture is infeasible, inefficient, or incorrect, **do not replace it on your own**. Present:

1. The specific technical problem and evidence.
2. At least one solution that preserves the architecture.
3. Any proposed alternative and its trade-offs.
4. The exact decision required from the project owner.

Wait for approval before implementing a materially different design.

---

**Standing instruction:** Architectural fidelity is more important than a fast demonstration. Never trade the MaiaOS design for a shortcut without explicit authorization.
