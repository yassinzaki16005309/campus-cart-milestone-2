# CampusCart - Milestone 2

CampusCart is a university finance portal with an integrated campus store, built for **ICS 511 Web Programming (Winter 2026)**.
Milestone 2 turns the Milestone 1 Angular prototype into a full-stack application: a **Laravel REST API** with a **MariaDB/MySQL** database, real server-side authentication and sessions, automated tests, and **LogRocket** performance monitoring.

- Milestone 1 (front-end prototype, kept untouched): <https://github.com/yassinzaki16005309/campus-cart>
- The Milestone 1 UI, styling, pages and routes are preserved; only the data and authentication layer moved from browser storage to the server.

## Features

| Page | Roles | What it does |
|---|---|---|
| Home, Login, Sign up | everyone | Landing page, login (optional "remember my username"), account creation (always a student) |
| Profile | admin, accountant, student | View the account; the API also supports update and delete (see limitations) |
| Campus Store | admin, student | Browse products, cart, checkout ("pay now" or "add to student fees invoice") |
| Student Fees | admin, accountant, student | Students see and pay their own invoices; staff manage invoices |
| Staff Payroll | admin, accountant | Employees, salary components, monthly payroll report |
| Department Budget | admin, accountant | Income and expense entries per department with charts; store payments appear automatically as Bookstore income |

Navigation and data access are enforced twice: Angular route guards in the browser and role middleware on the server.

## Tech stack

| Layer | Technology |
|---|---|
| Front end | Angular 21 (standalone components, signals, lazy-loaded routes), TypeScript 5.9 |
| Back end | Laravel 13, PHP 8.3, Laravel Sanctum (cookie-based SPA authentication) |
| Database | MariaDB 10.11 (MySQL-compatible, as shipped with XAMPP), schema created with Laravel migrations |
| Monitoring | LogRocket SDK 12 (custom events) |
| Tests | PHPUnit 12 (backend), Karma + Jasmine (front end) |

```
Browser (Angular, http://localhost:4200)  <--JSON + session cookie-->  Laravel API (http://localhost:8000)  <-->  MariaDB
```

## Prerequisites

- Node.js (developed with Node 24; `package.json` pins npm 11.19.1) and a Chrome browser (for the Karma tests)
- PHP 8.3 or newer and Composer 2
- MariaDB or MySQL, for example via XAMPP. **MariaDB 10.11.19 is the verified environment; MySQL compatibility is unverified.** On Windows with XAMPP, `php` may not be on your PATH; use its full path, e.g. `C:\xampp\php\php.exe`.

## Setup

### 1. Database

Create two empty databases (for example in phpMyAdmin or the `mysql` client):

- `campus_cart` - the application database
- `campus_cart_test` - used only by the automated backend tests

### 2. Backend

```powershell
cd backend
composer install
copy .env.example .env        # macOS/Linux: cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan db:seed           # demo accounts, 4 employees, 6 products
php artisan serve --host=127.0.0.1 --port=8000
```

`backend/.env.example` is already configured for MariaDB/MySQL (`campus_cart`, host `127.0.0.1`, port `3306`, user `root`, empty password). If your database uses different credentials, change them in your local `.env`. **Never commit `.env`.**

Optional demonstration data (3 invoices for the demo student and 8 budget entries across the four departments). It is **not** run by `db:seed`:

```powershell
php artisan db:seed --class=DemoDataSeeder
```

Both seeders are safe to run repeatedly: they never create duplicates and never overwrite existing passwords, prices, stock, invoices or transactions.

Notes on how records are matched (so re-seeding does not surprise you):

- Each seeder uses its own matching rule. Employees are matched by (name, department) and products by name: if you rename or move one of those seeded records, the next `db:seed` will not recognise it and will create the original again. Demo users are matched by username or email (an existing match is left untouched, with a warning). `DemoDataSeeder` matches invoices by (student, description) and transactions by (department, type, description), ignoring amounts, dates and status.
- `DemoDataSeeder` needs the demo student account created by `db:seed`. Without it, the invoices are skipped with a warning, but the budget transactions are still created.

### 3. Front end

From the repository root:

```powershell
npm ci
npm start
```

