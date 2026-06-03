# Implementation Plan — Functionality Audit Fixes

## Phase 1: Critical (Issues 1-4) — Est. 3.5 hours

### Issue #4: ProjectManager Commit — persist to parent state
- File: `components/ProjectManager.tsx` lines 46-61
- Fix: Add `onCommit` callback prop, wire in `handleCommit`, update parent `virtualFiles` in `App.tsx`
- Risk: Low

### Issue #3: ProjectManager Merge to Main — add onClick handler
- File: `components/ProjectManager.tsx` lines 229-241
- Fix: Add `onMerge` callback prop, implement merge logic (mark files unmodified, add merge commit)
- Risk: Low

### Issue #2: AdaptivePanel Quick Actions — wire onClick handlers
- File: `components/AdaptivePanel.tsx` lines 177-186
- Fix: Create `onAction` callback prop, map action strings to handler functions, thread callbacks from `App.tsx`
- Risk: Low

### Issue #1: useAgentChat Tool Results — feed back to model
- File: `hooks/useAgentChat.ts` lines 329-332
- Fix: After tool execution, make second API call with tool results, add iteration guard (max 5), cap output at 500 chars
- Risk: Medium (infinite loops, context overflow)

## Phase 2: High Priority (Issues 5-10) — Est. 2.5 hours

### Issue #10: DependencyErrorDisplay — show details inline
- File: `src/components/DependencyErrorDisplay.tsx` line 34
- Fix: Replace console.log with inline expansion showing formatted error JSON
- Risk: Low

### Issue #6: Gemini Model Selection — wire to settings
- File: `components/InputArea.tsx` lines 730-742
- Fix: Add `geminiModel` to AppSettings, wire onClick to save, pass to geminiStreamService
- Risk: Medium (model name format)

### Issue #8: Web Fetch Tool — add fetch button
- File: `components/ToolsPanel.tsx` lines 181-191
- Fix: Add FETCH button that calls toolExecutor.execute, show results inline
- Risk: Medium (URL fetching can hang)

### Issue #5: Voice Recording — disable with explanation
- File: `components/InputArea.tsx` lines 257-284
- Fix: Show toast "Voice input requires Chrome/Edge", disable mic button on other browsers
- Risk: Low

### Issue #9: ProjectManager Close Button — verify
- Appears to be wired correctly (onClick={onClose}). Verify manually.

### Issue #7: LocalGitService — defer (needs backend bridge)

## Phase 3: Medium Priority (Issues 11-18) — Est. 2 hours

### Issue #18: InputArea keyboard shortcut hint
- Fix: Change `⌘ Enter` display to `Enter`

### Issue #11: AdaptivePanel metrics hardcoded
- Fix: Wire to actual agent state counts from agenticState

### Issue #12: Boot Sequence progress bar
- Fix: Use React state to animate from 0-100% over 2s

### Issue #17: SystemMonitor latency
- Fix: Track last AI API call latency instead of favicon.ico

### Issues #13-16: Defer (nice-to-have, no functional impact)

## Phase 4: Cleanup (Issues 19-30) — Defer to dedicated tech debt sprint
