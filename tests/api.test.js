import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../server/index.js';

let server;
let root;
before(async () => {
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  root = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => new Promise(resolve => server.close(resolve)));

test('search, combined filters, pagination and detail return consistent request data', async () => {
  const query = new URLSearchParams({ search: 'rmb-20481', department: 'Sales', stage: 'Manager Approval', page: '1', pageSize: '1' });
  const filtered = await fetch(`${root}/requests?${query}`);
  assert.equal(filtered.status, 200);
  const body = await filtered.json();
  assert.equal(body.total, 1);
  assert.equal(body.data[0].id, 'RMB-20481');
  const first = await (await fetch(`${root}/requests?page=1&pageSize=1`)).json();
  const second = await (await fetch(`${root}/requests?page=2&pageSize=1`)).json();
  assert.equal(first.total, 20);
  assert.notEqual(first.data[0].id, second.data[0].id);
  assert.equal((await fetch(`${root}/requests/${first.data[0].id}`)).status, 200);
  const sla = await (await fetch(`${root}/requests?slaOnly=true&pageSize=20`)).json();
  assert.ok(sla.data.every(row => row.waitingHours >= 24 && !['Approved', 'Rejected'].includes(row.status)));
});

test('mutations validate rejection and update assignment, approval, and summary', async () => {
  const id = 'RMB-20481';
  const rejectMissingReason = await fetch(`${root}/requests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reject' }) });
  assert.equal(rejectMissingReason.status, 400);
  const assignment = await fetch(`${root}/requests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'assign', reviewer: 'Amira Putri' }) });
  assert.equal((await assignment.json()).reviewer, 'Amira Putri');
  const beforeSummary = await (await fetch(`${root}/summary`)).json();
  const approval = await fetch(`${root}/requests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve' }) });
  assert.equal((await approval.json()).status, 'Approved');
  const afterSummary = await (await fetch(`${root}/summary`)).json();
  assert.equal(afterSummary.pending, beforeSummary.pending - 1);
  const repeatedApproval = await fetch(`${root}/requests/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve' }) });
  assert.equal(repeatedApproval.status, 409);
  const rejection = await fetch(`${root}/requests/RMB-20482`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reject', reason: 'Receipt does not show the business purpose.' }) });
  const rejected = await rejection.json();
  assert.equal(rejection.status, 200);
  assert.equal(rejected.status, 'Rejected');
  assert.equal(rejected.reason, 'Receipt does not show the business purpose.');
});
