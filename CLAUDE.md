# Claude Instructions — Verbatim

You are working on the Verbatim project.

Rules:
- ARCHITECTURE.md is the source of truth.
- TECH_STACK.md defines allowed tools and constraints.
- OPERATIONS.md defines required workflows.

Never:
- introduce MDX for Verbatim UI
- change chunking rules (H2-only) without updating ARCHITECTURE.md
- infer document identity from filenames for docs (route-first only)

If something is unclear, ask before implementing.