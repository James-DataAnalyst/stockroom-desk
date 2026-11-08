# Stockroom Desk

Stockroom Desk is an order and inventory app for a warehouse operator. It shows what is physically on the shelf, what is already reserved for customers, and what can still be sold at each location.

The sample workspace follows **Meridian Supply Co.**, a fictional Lagos distributor with stock at **Ikeja Main** and **Lekki Hub**. Order values use Nigerian naira and activity timestamps use West Africa Time.

[Screenshots](#screenshots) · [Run locally](#run-locally) · [Reproduce the walkthrough](#reproduce-the-walkthrough) · [Stock rules](#stock-rules) · [Build and test](#build-and-test)

## Screenshots

### Overview

See orders ready to dispatch, stock shortages, recent orders and order volume over 7 or 30 days. The dashboard below includes one order created after seeding.

![Desktop overview with the dispatch queue, order volume, waiting orders and recent orders](docs/screenshots/01-overview-desktop.png)

### Orders and shortages

Search by order or customer, filter by status or show overdue orders, and export the filtered orders to CSV. Each row shows the promised date, location and order value.

![Orders list with status filters, promised dates and values](docs/screenshots/02-orders-list.png)

Opening a waiting order shows which product is short. Riverstone Retail’s order **SO-02400** needs six boxes of hibiscus tea (`TE-HIB-12`) at Ikeja Main, where one box is available.

![Riverstone Retail order with six boxes of hibiscus tea ordered and one available](docs/screenshots/03-order-waiting.png)

### Dispatch and order history

The walkthrough uses a separate order, **SO-02402**, for six cartons of still water at Ikeja Main. The detail view records when the order was created, its stock was reserved and the order was dispatched.

![Dispatched Maple Corner Stores order with six cartons of still water and timestamped history](docs/screenshots/04-order-dispatched.png)

### Inventory and stock movements

Inventory shows **on hand**, **reserved**, **available** and the **reorder point** for each product and location. Operators can receive stock, filter low-stock products and export the filtered inventory to CSV.

![Inventory showing 18 cartons on hand, eight reserved and ten available for BW-750-24](docs/screenshots/05-inventory-balance.png)

Activity shows the quantity changed by each event. For `BW-750-24`, receipt **GRN-1028** adds 12 cartons on hand, reserving **SO-02402** adds six reserved cartons, and dispatch reduces both on-hand and reserved quantities by six.

![Activity log showing receipt GRN-1028 and the reservation and dispatch of SO-02402](docs/screenshots/06-activity-log.png)

### PostgreSQL verification

The result in pgAdmin matches Inventory for the same SKU and location after dispatch. Ikeja Main has **18 on hand, 8 reserved and 10 available**.

![pgAdmin query and Data Output row matching the app's inventory balance for BW-750-24](docs/screenshots/07-postgresql-check.png)

### Mobile overview

The mobile layout keeps **New order**, **Receive stock** and the dispatch queue within reach. The bottom bar links to the four main screens.

<img src="docs/screenshots/08-overview-mobile.png" width="300" alt="Mobile overview with the dispatch queue, quick actions and bottom navigation">

## Run locally

Install **Node.js 22.12 or newer** and run a PostgreSQL server. The walkthrough was recorded with PostgreSQL 18.

1. Clone the repository and open the project folder.

   ```sh
   git clone https://github.com/James-DataAnalyst/stockroom-desk.git
   cd stockroom-desk
   ```

2. Create an empty PostgreSQL database named `stockroom_demo` in pgAdmin or psql.
3. In PowerShell, copy the example configuration.

   ```powershell
   Copy-Item .env.example .env
   ```

4. Set `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` and `PGDATABASE` in your local `.env` to match your PostgreSQL connection.
5. Install dependencies, apply the schema and seed data, and start the app.

   ```powershell
   npm.cmd ci
   npm.cmd run db:setup
   npm.cmd run dev
   ```

6. Open the address printed in the terminal. [Default local address](http://127.0.0.1:5173)

On macOS or Linux, use `cp .env.example .env` for step 3 and `npm` in place of `npm.cmd`.

A fresh database contains **2,401 orders, 6,001 order lines, 72 products, 180 customers and 11,113 stock movements**.

## Reproduce the walkthrough

Start from a freshly seeded database to get the balances below. Use **Ikeja Main** and **Still water 750 ml** (`BW-750-24`). Quantities are in cartons of 24 bottles.

1. Open **Inventory** and search for `BW-750-24`. There are 12 cartons on hand and eight already reserved, leaving four available.
2. Select **New order**. Choose **Maple Corner Stores**, set **Ikeja Main**, leave the promised date at today or choose a future date, and add six cartons. Select **Create order**. The order should show **Waiting for stock**.
3. Select **Receive stock**, enter 12 cartons for the same product and location, use `GRN-1028` as the supplier reference, and select **Save receipt**.
4. Reopen the new order in **Orders** and select **Reserve stock**. Then select **Dispatch order** and **Confirm dispatch**.
5. Open **Activity**, select **Ikeja Main** and search `BW-750-24` to trace the receipt, reservation and dispatch.

| Step | On hand | Reserved | Available |
| --- | ---: | ---: | ---: |
| Order waiting for stock | 12 | 8 | 4 |
| Receive 12 cartons | 24 | 8 | 16 |
| Reserve 6 cartons | 24 | 14 | 10 |
| Dispatch 6 cartons | 18 | 8 | 10 |

Available stock stays at ten after dispatch because the six cartons were already set aside during reservation.

### Check the balance in pgAdmin

Open the Query Tool for `stockroom_demo`, run the query below and compare its **Data Output** row with **Inventory** for the same SKU and location. [More inspection queries](db/inspect.sql)

```sql
SELECT location, sku, on_hand, reserved, available
FROM stockroom.stock_levels
WHERE location_code = 'IKJ'
  AND sku = 'BW-750-24';
```

## Stock rules

- PostgreSQL calculates available stock as `on_hand - reserved` and constrains reserved stock to the range from zero to the on-hand quantity. [SQL schema](db/001_schema.sql)
- The workflow locks the relevant inventory rows while it checks and reserves stock. Stock balances, movement records and order events commit together. Cancelling a reserved order releases the units for another order.
- Order and receipt submissions carry request IDs. Retrying an unchanged request returns the existing record. [Workflow implementation](server/workflow.mjs)

## Stack and project layout

The interface uses **React and TypeScript** with **Vite**. A **Node.js and Express** API handles requests and applies the stock workflow in **PostgreSQL**. **pgAdmin** was used to inspect the database during the walkthrough.

| Path | Contents |
| --- | --- |
| `src/` | Overview, Orders, Inventory, Activity and responsive interface |
| `server/` | Express API, validation and transactional stock workflows |
| `db/` | PostgreSQL schema, fictional seed data and inspection queries |
| `test/` | Integration tests for orders and stock movements |
| `docs/screenshots/` | Screenshots used in this README |

## Build and test

Stop the development server before starting the built app.

```powershell
npm.cmd run build
npm.cmd start
```

For integration tests, create a separate empty PostgreSQL database such as `stockroom_test` on the same server. The tests load sample data and perform stock writes in that database. For a repeat run, create a fresh test database and set the variable to its name.

```powershell
$env:STOCKROOM_TEST_DATABASE = "stockroom_test"
npm.cmd test
```

On macOS or Linux, use `STOCKROOM_TEST_DATABASE=stockroom_test npm test`.

Stockroom Desk is a local, single-operator demo with fictional data. [Font licences](public/licenses/)

Built by **James Isaac**. [Portfolio](https://www.jamesisaac.dev/) · [LinkedIn](https://www.linkedin.com/in/james-bideveloper/)
