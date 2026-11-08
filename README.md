# Ledger

Ledger is a full-stack storefront and order management application built for a configurable retail business. Customers can browse products, manage a cart, calculate shipping, and pay through Stripe Checkout. The owner can manage products, storefront content, and customer orders through an authenticated admin area.

**Live storefront:** [https://paxromana.onrender.com/](https://paxromana.onrender.com/)  
**API:** [https://ledger-0g6r.onrender.com](https://ledger-0g6r.onrender.com)  
**API health:** [https://ledger-0g6r.onrender.com/health](https://ledger-0g6r.onrender.com/health)

## Architecture

The frontend and backend are separate applications deployed as separate Render services.

```text
Customer / Store Owner
         |
         v
React + TypeScript + Vite
         |
         v
ASP.NET Core Minimal API (.NET 8)
    |       |        |        |
    v       v        v        v
PostgreSQL  Object   Stripe   External
  (Neon)    Storage  Checkout Services
            (S3)             Shippo, Gmail
```

- **Frontend:** React, TypeScript, React Router, and Vite.
- **Backend:** ASP.NET Core Minimal APIs on .NET 8.
- **Data access:** Entity Framework Core and Npgsql.
- **Database:** PostgreSQL hosted by Neon.
- **Object storage:** S3-compatible storage accessed through the AWS SDK for product images and storefront assets.
- **Payments:** Stripe Checkout and a webhook endpoint for payment events.
- **Shipping:** Shippo integration for retrieving shipping rates.
- **Email:** Gmail-based email service and a background shipment notification queue.
- **Authentication:** ASP.NET Core Identity with cookie authentication, antiforgery protection, and an owner-only authorization policy.

## Features

### Storefront

- Browse products and view product details and images.
- Organize products with tags.
- Add products to a shopping cart.
- Retrieve shipping rates and select a shipping method.
- Complete payment through Stripe Checkout.
- View order history and checkout status.
- Customize storefront branding and content, including the page title, header, hero content, footer, logo, and favicon.

### Product management

- Create, edit, and deactivate products.
- Manage descriptions, prices, inventory quantities, and tags.
- Upload product images.
- Search and filter products by visibility.
- Show or hide products without permanently deleting them.

### Order management

- View customer orders in the owner-only admin area.
- Search orders and filter active or archived orders.
- Archive and restore orders.
- Review order and shipping details.
- Update shipment tracking information.

## Technology Stack

| Area             | Technologies                            |
| ---------------- | --------------------------------------- |
| Backend          | C#, .NET 8, ASP.NET Core Minimal APIs   |
| Data access      | Entity Framework Core, Npgsql           |
| Database         | PostgreSQL, Neon                        |
| Frontend         | React, TypeScript, React Router, Vite   |
| Authentication   | ASP.NET Core Identity                   |
| Payments         | Stripe Checkout                         |
| Shipping         | Shippo                                  |
| Email            | Gmail integration                       |
| Object storage   | S3-compatible storage, AWS SDK for .NET |
| Backend testing  | xUnit, ASP.NET Core integration testing |
| Frontend testing | Vitest, Testing Library                 |
| Containerization | Docker                                  |
| CI/CD            | GitHub Actions                          |
| Hosting          | Render and Neon                         |

## Run Locally

### Prerequisites

- .NET 8 SDK
- Node.js and npm
- PostgreSQL

### 1. Configure the backend

Initialize User Secrets for the API project and configure a local PostgreSQL connection string:

```bash
dotnet user-secrets init --project src/Ledger.Api

dotnet user-secrets set "ConnectionStrings:Ledger" \
  "Host=localhost;Port=5433;Database=ledger;Username=ledger;Password=YOUR_LOCAL_PASSWORD" \
  --project src/Ledger.Api
```

Replace `YOUR_LOCAL_PASSWORD` with your local PostgreSQL password. This example assumes a database named `ledger`, a user named `ledger`, and PostgreSQL listening on port `5433`.

The application also uses configuration for external integrations, including object storage, Stripe, Shippo, Gmail, frontend CORS, and optional owner provisioning. Configure the integrations you intend to use before exercising those features. Keep credentials in User Secrets or environment variables; do not commit them.

### 2. Apply database migrations

```bash
dotnet ef database update \
  --project src/Ledger.Api \
  --startup-project src/Ledger.Api
```

### 3. Run the backend

```bash
dotnet run --project src/Ledger.Api
```

Swagger UI is enabled in the Development environment.

### 4. Run the frontend

In a separate terminal, from the repository root:

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

Vite proxies requests from `/api` to the local API at `http://localhost:5048`. Set `VITE_API_BASE_URL` to override the frontend API base URL. It defaults to `/api`.

## Tests and Quality Checks

Run the backend test suite:

```bash
dotnet test Ledger.sln
```

Run the frontend tests:

```bash
npm --prefix frontend test
```

Build the frontend:

```bash
npm --prefix frontend run build
```

Run the frontend linter:

```bash
npm --prefix frontend run lint
```

GitHub Actions restores, builds, and tests the .NET solution on pushes and pull requests.

## Deployment

- **Frontend:** Hosted on Render at [paxromana.onrender.com](https://paxromana.onrender.com/).
- **Backend:** Built using the repository Dockerfile and hosted on Render.
- **Database:** PostgreSQL hosted by Neon.
- **Object storage:** S3-compatible object storage configured through environment variables.
- **Backend deployment workflow:** The `Migrate and Deploy` GitHub Actions workflow runs on pushes to `master`. It applies pending EF Core migrations to Neon and then triggers the Render backend deployment.
- **Manual migrations:** The `Migrate Database` workflow can be run manually from GitHub Actions to apply pending migrations.

The deployment workflows use GitHub Actions secrets for production credentials, including the Neon connection string and Render deploy hook. Production secrets and API keys should never be committed to the repository.

## Project Structure

```text
.
├── .github/workflows/    # CI, backend deployment, and database migration workflows
├── frontend/             # React and TypeScript storefront
├── src/
│   └── Ledger.Api/       # ASP.NET Core API, endpoints, data, and services
├── tests/
│   └── Ledger.Tests/     # Backend tests
├── Dockerfile            # Multi-stage backend container build
├── Ledger.sln            # .NET solution
└── README.md
```
