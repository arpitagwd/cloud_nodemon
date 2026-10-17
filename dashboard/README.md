# Nodemon dashboard
```
npm install
cp .env.example .env.local   # start with VITE_USE_MOCK=true
npm run dev
```
Production: same-origin /api served by Static Web Apps. Local: `cd api && func start`, then `npm run dev` with VITE_USE_MOCK=false.