Open **<http://localhost:4200>**. Use `localhost`, not `127.0.0.1`. The front end calls the API at `http://localhost:8000` (set in `src/app/core/config/api.config.ts`), so if you open the app at `127.0.0.1:4200` the browser treats the API as a different site and does not send the `SameSite=Lax` session cookie on those requests, and login appears to fail. The server itself would accept both origins (`FRONTEND_URL`, `SANCTUM_STATEFUL_DOMAINS` and `config/cors.php` all include `127.0.0.1:4200`); the cookie behaviour is what breaks. Keep the app on `localhost:4200` and the API on `localhost:8000` (`php artisan serve --host=127.0.0.1` still works, since `localhost` resolves to it).

## Demo accounts (development only)

The seeders create these accounts as a convenience for local development and demonstrations; they are not a Milestone 1 requirement. Their passwords are **publicly documented** (the login page lists them). Never seed them into a real or public deployment.

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `Admin123` |
| Accountant | `accountant` | `Account123` |
| Student | `student` | `Student123` |

## REST API overview

All routes are under `/api` (plus `GET /sanctum/csrf-cookie`). Everything except register and login requires a logged-in session. Responses are JSON with a human-readable `message`; errors use 401, 403, 404, 405, 409, 419 (CSRF), 422 (validation) and 429 (too many requests: `/login` and `/register` are each limited to 20 per minute).

| Area | Endpoints | Roles |
|---|---|---|
| Authentication | `POST /register`, `POST /login` (throttled), `POST /logout`, `GET /me` | everyone / logged in |
| Profile | `GET`, `PUT`/`PATCH`, `DELETE /profile` | logged in (own account) |
| Employees and payroll | `/employees` (CRUD), `GET /payroll/report` | admin, accountant |
| Budget | `/transactions` (CRUD). Store-purchase transactions are read-only (update/delete answer 409); manual transactions can be edited and deleted | admin, accountant |
| Invoices | `GET`/`POST /invoices`, `GET /invoices/{id}`, `POST /invoices/{id}/pay` | logged in (students: own only; `POST` by a student creates an invoice for themselves, staff may pass `studentId`) |
| Invoice maintenance | `PUT`/`PATCH`/`DELETE /invoices/{id}` (only manual, unpaid invoices; paid or store-purchase invoices answer 409) | admin, accountant |
| Store | `GET /products`, `GET /products/{id}`, `POST /checkout` | admin, student |
| Product management | `POST`, `PUT`/`PATCH`, `DELETE /products` | admin |
| Orders | `GET /orders`, `GET /orders/{id}` | logged in (students: own orders; admin and accountant: all) |

## Data storage and security

Where each kind of data lives and why:

| Data | Where | How |
|---|---|---|
| Users (bcrypt-hashed passwords), employees, products, orders, order items, invoices, transactions | MariaDB database | Only through the REST API |
| Who is logged in | Server-side session in the `sessions` table (`SESSION_DRIVER=database`) | Session cookie `laravel-session` (HttpOnly, SameSite=Lax, 120 minutes); the name comes from `APP_NAME` in `.env` (`Laravel` in `.env.example`) |
| CSRF protection | `XSRF-TOKEN` cookie | Readable by Angular, echoed back in a request header; validated by Laravel |
| "Remember my username" | Cookie `campusCartRememberedUsername` | Set by Laravel via `Set-Cookie` (username only, 30 days, SameSite=Lax); the login form reads it |
| Shopping cart | Memory in the browser | Lost on reload; becomes an order at checkout |
| `localStorage` / `sessionStorage` | **Not used for application data** | The `Storage` helper (`src/app/core/services/storage.ts`) wraps them, but the app only calls its cookie method (to read the remembered username); nothing about the user, login or data is kept in browser storage |
| Payment card | Last 4 digits only | The full number never leaves the browser or reaches the database |

Security measures:

- **Authentication:** Sanctum cookie sessions with CSRF protection; both `POST /login` and `POST /register` are rate-limited (20 requests per minute each; further requests get 429).
- **Authorization:** role middleware on the server and role guards in Angular; students can only see and pay their own invoices.
- **Validation and integrity:** server-side request validation; totals and prices are always computed by the server; database CHECK constraints, composite foreign keys and row locks prevent inconsistent invoices, duplicate income and negative stock.
- **CORS:** limited to `FRONTEND_URL` (default `http://localhost:4200`) and `http://127.0.0.1:4200`, with credentials.
- **Privacy:** deleting a profile soft-deletes and anonymises the user while keeping order history.
- **Development note:** the `Secure` cookie flag is off because local development runs over plain HTTP. In production, serve over HTTPS and set `SESSION_SECURE_COOKIE=true`.
- **Server-side session feature (bonus):** the login session is kept on the server in the `sessions` table rather than in the browser.

