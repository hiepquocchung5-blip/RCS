# Product Brief

## Product

**RiseCoreStudio (RCS)** is an agency delivery platform that connects client acquisition, project planning, team formation and accountable software delivery.

## Problem

Small and growing software agencies often manage enquiries, staffing, delivery boards and team communication across disconnected tools. Clients lack a clear view of how work begins, while delivery leads spend time rebuilding context and manually matching people to projects.

## Proposition

RCS provides one structured operating layer for an agency:

- Prospective clients can review relevant work and submit a useful project brief.
- Admins can review requests and verified team applications.
- Project managers can define the engagement, technology and staffing plan.
- Team members can see assigned delivery work and collaborate in authorized project channels.
- Deterministic automation advances work without hiding decisions.

## Audiences

### Clients

Need confidence, a simple way to start and clear communication about what happens next. They do not need a Dev Hub account.

### Agency administrators

Need oversight of client requests, talent applications, access and delivery activity.

### Project managers

Need reliable project setup, staffing visibility and execution controls.

### Delivery team members

Need focused access to assigned projects, tickets and relevant communication.

## Primary journeys

1. **Client acquisition** — homepage → showcase → project request → Admin review.
2. **Team onboarding** — application → OTP verification → Admin approval → credential delivery.
3. **Dev Hub access** — Dev Hub button → login → Projects portfolio.
4. **Project formation** — create project → define staffing plan → review matches → assign team.
5. **Delivery** — create tickets → move one stage at a time → record activity.

## Experience principles

- Public pages communicate outcomes before implementation details.
- Dev Hub navigation appears only after authentication.
- Permissions determine both visible navigation and API access.
- Loading, empty, success and failure states always explain what is happening.
- Important actions use familiar agency language and a clear next step.
- Automation remains deterministic, attributable and reversible by human process.

## Success measures

- Qualified project requests submitted per month.
- Time from reviewed request to scoped project.
- Time required to fill a project staffing plan.
- Percentage of active tickets with clear ownership.
- Application completion and approval rates.
- Delivery events recorded without authorization or state-transition errors.

## Current scope

The repository implements the public request and showcase experience, role-based authentication, developer onboarding, project and staffing workflows, delivery tickets, activity history and project-authorized chat contracts.

Production launch remains gated by the work listed in `PRODUCTION-READINESS.md`, particularly durable persistence, credential hashing, validation, abuse controls and observability.

## Near-term priorities

1. PostgreSQL repositories and migrations.
2. Production-grade credential and one-time-token storage.
3. Runtime request schemas and rate limits.
4. Project detail pages with milestones, tickets and communication in context.
5. Client request conversion into a project without duplicate entry.
