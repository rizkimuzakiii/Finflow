# Finflow — Approval Queue

React + TypeScript implementation of the desktop screen in the supplied image, with a responsive layout and a small local REST API.

## Run locally

```sh
npm install
npm run api
```

In a second terminal:

```sh
npm run dev
```

Vite runs at `http://localhost:5173`; the mock API runs at `http://localhost:4174`. `lucide-react`, Express, and CORS are the added UI/API dependencies. No production backend is included.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

## Mock API and behavior

- `GET /api/requests`: supports `search`, `department`, `stage`, `amount` (`under10`, `10to25`, `over25`), `submission` (`today`, `week`), `status`, `priority`, pending-only/SLA-only alerts, `page`, and `pageSize` together.
- `GET /api/requests/:id`: request detail.
- `GET /api/summary`: aggregates the in-memory data, so approve/reject updates amounts and counts.
- `PATCH /api/requests/:id`: actions `approve`, `reject` (requires `reason`), and `assign` (requires `reviewer`).
- Approve and reject are available for pending requests; already approved or rejected rows are ineligible. The API rejects a missing rejection reason. Assignments are allowed for every request.
- Save View uses `localStorage`. Report downloads selected visible-page rows as CSV.
- Development states: open `/?scenario=loading` for a delayed response, `/?scenario=empty` for an empty list, `/?scenario=network-error` for a connection failure, or `/?scenario=http-error` for an HTTP 500 response.

## Assumptions and differences

- The linked Figma node resolves to a different “Submission Queue” screen. The supplied Finflow screenshot is the visual source used for this page.
- The supplied screenshot's headline, overview totals, workload counts, pipeline totals, and visible row count do not reconcile with one another. This implementation uses 20 deterministic fictional records (reference time `2026-08-18T09:00:00+07:00`) and calculates overview and pipeline numbers from the same API dataset. Therefore its amounts/counts differ from the screenshot while retaining the displayed labels, hierarchy, and currency format.
- No mobile reference was supplied. On small screens the sidebar becomes a drawer, card grids stack, and the wide table scrolls horizontally inside its own container.
- Global search feeds the queue's employee/request ID search. Other navigation destinations and notifications are visibly disabled because they are outside this one-page scope.

## Request data flow

The queue fetches a typed, paginated API response and dashboard summary. Search/filter/page state drives the list query; the returned rows populate the table. A user selects eligible rows and confirms an approve/reject or reviewer assignment dialog. The UI PATCHes each selected ID, then reloads summary data and updates the rows from the mutation response. Failures keep the dialog open and show an error.
