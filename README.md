# Ledger

Ledger is a REST API for product management, built with ASP.NET Core and PostgreSQL. It demonstrates REST API design, database persistence, automated testing, containerization, and CI/CD.

## Live API

**Base URL:** https://ledger-0g6r.onrender.com

### Endpoints

| Method | Endpoint         | Description                        |
| ------ | ---------------- | ---------------------------------- |
| GET    | `/health`        | Check API health                   |
| GET    | `/products`      | List active products               |
| GET    | `/products/{id}` | Get a product by ID                |
| POST   | `/products`      | Create a product                   |
| PUT    | `/products/{id}` | Update a product                   |
| DELETE | `/products/{id}` | Deactivate a product (soft delete) |

The API is hosted on Render, with PostgreSQL provided by Neon. The free web service may sleep after inactivity, so the first request after a period of inactivity may take longer.

## Tech Stack

- C# and .NET 8
- ASP.NET Core Minimal APIs
- Entity Framework Core
- PostgreSQL and Npgsql
- xUnit and ASP.NET Core integration testing
- Docker
- GitHub Actions for continuous integration and database migrations
- Render and Neon for hosting

## Run Locally

### Prerequisites

- .NET 8 SDK
- Docker
- PostgreSQL

### 1. Start PostgreSQL

Start a local PostgreSQL instance and ensure it is accessible on port `5433`, with a database named `ledger` and a user named `ledger`.

### 2. Configure the connection string

From the repository root, initialize User Secrets for the API project and set the local database connection string:

```bash
cd src/Ledger.Api
dotnet user-secrets init
dotnet user-secrets set "ConnectionStrings:Ledger" \
  "Host=localhost;Port=5433;Database=ledger;Username=ledger;Password=YOUR_LOCAL_PASSWORD"
cd ../..
```

Replace `YOUR_LOCAL_PASSWORD` with your local PostgreSQL password. User Secrets keeps local credentials out of source control.

### 3. Apply database migrations

From the repository root:

```bash
dotnet ef database update \
  --project src/Ledger.Api \
  --startup-project src/Ledger.Api
```

### 4. Run the API

```bash
dotnet run --project src/Ledger.Api
```

Use the URL printed in the terminal to access the API. Swagger UI is available at `/swagger` only when enabled by the current application configuration.

## Tests

Run the test suite from the repository root:

```bash
dotnet test Ledger.sln
```

GitHub Actions builds the solution and runs the tests on pushes and pull requests. A Husky.Net pre-commit hook also runs the tests locally before each commit.

## Deployment

- **API:** Render builds and hosts the API using the repository's `Dockerfile`.
- **Database:** Neon PostgreSQL.
- **Continuous integration:** GitHub Actions restores, builds, and tests the solution.
- **Database migrations:** The `Migrate Database` GitHub Actions workflow can be triggered manually to apply pending EF Core migrations to Neon.

The migration workflow reads the database connection string from the `NEON_CONNECTION_STRING` GitHub Actions secret. Production credentials should never be committed to source control.

## Project Structure

```text
src/Ledger.Api/       API endpoints, models, and database context
tests/Ledger.Tests/   Integration tests
.github/workflows/    CI and database migration workflows
Dockerfile            Container build configuration
.dockerignore         Files excluded from the Docker build context
```