## Testing

Backend (PHPUnit, 98 tests as of the last verified run). Requirements: `backend/.env` must exist with a valid `APP_KEY` (`php artisan key:generate`), and the database user must have access to both `campus_cart` and `campus_cart_test`. `phpunit.xml` forces the `campus_cart_test` database, so the application database is never touched. The suite rebuilds `campus_cart_test` on every run, so never keep data there.

Cached Laravel configuration can defeat this isolation. If `php artisan config:cache` was ever run, Laravel loads the cached configuration (with `DB_DATABASE=campus_cart` baked in) and ignores the environment values set by `phpunit.xml`; the tests would then rebuild the application database. Nothing else in the test setup guards against this, so run `php artisan config:clear` first. `composer test` does this automatically.

```powershell
cd backend
php artisan config:clear
php vendor/bin/phpunit        # or simply: composer test
```

Front end (Karma + Jasmine) and production build:

```powershell
npm test               # watch mode; add -- --no-watch for a single run
npm run build
```

## Performance monitoring with LogRocket

Three performance metrics are measured in the Angular app and sent to LogRocket as custom events, each with a numeric `duration_ms`. The code is in `src/app/core/monitoring/`.

| Metric | Event(s) | Measured |
|---|---|---|
| Route navigation time | `Route Navigation Started` / `Completed` | Router navigation start to end, including the lazy-loaded page |
| API response time | `API Response` | One event per finished API call (endpoint without ids, method, status) |
| Checkout completion time | `Checkout Started` / `Completed` / `Failed` | Click to server answer |

- **Dashboard:** "CampusCart Performance Durations" has three charts, each the 50th percentile of `duration_ms` for one event. It lives in the team's LogRocket trial organisation and may not remain available after the trial ends, so screenshots were saved in [`logrocket-evidence/`](logrocket-evidence/) (see its `INDEX.md`).
- **Case study (normal vs Slow 4G):** route navigation clearly slowed under throttling (about 47 ms normal vs about 705 ms on Slow 4G). API and checkout times showed no clear difference, because the local development API already takes roughly half a second per call.
- **Event cap:** `API Response` events are capped at 150 per page load (`MAX_API_EVENTS_PER_PAGE_LOAD`) to limit volume; route and checkout events are not capped.
- **Configuration:** the App ID is in `src/app/core/config/logrocket.config.ts`. It is a public identifier, not a secret. If it is left empty, monitoring is completely off and the SDK is not even downloaded.
- **Privacy:** LogRocket receives no request or response headers or bodies, no passwords, cookies or tokens; all page text, inputs and images are masked in replays; query strings and fragments are removed from recorded page URLs (network request URLs are recorded as-is, so never put sensitive data in an API URL); console, IP and exception capture are off; users are identified by id and role only.

## Repository layout

```
.
├─ src/                     Angular application (core services, interceptors, monitoring, features, shared)
├─ public/                  Static assets (product images)
├─ backend/                 Laravel API
│  ├─ app/                  Controllers, models, services, form requests, resources, middleware
│  ├─ database/             Migrations, seeders (incl. optional DemoDataSeeder), factory
│  ├─ routes/api.php        REST routes and role matrix
│  └─ tests/                PHPUnit feature tests
├─ logrocket-evidence/      LogRocket dashboard, chart, replay and privacy screenshots
├─ angular.json, package.json, tsconfig*.json
└─ README.md
```

## Known limitations

- Profile **update and delete** exist in the API but have no screen (the Milestone 1 UI was kept unchanged). Demonstrate them with Postman or curl: send `Origin` and `Referer` set to `http://localhost:4200`, first call `GET /sanctum/csrf-cookie`, and send the `X-XSRF-TOKEN` header.
- The front end expects the API at `http://localhost:8000` and the app at `http://localhost:4200`.
- Email confirmation on subscription (bonus) is not implemented; there is no subscription feature.
- The demo passwords are public by design (see above).
