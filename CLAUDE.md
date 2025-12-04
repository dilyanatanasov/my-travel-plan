# My Travel Plans - Development Guidelines

## Project Overview
A web application to track places a user has visited around the world.

### Core Features
- World map with visible country borders
- Country selection (cities in future iterations)
- Persistent list of visited countries

### Tech Stack
- **Backend**: NestJS + PostgreSQL
- **Frontend**: React + Tailwind + Redux + RTK Query + React Hook Form + React Router
- **Infrastructure**: Docker

---

## Development Workflow

All development follows a **3-phase approach**. Each phase produces artifacts stored in the `context/` directory with timestamps and descriptive names.

### Phase 1: Research
**Directory**: `context/research/`
**Naming**: `YYYY-MM-DD_<feature-name>_research.md`

- Find and document relevant files, dependencies, and existing patterns
- Document external resources, libraries, and APIs needed
- Identify potential challenges and constraints

### Phase 2: Plan
**Directory**: `context/plan/`
**Naming**: `YYYY-MM-DD_<feature-name>_plan.md`

- Suggest multiple solutions with pros/cons
- Ask for decisions on each option
- **Do NOT create the plan file until all options are confirmed by the user**
- Once confirmed, document the agreed implementation approach

### Phase 3: Implement
**Directory**: `context/implement/`
**Naming**: `YYYY-MM-DD_<feature-name>_implement.md`

- Follow the approved plan
- Document implementation progress and any deviations
- Track completed tasks and remaining work

---

## Directory Structure

```
context/
├── research/    # Research findings and file references
├── plan/        # Confirmed implementation plans
└── implement/   # Implementation logs and progress
```
