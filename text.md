# Implementation Notes

- Keep the background overrides in the existing main stylesheet so they load after any legacy theme tokens.
- If another stylesheet is added later, ensure these rules appear last to preserve the intended cascade.
- No header or footer selectors are included to avoid accidental overrides.
