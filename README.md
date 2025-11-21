# Order Execution Engine

High-performance Solana DEX order execution engine with intelligent routing, queue-based processing, and real-time WebSocket status updates.

## 🌐 Live Deployment

Base URL: `https://order-execution-engine-7jqd.onrender.com`

- Health: `GET /health`
- Execute Order: `POST /api/orders/execute`
- Get Order: `GET /api/orders/{orderId}`
- Order History: `GET /api/orders/history/{walletAddress}`
- Queue Metrics: `GET /api/queue/metrics`
- WebSocket (status stream):  
  `wss://order-execution-engine-7jqd.onrender.com/api/orders/ws?orderId={orderId}`

---

## ✨ Features

- Market order execution with slippage checks.
- Simulated DEX routing between Raydium and Meteora with best‑price selection.
- HTTP → WebSocket pattern: submit via HTTP, stream status via WebSocket.
- BullMQ + Redis queue with configurable concurrency and exponential backoff.
- PostgreSQL persistence for order history and failure reasons.
- Postman collection and Jest test suite.

---

## 🧱 Tech Stack

- **Runtime:** Node.js (>= 18), TypeScript
- **Framework:** Fastify (+ `@fastify/websocket`, CORS)
- **Queue:** BullMQ + Redis/Valkey
- **Database:** PostgreSQL (`pg`)
- **Logging:** Pino
- **Testing:** Jest + ts-jest

---

## 🧬 Core Design & Order Flow

1. **Order submission (HTTP)**  
   - Client sends `POST /api/orders/execute` with:
     - `tokenIn`, `tokenOut`, `amountIn`, `slippage`, `walletAddress`, `orderType`.
   - Server:
     - Validates payload.
     - Generates `orderId`.
     - Persists order in Postgres with status `pending`.
     - Enqueues the order into BullMQ queue.
     - Returns `{ orderId, wsUrl }`.

2. **Routing & execution (worker)**  
   - A BullMQ worker consumes jobs with concurrency `QUEUE_CONCURRENCY` (e.g., 10).
   - For each order:
     - Status sequence:
       - `routing`: fetch quotes from Raydium & Meteora (simulated).
       - `building`: simulate swap building.
       - `submitted`: simulate transaction submission.
       - `confirmed` or `failed`.
     - `DexRouterService`:
       - Computes quotes for both DEXes.
       - Logs pricing, fees, effective prices.
       - Picks the best `effectivePrice` and logs savings.

3. **WebSocket status streaming**  
   - Client opens:
     - `wss://order-execution-engine-7jqd.onrender.com/api/orders/ws?orderId={orderId}`
   - `WebSocketService` keeps a registry of active connections per `orderId`.
   - `OrderProcessorWorker` pushes every status change to connected clients:
     - `pending → routing → building → submitted → confirmed/failed`.

4. **Retries & failures**  
   - BullMQ job options:
     - Attempts: `MAX_RETRIES` (e.g., 3).
     - Backoff: exponential with configured delay.
   - On final failure:
     - Status set to `failed`.
     - Error message persisted in Postgres for post‑mortem analysis.
     - WebSocket emits final `failed` update.

---

## 🚀 Running Locally

### 1. Prerequisites

- Node.js >= 18
- npm >= 9
- Local PostgreSQL
- Local Redis (or Valkey)

### 2. Install dependencies

```
npm install
```

### 3. Environment variables

Create `.env` (or `.env.local`) based on `.env.example`:

```
PORT=3000

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password
POSTGRES_DB=order_engine

REDIS_HOST=localhost
REDIS_PORT=6379

QUEUE_CONCURRENCY=10
MAX_RETRIES=3
```

### 4. Start services

- Start Postgres & Redis (or use `docker-compose` if provided).
- Run:

```
npm run build
npm start
```

Server will listen on `http://localhost:3000`.

For dev with auto‑reload:
```
npm run dev
```

---

## 📡 API Endpoints

### Health

```
GET /health
```

Response:

```
{
"status": "healthy",
"timestamp": "2025-11-21T17:49:40.333Z"
}
```

### Submit Market Order

```
POST /api/orders/execute
Content-Type: application/json
```

Body:

```
{
"tokenIn": "SOL",
"tokenOut": "USDC",
"amountIn": 1.5,
"slippage": 0.01,
"walletAddress": "wallet-123",
"orderType": "market"
}
```

Response:

```
{
"orderId": "uuid",
"status": "pending",
"wsUrl": "wss://order-execution-engine-7jqd.onrender.com/api/orders/ws?orderId=uuid"
}
```

### Get Order

```
GET /api/orders/{orderId}
```

### Order History

```
GET /api/orders/history/{walletAddress}
```

### Queue Metrics

```
GET /api/queue/metrics
```

---

## 🔌 WebSocket Usage

- URL pattern:

```
wss://order-execution-engine-7jqd.onrender.com/api/orders/ws?orderId={orderId}
```

- Messages follow this shape:

```
{
"orderId": "uuid",
"status": "routing",
"timestamp": "2025-11-21T17:49:40.333Z",
"data": {
"selectedDex": "raydium",
"estimatedOutput": 99.99,
"txHash": "FAKE_TX_HASH",
"actualOutput": 99.5,
"executionTime": "1.23s",
"error": null
}
}
```

Typical status sequence:

```
pending → routing → building → submitted → confirmed / failed
```

---

## 🧪 Testing

### Jest test suite

- Unit and integration tests:
  - Routing logic (DexRouterService).
  - Queue behavior (BullMQ worker).
  - WebSocket lifecycle (connection, message broadcast, close).

Run tests:

```
npm test
```

Coverage:

```
npm run test:coverage
```

---

## 📬 Postman Collection

A complete Postman collection is included:

- File: `postman_collection.json`
- Contains:
  - Health check
  - Submit market order
  - Get order by ID
  - Order history by wallet
  - Queue metrics
  - WebSocket request template

To use:

1. Import `postman_collection.json` into Postman.
2. Set `baseUrl` variable to either:
   - `http://localhost:3000` (local)
   - `https://order-execution-engine-7jqd.onrender.com` (deployed)

---

## 🌍 Deployment (Render – Free Tier)

This project is deployed on Render as a free Web Service:

- Web Service:
  - Build command: `npm install && npm run build`
  - Start command: `npm start`
  - Instance type: Free

- Render environment variables:

```
PORT=3000

POSTGRES_HOST=<render-postgres-host>
POSTGRES_PORT=5432
POSTGRES_USER=<render-postgres-user>
POSTGRES_PASSWORD=<render-postgres-password>
POSTGRES_DB=<render-postgres-db>

REDIS_HOST=<render-key-value-host>
REDIS_PORT=6379

QUEUE_CONCURRENCY=10
MAX_RETRIES=3
```


---

## 🧪 WebSocket Test Page

For a simple visual demo, use `test-websocket.html`:

- Opens a page that:
  - Submits orders to the API.
  - Connects to the WebSocket for each `orderId`.
  - Renders live status updates.

Key URLs inside the file:

```
const API_BASE = 'https://order-execution-engine-7jqd.onrender.com';

// HTTP:
fetch(${API_BASE}/api/orders/execute, ...)

// WebSocket:
new WebSocket(wss://order-execution-engine-7jqd.onrender.com/api/orders/ws?orderId=${orderId})
```

Just open the HTML file in a browser to see real-time updates from the deployed backend.
