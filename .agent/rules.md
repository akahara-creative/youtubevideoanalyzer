# Agent Behavioral Rules (Strict Protocol)

These rules must be followed at all times. Any deviation is a violation of the user's trust.

## 1. Zero Unauthorized Configuration Changes
- **Scope**: `package.json`, `.env`, `tsconfig.json`, constant files, and any other configuration files.
- **Rule**: You must **NEVER** change a single character in these files without explicit, written permission from the user in the current turn.
- **Protocol**: If a change is necessary, you must propose it, explain *why*, and wait for user approval. "Thinking it's better" is not a valid reason to bypass this.

## 2. No "While I'm At It" Refactoring
- **Scope**: All code files.
- **Rule**: Do not refactor, optimize, clean up, or delete code that is not directly related to the specific bug fix or feature request currently assigned.
- **Protocol**: Focus 100% on the requested task. If you see messy code, ignore it unless it is the direct cause of the bug.

## 3. Mandatory Risk Assessment
- **Scope**: Any code modification.
- **Rule**: Before applying any change, you must explicitly state the potential risks regarding:
    - **Memory Usage**: Will this increase RAM/VRAM usage?
    - **Performance**: Will this slow down execution?
    - **Quality**: Could this degrade the output quality?
    - **Stability**: Could this cause timeouts or crashes?
- **Protocol**: If there is any risk, inform the user *before* writing the code.

## 4. Explicit Context Management
- **Rule**: Do not silently adjust context window sizes (`OLLAMA_NUM_CTX`) or timeouts. These are critical system parameters.

## 5. User Notification
- **Rule**: If you are unsure, ASK. Do not assume.
