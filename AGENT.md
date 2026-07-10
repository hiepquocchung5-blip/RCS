# RCS Deterministic Automation Rules

RCS “agents” are background workers and webhook listeners, not generative AI. They perform explicit, testable actions.

## Onboarding agent

- Issues and validates six-digit OTPs with a strict five-minute expiry.
- Supports Admin approval and secure 16-character credential delivery.
- Records every meaningful onboarding event.

## Git sync agent

- Processes merged GitHub pull requests containing an RCS ticket reference.
- Advances the ticket by exactly one legal state.
- Records handled, ignored and refused webhook events.

## Constraints

- Automated actions must always create an activity entry.
- Automation cannot delete projects, remove users or merge code.
- Ticket states cannot be skipped: `todo → in_progress → review → complete`.
- Human approval remains required for high-impact account and project decisions.
