# Plan: Initial Project Setup - Travel Tracker App
**Date**: 2025-12-03
**Feature**: Initial project setup with world map, country selection, and persistence

---

## Confirmed Decisions

| Decision | Choice |
|----------|--------|
| Map Library | **react-simple-maps** |
| GeoJSON Source | **Natural Earth (DataHub)** |
| Project Structure | **Monorepo** |
| Database ORM | **TypeORM** |
| Development Approach | **Parallel with Docker** |

---

## Implementation Steps

### Step 1: Project Scaffolding

#### 1.1 Create Root Structure
```
my-travel-plans/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env
├── .env.example
├── .gitignore
├── backend/
└── frontend/
```

#### 1.2 Initialize Backend (NestJS)
```bash
cd backend
nest new . --package-manager npm
npm install @nestjs/typeorm typeorm pg @nestjs/config class-validator class-transformer
```

#### 1.3 Initialize Frontend (React + Vite)
```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install react-router-dom @reduxjs/toolkit react-redux react-hook-form react-simple-maps
npm install -D tailwindcss postcss autoprefixer @types/react-simple-maps
```

---

### Step 2: Docker Configuration

#### 2.1 Create docker-compose.yml (Production)
Services:
- **db**: PostgreSQL 16 Alpine
- **backend**: NestJS API (port 3000)
- **frontend**: React app with Nginx (port 80)

#### 2.2 Create docker-compose.dev.yml (Development)
- Hot reload for both frontend and backend
- Volume mounts for source code
- Frontend on port 5173 (Vite dev server)
- Backend on port 3000 (NestJS dev server)

#### 2.3 Create Dockerfiles
- `backend/Dockerfile` - Production multi-stage build
- `backend/Dockerfile.dev` - Development with hot reload
- `frontend/Dockerfile` - Production with Nginx
- `frontend/Dockerfile.dev` - Development with Vite

---

### Step 3: Backend Implementation

#### 3.1 Database Configuration
- Configure TypeORM with PostgreSQL
- Set up environment variables
- Create database module

#### 3.2 Create Entities

**Country Entity**
```typescript
@Entity('countries')
export class Country {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 3, unique: true })
  isoCode: string;  // ISO 3166-1 alpha-3

  @Column({ length: 2, unique: true })
  isoCode2: string; // ISO 3166-1 alpha-2

  @CreateDateColumn()
  createdAt: Date;
}
```

**Visit Entity**
```typescript
@Entity('visits')
export class Visit {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Country)
  @JoinColumn({ name: 'country_id' })
  country: Country;

  @Column({ name: 'country_id' })
  countryId: number;

  @Column({ type: 'date', nullable: true })
  visitedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

#### 3.3 Create Modules

**Countries Module**
- `GET /countries` - List all countries
- `GET /countries/:id` - Get single country

**Visits Module**
- `GET /visits` - List all visited countries
- `POST /visits` - Add a country to visited list
- `DELETE /visits/:id` - Remove from visited list

#### 3.4 Seed Countries Data
- Create seed script to populate countries from Natural Earth data
- Include ISO codes for mapping to GeoJSON

---

### Step 4: Frontend Implementation

#### 4.1 Configure Tailwind CSS
- Initialize tailwind.config.js
- Add Tailwind directives to index.css

#### 4.2 Set Up Redux Store
```
src/
├── store/
│   ├── store.ts
│   └── api/
│       └── apiSlice.ts
├── features/
│   └── visits/
│       └── visitsApi.ts
```

#### 4.3 Create RTK Query API
- `useGetCountriesQuery` - Fetch all countries
- `useGetVisitsQuery` - Fetch visited countries
- `useAddVisitMutation` - Add visit
- `useRemoveVisitMutation` - Remove visit

#### 4.4 Create Components

**WorldMap Component**
- Use react-simple-maps with ComposableMap
- Load Natural Earth GeoJSON
- Highlight visited countries (different color)
- Click handler for country selection

**CountryList Component**
- Display list of visited countries
- Option to remove countries
- Show visit date if available

**Layout Component**
- Header with app title
- Main content area with map and list side by side

#### 4.5 Create Pages
- **HomePage** - Main view with map and visited list

---

### Step 5: Integration & Testing

#### 5.1 Connect Frontend to Backend
- Configure VITE_API_URL environment variable
- Test all API endpoints through RTK Query

#### 5.2 Test Docker Setup
- `docker-compose -f docker-compose.dev.yml up`
- Verify hot reload works
- Verify database persistence

---

## File Structure (Final)

```
my-travel-plans/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env
├── .env.example
├── .gitignore
├── context/
│   ├── research/
│   ├── plan/
│   └── implement/
├── backend/
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   ├── config/
│   │   │   └── database.config.ts
│   │   ├── modules/
│   │   │   ├── countries/
│   │   │   │   ├── countries.module.ts
│   │   │   │   ├── countries.controller.ts
│   │   │   │   ├── countries.service.ts
│   │   │   │   ├── entities/
│   │   │   │   │   └── country.entity.ts
│   │   │   │   └── dto/
│   │   │   └── visits/
│   │   │       ├── visits.module.ts
│   │   │       ├── visits.controller.ts
│   │   │       ├── visits.service.ts
│   │   │       ├── entities/
│   │   │       │   └── visit.entity.ts
│   │   │       └── dto/
│   │   │           ├── create-visit.dto.ts
│   │   │           └── update-visit.dto.ts
│   │   └── seeds/
│   │       └── countries.seed.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── components/
│   │   │   ├── WorldMap/
│   │   │   │   ├── WorldMap.tsx
│   │   │   │   └── index.ts
│   │   │   ├── CountryList/
│   │   │   │   ├── CountryList.tsx
│   │   │   │   └── index.ts
│   │   │   └── Layout/
│   │   │       ├── Layout.tsx
│   │   │       └── index.ts
│   │   ├── pages/
│   │   │   └── HomePage.tsx
│   │   ├── store/
│   │   │   ├── store.ts
│   │   │   └── api/
│   │   │       └── apiSlice.ts
│   │   └── features/
│   │       └── visits/
│   │           └── visitsApi.ts
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── vite.config.ts
└── CLAUDE.md
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/countries` | List all countries |
| GET | `/api/countries/:id` | Get country by ID |
| GET | `/api/visits` | List all visits |
| POST | `/api/visits` | Create a visit |
| DELETE | `/api/visits/:id` | Delete a visit |

---

## Environment Variables

```env
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=travel_tracker

# Backend
NODE_ENV=development
DB_HOST=db
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=travel_tracker
API_PORT=3000

# Frontend
VITE_API_URL=http://localhost:3000/api
```

---

## Implementation Order

1. **Root setup** - docker-compose, .env, .gitignore
2. **Backend scaffolding** - NestJS project, TypeORM config
3. **Frontend scaffolding** - Vite + React, Tailwind, Redux
4. **Docker files** - All Dockerfiles for dev environment
5. **Backend entities & modules** - Countries, Visits
6. **Country seed data** - Populate database
7. **Frontend store & API** - RTK Query setup
8. **Frontend components** - WorldMap, CountryList, Layout
9. **Integration** - Connect everything, test

---

## Notes

- User authentication is NOT in scope for initial version
- Cities feature is planned for future iteration
- GeoJSON will be loaded from CDN (Natural Earth) on frontend
- Country matching will use ISO codes between GeoJSON and database
