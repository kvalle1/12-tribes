---
name: implement-issue
description: End-to-end implementation of a single tracked issue — scope-check, TDD implementation, PR creation, automated review loop, and human-merge handoff. Use when the user invokes `/implement-issue <ID>` where ID is a Linear key (e.g. `EXO-42`) or a GitHub issue number/URL.
---

# Implement Issue

Drive a single tracked issue from "Todo" to "ready for human merge" with disciplined scope, TDD-based implementation, and an automated review feedback loop.

## Arg parsing

The skill takes one positional arg, the issue identifier.

- Matches `^[A-Z]+-\d+$` (e.g. `EXO-42`, `ENG-101`) → **Linear** issue, fetch via `mcp__claude_ai_Linear__get_issue`.
- Matches `^\d+$` or a GitHub issue URL → **GitHub** issue, fetch via `gh issue view <number> --json title,body,labels,assignees,url`.
- Anything else → ask the user to clarify and stop.

If no arg is given, stop and tell the user the skill requires an issue identifier (do not auto-pick a Todo — that's a different workflow).

## Phase 1 — Scope check (mandatory, no code yet)

Read the full issue (title, description, acceptance criteria, comments). Then evaluate:

1. **Focus** — Is there a single, unambiguous outcome that a PR can deliver? Or does the issue describe multiple loosely-related changes?
2. **Sizing** — Can this be implemented and reviewed in one PR without straining reviewer attention? Rule of thumb: if it touches >~5 unrelated modules, or mixes refactor + feature + bug fix, it's too big.
3. **Clarity** — Are the acceptance criteria concrete enough to write tests against? If not, what's missing?

**If scope is unambiguous and right-sized** → proceed to Phase 2.

**If scope is unclear, too large, or mixes concerns** → stop and bring back to the user with 1–2 concrete alternatives. Examples:

- "This issue covers both the API endpoint and the UI. I'd recommend splitting into `EXO-XX-api` and `EXO-XX-ui` so each PR stays reviewable. Alternative: keep as one PR but I'd want to confirm the scope before starting."
- "Acceptance criteria mention X but don't specify Y. Recommend you (a) add a comment to the issue clarifying Y, or (b) confirm here that Y is out of scope."

Do **not** proceed past Phase 1 without explicit user confirmation in the ambiguous case.

## Phase 2 — Implement via /tdd

1. Move issue state:
   - Linear: `mcp__claude_ai_Linear__save_issue(id, state: "In Progress")`
   - GitHub: assign to self if not already (`gh issue edit <n> --add-assignee @me`)
2. Create a branch:
   - Linear: use `gitBranchName` from the issue if present, else `humancoder2/<key>-<slug>`.
   - GitHub: `humancoder2/issue-<n>-<slug>`.
3. Invoke the **/tdd** skill to drive implementation. Pass the issue's acceptance criteria as the spec input.
4. Follow /tdd's red-green-refactor loop — **vertical slices, not horizontal**. Each test maps to one bit of behavior pulled from the acceptance criteria.
5. Stop Phase 2 when:
   - All acceptance criteria are satisfied,
   - The package's full test suite passes (`pnpm --filter <pkg> test` or the project-appropriate command),
   - Linting / type-check passes.

Commit in small, meaningful units as you go. Never use `Co-Authored-By` (see project CLAUDE.md).

## Phase 3 — Open the PR and start the review loop

1. Push the branch and open the PR with `gh pr create`. Title under 70 chars. Body has:
   - **Summary** (1–3 bullets)
   - **Test plan** (checklist)
   - Link to the issue (`Closes EXO-XX` for Linear if the integration is wired, or `Closes #<n>` for GitHub).
2. Capture `PR_NUMBER` and `PR_URL` from the create output.
3. Update issue state:
   - Linear: `state: "In Review"` and post a comment with the PR link + summary of what was implemented.
   - GitHub: the `Closes` keyword in the PR body handles linkage; optionally comment on the issue with the PR link.
4. **Start the feedback subscription** (see Phase 4) and **dispatch automated review** (Phase 5) in parallel — same assistant turn, two tool calls.

## Phase 4 — Subscribe to human PR feedback (with poll fallback)

Check for mcp tool that enables subscription to PR comments and reviews; if available, use it to subscribe to the PR. Otherwise, "subscribe" means a long-running background poller that emits a line every time new comment/review activity appears. Claude wakes on each emitted line via Monitor.

If no subscription tool is available, do the following:
1. Start a background bash process that polls every 60s and emits to stdout when comment or review count increases. Use the **Bash** tool with `run_in_background: true`:

   ```bash
   PR=<PR_NUMBER>
   REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
   last_c=0; last_r=0
   while true; do
     c=$(gh api "repos/$REPO/issues/$PR/comments" --jq 'length' 2>/dev/null || echo 0)
     r=$(gh api "repos/$REPO/pulls/$PR/reviews"   --jq 'length' 2>/dev/null || echo 0)
     if [ "$c" != "$last_c" ] || [ "$r" != "$last_r" ]; then
       echo "PR_ACTIVITY pr=$PR comments=$c reviews=$r ts=$(date -u +%FT%TZ)"
       last_c=$c; last_r=$r
     fi
     sleep 60
   done
   ```

2. Attach **Monitor** to that background bash so each `PR_ACTIVITY` line wakes the assistant. When woken, fetch new comments/reviews and address them (see Phase 6).

3. As a fallback heartbeat, **ScheduleWakeup** at 1200s with a reason like "fallback poll for PR #<n> human review" and a prompt that re-enters this skill at Phase 6. The fallback exists in case the background process dies or Monitor misses a tick.

4. When the PR is merged or closed, kill the background process and cancel the wakeup.

## Phase 5 — Dispatch automated review

In the same turn that starts Phase 4, dispatch an **Agent** with `subagent_type: claude`, `model: sonnet`, in the foreground:

- Description: `Automated PR review for #<n>`
- Prompt: `Run the /pr-review skill against PR #<PR_NUMBER> at <PR_URL>. Post findings as GitHub PR comments. Return a short summary of what was flagged and the severity (blocker / suggestion / nit).`

Wait for the agent's response. It returns a summary of what /pr-review posted.

## Phase 6 — Address feedback

Triggered by:
- The Phase 5 agent returning with findings, **or**
- A `PR_ACTIVITY` notification from Phase 4's poller, **or**
- The Phase 4 ScheduleWakeup fallback firing.

Steps:

1. Fetch the latest PR comments and reviews:
   `gh api repos/$REPO/pulls/$PR_NUMBER/comments` and `.../reviews` and `.../issues/$PR_NUMBER/comments`.
2. Read only the *new* items since last pass (track last-seen IDs in a small file under `.claude/state/implement-issue-<PR>.json`, or in-conversation if simpler).
3. For each comment:
   - If it requires a code change → make it, commit, push.
   - If it's a question → reply to the comment with `gh pr comment` or via the review-comment endpoint.
   - If it's a nit you choose not to address → reply explaining why.
4. After pushing fixes, re-dispatch Phase 5 (the /pr-review agent) so the automated check stays current. Loop until automated review returns clean **and** all human comments are addressed.

## Phase 7 — Merge

When (a) the automated review is clean and (b) all human comments are addressed:

1. Post a final comment on the PR summarizing what was changed in response to feedback.
2. Merge PR
3. Kill the background poller and cancel any pending ScheduleWakeup.
4. Finally
   - GitHub: nothing extra needed (the `Closes` keyword handles the issue).

## Guardrails

- **Never** merge the PR unless the user explicitly says to.
- **Never** force-push to a branch with reviewer comments without telling the user first.
- **Never** mark the issue Done if the PR isn't merged.
- **Never** add `Co-Authored-By` lines (project CLAUDE.md rule).
- If at any point the work expands beyond the issue's stated scope, **stop** and check with the user — do not silently grow the PR.
- If tests in unrelated areas start failing, treat as a real regression and investigate; do not skip with `--no-verify`.

## State tracking

Use the TaskCreate tool to track the phases as discrete tasks so progress is visible:

1. Scope check
2. Implement (TDD)
3. Open PR
4. Subscribe + dispatch automated review
5. Address feedback (may repeat)
6. Handoff

Update task status as each phase completes. Mark "Address feedback" as completed only when both human and automated review are settled.
