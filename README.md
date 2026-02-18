# Payment Integration with PSP Simulator

A Fastify-based API that integrates with a local mock Payment Service Provider (PSP) to create card transactions, handle webhooks, and simulate 3DS flow. Runs entirely locally with Dockerized PostgreSQL.

## Architecture Decisions

### Project Structure

```
src/
├── config/          # Centralized environment configuration
├── domain/          # Business logic (transaction state machine)
├── enums/           # Status constants and type definitions
├── types/           # TypeScript interfaces and type declarations
├── repositories/    # Data access layer (Postgres + in-memory for tests)
├── services/        # Business orchestration (transaction, webhook)
├── routes/          # HTTP route handlers (thin, delegate to services)
├── plugins/         # Fastify plugins (database, swagger)
├── psp-simulator/   # Mock PSP (routes + service)
└── scripts/         # Utility scripts (migrations)
```

### Key Decisions

- **Clean separation of concerns**: Routes → Services → Repositories → Domain. No business logic in route handlers.
- **State machine**: Centralized in `src/domain/transactionStateMachine.ts`. All state transitions are validated here. Terminal states (`SUCCESS`, `FAILED`) cannot transition further.
- **Dependency injection**: The `buildApp()` factory accepts an optional repository override, enabling tests to run with an in-memory store without needing Docker or PostgreSQL.
- **Idempotent webhooks**: Duplicate webhooks with the same terminal status are silently ignored. Invalid transitions return HTTP 409.
- **PSP Simulator**: Runs in the same Fastify process on `/psp` prefix. Card number prefix determines outcome:
  - `4111` → 3DS Required (client must visit redirect URL within 5 minutes)
  - `5555` → Success (webhook fires immediately)
  - `4000` → Failed (webhook fires immediately)
- **3DS expiry**: If the client doesn't complete 3DS verification within **5 minutes**, the PSP simulator automatically sends a `FAILED` webhook. This mirrors real-world PSP behavior where abandoned 3DS sessions expire.
- **Safe transactions**: Webhook processing uses `BEGIN` → `SELECT ... FOR UPDATE` → `COMMIT` to prevent race conditions from concurrent webhook deliveries.
- **Colorized logging**: Uses `pino-pretty` for clean, NestJS-style console output in development.

## How to Start the App

### Prerequisites

- Node.js 18+
- Docker & Docker Compose

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL
docker-compose up -d

# 3. Run database migrations
npm run migrate

# 4. Start the server
npm run dev
```

The server runs on `http://localhost:3000`. API docs are at `http://localhost:3000/docs`.

## How to Run Tests

Tests run with Jest using an in-memory repository — no Docker or database required.

```bash
npm test
```

## Example Curl Requests

### Success Flow (card prefix 5555)

```bash
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "currency": "EUR",
    "cardNumber": "5555111111111111",
    "cardExpiry": "12/25",
    "cvv": "123",
    "orderId": "order_1",
    "callbackUrl": "http://localhost:3000/webhooks/psp"
  }'
```

### Failed Flow (card prefix 4000)

```bash
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "currency": "EUR",
    "cardNumber": "4000111111111111",
    "cardExpiry": "12/25",
    "cvv": "123",
    "orderId": "order_2",
    "callbackUrl": "http://localhost:3000/webhooks/psp"
  }'
```

### 3DS Flow (card prefix 4111)

```bash
curl -X POST http://localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "currency": "EUR",
    "cardNumber": "4111111111111111",
    "cardExpiry": "12/25",
    "cvv": "123",
    "orderId": "order_3",
    "callbackUrl": "http://localhost:3000/webhooks/psp"
  }'
```

Response includes `threeDsRedirectUrl`. Open it in a browser to simulate 3DS verification — after a short delay, a webhook fires and the transaction becomes `SUCCESS`.

> **Note:** If you don't open the 3DS link within 5 minutes, the transaction automatically expires and transitions to `FAILED`.

### Get Transaction Status

```bash
curl http://localhost:3000/transactions/<transaction-id>
```
