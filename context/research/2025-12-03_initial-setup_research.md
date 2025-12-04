# Research: Initial Project Setup - Travel Tracker App
**Date**: 2025-12-03
**Feature**: Initial project setup with world map, country selection, and persistence

---

## 1. World Map Libraries for React

### Option A: react-simple-maps (Recommended for this use case)
- **Description**: Lightweight library built on d3-geo for creating SVG maps
- **Pros**:
  - Renders countries as individual SVG paths (easy click handlers)
  - No external tile provider needed
  - Lightweight with minimal dependencies
  - Good TypeScript support
  - Declarative API with intuitive props
  - Perfect for static visualizations and choropleth maps
- **Cons**:
  - Limited interactivity (basic click, hover)
  - Not ideal for complex map features (markers, popups, layers)
- **Best for**: Country selection, highlighting visited countries
- **NPM**: `react-simple-maps`
- **Source**: [Retool Blog - Best React Map Libraries](https://retool.com/blog/react-map-library)

### Option B: react-leaflet
- **Description**: React wrapper for Leaflet.js with OpenStreetMap integration
- **Pros**:
  - Extensive interactivity (zoom, pan, markers, popups)
  - Multiple tile provider support (OpenStreetMap, Mapbox)
  - Rich ecosystem of plugins
  - GeoJSON layer component for country borders
  - Better for complex interactive maps
- **Cons**:
  - Requires tile provider
  - Heavier than react-simple-maps
  - More complex setup for simple country selection
- **Best for**: Complex maps with multiple layers and features
- **NPM**: `react-leaflet`
- **Source**: [React Leaflet Documentation](https://react-leaflet.js.org/)

### Option C: react-map-gl
- **Description**: Uber's React wrapper for Mapbox GL JS
- **Pros**:
  - High-performance vector maps
  - Beautiful default styling
  - WebGL rendering
- **Cons**:
  - Requires Mapbox API key (free tier available)
  - More complex setup
- **Source**: [LogRocket - React Map Library Comparison](https://blog.logrocket.com/react-map-library-comparison/)

### Comparison Table

| Feature | react-simple-maps | react-leaflet | react-map-gl |
|---------|------------------|---------------|--------------|
| Best use case | Static visualization | Interactive maps | High-performance |
| Map tiles | SVG, no provider | Tile provider required | Mapbox required |
| Country borders | Built-in with GeoJSON | Via GeoJSON layer | Via Mapbox |
| Interactivity | Basic | Extensive | Extensive |
| Bundle size | Small | Medium | Large |
| Learning curve | Low | Medium | Medium |

---

## 2. Country GeoJSON Data Sources

### Option A: Natural Earth via DataHub (Recommended)
- **URL**: [DataHub geo-countries](https://datahub.io/core/geo-countries)
- **GitHub**: [datasets/geo-countries](https://github.com/datasets/geo-countries)
- **Direct file**: [countries.geojson](https://github.com/datasets/geo-countries/blob/main/data/countries.geojson)
- **License**: Public Domain
- **Description**: Complete GeoJSON polygons for all world countries from Natural Earth
- **Pros**: Well-maintained, includes country names and ISO codes

### Option B: geoBoundaries
- **URL**: [geoBoundaries.org](https://www.geoboundaries.org/)
- **License**: CC BY 4.0
- **Description**: Open license resource with ~1 million boundaries for 200+ entities
- **Pros**: Most comprehensive, includes administrative subdivisions
- **Cons**: Larger file sizes

### Option C: react-simple-maps built-in
- **Description**: Can use TopoJSON from Natural Earth directly
- **URL**: Uses `https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json`
- **Pros**: Optimized for react-simple-maps, smaller file size (TopoJSON)

### Option D: Custom GeoJSON Maps
- **URL**: [GeoJSON Maps Generator](https://geojson-maps.kyd.au/)
- **Description**: Customize and download specific regions
- **Pros**: Can generate only needed countries/regions

---

## 3. NestJS + PostgreSQL + TypeORM Setup

### Required Packages
```bash
npm install @nestjs/typeorm typeorm pg @nestjs/config
```

### Recommended Project Structure
```
backend/
├── src/
│   ├── core/              # Core modules (auth, config)
│   ├── database/          # Database config, migrations
│   │   ├── entities/
│   │   ├── migrations/
│   │   └── database.module.ts
│   ├── modules/
│   │   ├── countries/     # Countries module
│   │   │   ├── countries.controller.ts
│   │   │   ├── countries.service.ts
│   │   │   ├── countries.module.ts
│   │   │   ├── dto/
│   │   │   └── entities/
│   │   └── visits/        # User visits module
│   ├── app.module.ts
│   └── main.ts
├── .env
├── Dockerfile
└── package.json
```

### Database Configuration Best Practices
- Use `TypeOrmModule.forRootAsync()` for async configuration
- Load credentials from environment variables
- Use separate configs for development/production
- Enable migrations for schema management

### Key Sources
- [NestJS Database Documentation](https://docs.nestjs.com/techniques/database)
- [NestJS TypeORM PostgreSQL Guide](https://medium.com/@gausmann.simon/nestjs-typeorm-and-postgresql-full-example-development-and-project-setup-working-with-database-c1a2b1b11b8f)
- [Enterprise NestJS Stack 2025](https://medium.com/@lucaswade0595/typenestjs-typeorm-postgresql-the-enterprise-node-js-stack-in-2025-cba739f350a8)

---

## 4. Docker Compose Setup

### Reference Projects
- **Complete Starter**: [alexdevero/docker-nestjs-react-postgres](https://github.com/alexdevero/docker-nestjs-react-postgres)
- **Monorepo Guide**: [Medium - Setup & Dockerize React/Nest Monorepo](https://montacerdk.medium.com/setup-dockerize-a-react-nest-monorepo-application-7a800060bd63)

### Recommended Structure
```
my-travel-plans/
├── docker-compose.yml
├── docker-compose.dev.yml
├── backend/
│   ├── Dockerfile
│   └── Dockerfile.dev
├── frontend/
│   ├── Dockerfile
│   └── Dockerfile.dev
└── .env
```

### Docker Compose Services
1. **db** - PostgreSQL database
   - Image: `postgres:16-alpine`
   - Volume for data persistence
   - Port: 5432

2. **backend** - NestJS API
   - Build from ./backend
   - Depends on: db
   - Port: 3000
   - Hot reload volume mount for dev

3. **frontend** - React app
   - Build from ./frontend
   - Depends on: backend
   - Port: 5173 (Vite default)
   - Hot reload volume mount for dev

### Environment Variables
```env
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=travel_tracker

# Backend
DB_HOST=db
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=travel_tracker

# Frontend
VITE_API_URL=http://localhost:3000
```

### Key Sources
- [NestJS Docker Compose Guide](https://www.tomray.dev/nestjs-docker-compose-postgres)
- [Dockerizing NestJS](https://wanago.io/2023/01/16/api-nestjs-docker-compose/)

---

## 5. Frontend Stack Details

### React + Vite Setup
```bash
npm create vite@latest frontend -- --template react-ts
```

### Required Dependencies
```bash
# Core
npm install react-router-dom @reduxjs/toolkit react-redux

# RTK Query (included in @reduxjs/toolkit)
# React Hook Form
npm install react-hook-form

# Tailwind CSS
npm install -D tailwindcss postcss autoprefixer

# Map Library (choose one)
npm install react-simple-maps  # OR
npm install react-leaflet leaflet

# Types
npm install -D @types/react-leaflet  # if using leaflet
```

### Frontend Structure
```
frontend/
├── src/
│   ├── components/
│   │   ├── Map/
│   │   ├── CountryList/
│   │   └── Layout/
│   ├── features/
│   │   └── visits/
│   │       ├── visitsSlice.ts
│   │       └── visitsApi.ts
│   ├── pages/
│   │   └── Home.tsx
│   ├── store/
│   │   └── store.ts
│   ├── App.tsx
│   └── main.tsx
├── tailwind.config.js
└── package.json
```

---

## 6. Data Model (Initial)

### Countries Table (Reference Data)
```sql
CREATE TABLE countries (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  iso_code VARCHAR(3) UNIQUE NOT NULL,  -- ISO 3166-1 alpha-3
  iso_code_2 VARCHAR(2) UNIQUE NOT NULL, -- ISO 3166-1 alpha-2
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Visits Table (User Data)
```sql
CREATE TABLE visits (
  id SERIAL PRIMARY KEY,
  country_id INTEGER REFERENCES countries(id),
  user_id INTEGER,  -- For future user auth
  visited_at DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 7. Decisions Required for Planning Phase

### Map Library
- [ ] **Option A**: react-simple-maps (simpler, lighter, good for country selection)
- [ ] **Option B**: react-leaflet (more features, requires tile provider)

### GeoJSON Source
- [ ] **Option A**: Natural Earth via DataHub (recommended, includes ISO codes)
- [ ] **Option B**: Built-in react-simple-maps TopoJSON
- [ ] **Option C**: geoBoundaries (most comprehensive)

### Project Structure
- [ ] **Option A**: Monorepo (single repo with frontend/ and backend/ folders)
- [ ] **Option B**: Separate repos (more complex, better for large teams)

### Database ORM
- [ ] **Option A**: TypeORM (most common with NestJS)
- [ ] **Option B**: Prisma (modern, great DX, type-safe)

### Development Approach
- [ ] **Option A**: Start with backend, then frontend
- [ ] **Option B**: Start with frontend (mock data), then backend
- [ ] **Option C**: Parallel development with Docker

---

## Sources

### Map Libraries
- [Retool - Best React Map Libraries 2024](https://retool.com/blog/react-map-library)
- [LogRocket - React Map Library Comparison](https://blog.logrocket.com/react-map-library-comparison/)
- [React Leaflet Official](https://react-leaflet.js.org/)
- [ThemeSelection - React Map Libraries 2024](https://themeselection.com/react-map-library/)

### GeoJSON Data
- [DataHub - geo-countries](https://datahub.io/core/geo-countries)
- [GitHub - datasets/geo-countries](https://github.com/datasets/geo-countries)
- [geoBoundaries](https://www.geoboundaries.org/)
- [MapScaping - GeoJSON Downloads](https://mapscaping.com/geojson-every-country-in-the-world/)

### NestJS + PostgreSQL
- [NestJS Database Documentation](https://docs.nestjs.com/techniques/database)
- [NestJS TypeORM PostgreSQL Guide](https://medium.com/@gausmann.simon/nestjs-typeorm-and-postgresql-full-example-development-and-project-setup-working-with-database-c1a2b1b11b8f)
- [Enterprise Stack 2025](https://medium.com/@lucaswade0595/typenestjs-typeorm-postgresql-the-enterprise-node-js-stack-in-2025-cba739f350a8)

### Docker
- [alexdevero/docker-nestjs-react-postgres](https://github.com/alexdevero/docker-nestjs-react-postgres)
- [NestJS Docker Compose Guide](https://www.tomray.dev/nestjs-docker-compose-postgres)
- [Monorepo Docker Setup](https://montacerdk.medium.com/setup-dockerize-a-react-nest-monorepo-application-7a800060bd63)
