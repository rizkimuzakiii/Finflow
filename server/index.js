import express from 'express';
import cors from 'cors';
import { pathToFileURL } from 'node:url';

const app = express();
app.use(cors());
app.use(express.json());
const people = ['Netya Syafa', 'Citra Permata', 'Dewi Lestari', 'Aisyah Kuspinasti', 'Raka Pratama', 'Nadia Putri', 'Bima Santoso', 'Farah Anindya', 'Rizky Maulana', 'Sinta Maharani', 'Dimas Saputra', 'Alya Rahman'];
const departments = ['Sales', 'Product', 'Engineering', 'Marketing', 'Operations', 'People'];
const stages = ['Manager Approval', 'Finance Review', 'Director Approval'];
const statuses = ['Ready for Finance', 'Waiting for Manager', 'Under Review', 'Needs Documents'];
const now = Date.parse('2026-08-18T09:00:00+07:00');
let requests = Array.from({ length: 20 }, (_, i) => ({
  id: `RMB-${20481 + i}`, employee: people[i % people.length], department: departments[i % departments.length],
  submittedAt: new Date(now - (i % 6) * 86400000 - (i % 8) * 3600000).toISOString(),
  amount: [30000000, 22500000, 15300000, 18700000, 42000000, 8500000, 12500000, 9900000, 27500000, 4600000][i % 10],
  priority: i < 5 ? 'Urgent' : i % 4 === 0 ? 'High' : 'Normal', stage: stages[i % stages.length], status: statuses[i % statuses.length],
  waitingHours: [7.3, 9.5, 7.3, 5.75, 26, 2, 13, 48][i % 8], reviewer: null,
  ...(i >= 15 ? { status: i >= 18 ? 'Rejected' : 'Approved' } : {}),
  recommendedAction: i % 3 === 0 ? 'Approve' : i % 3 === 1 ? 'Follow-up Manager' : 'Review Documents',
  reason: '',
}));
const scenario = (req, res, next) => {
  if (req.query.scenario === 'loading') return setTimeout(next, 1500);
  if (req.query.scenario === 'network-error') return res.status(503).json({ message: 'Development scenario: simulated network error.' });
  if (req.query.scenario === 'http-error') return res.status(500).json({ message: 'Development scenario: simulated HTTP error.' });
  if (req.query.scenario === 'empty') return res.json({ data: [], total: 0, page: 1, pageSize: Number(req.query.pageSize || 5) });
  next();
};
app.get('/api/requests', scenario, (req, res) => {
  const { search = '', department = '', stage = '', amount = '', submission = '', status = '', priority = '', pendingOnly = '', slaOnly = '', page = '1', pageSize = '5' } = req.query;
  let list = requests.filter(r => (!search || `${r.employee} ${r.id}`.toLowerCase().includes(String(search).toLowerCase())) && (!department || r.department === department) && (!stage || r.stage === stage) && (!status || r.status === status) && (!priority || r.priority === priority) && (pendingOnly !== 'true' || !['Approved','Rejected'].includes(r.status)) && (slaOnly !== 'true' || (r.waitingHours >= 24 && !['Approved','Rejected'].includes(r.status))) && (!amount || (amount === 'under10' ? r.amount < 10000000 : amount === '10to25' ? r.amount >= 10000000 && r.amount <= 25000000 : r.amount > 25000000)) && (!submission || (submission === 'today' ? r.submittedAt.slice(0,10) === '2026-08-18' : submission === 'week' ? now - Date.parse(r.submittedAt) < 7 * 86400000 : true)));
  const p = Math.max(1, Number(page)), s = Math.max(1, Math.min(20, Number(pageSize)));
  res.json({ data: list.slice((p - 1) * s, p * s), total: list.length, page: p, pageSize: s });
});
app.get('/api/requests/:id', (req, res) => { const r = requests.find(x => x.id === req.params.id); if (!r) return res.status(404).json({ message: 'Request not found' }); res.json(r); });
app.get('/api/summary', (_req, res) => {
  const requested = requests.reduce((s, r) => s + r.amount, 0);
  const pending = requests.filter(r => !['Approved', 'Rejected'].includes(r.status));
  const stagesCount = Object.fromEntries(stages.map(stage => [stage, requests.filter(r => r.stage === stage && !['Approved','Rejected'].includes(r.status)).length]));
  res.json({ totalRequested: requested, approved: requests.filter(r => r.status === 'Approved').reduce((s, r) => s + r.amount, 0), pendingAmount: pending.reduce((s, r) => s + r.amount, 0), rejected: requests.filter(r => r.status === 'Rejected').reduce((s, r) => s + r.amount, 0), total: requests.length, pending: pending.length, urgent: pending.filter(r => r.priority === 'Urgent').length, waitingManager: pending.filter(r => r.status === 'Waiting for Manager').length, waitingFinance: pending.filter(r => r.stage === 'Finance Review').length, stages: stagesCount, completed: requests.filter(r => r.status === 'Approved').length, sla: pending.filter(r => r.waitingHours >= 24).length, directorAmount: pending.filter(r => r.stage === 'Director Approval').reduce((s,r)=>s+r.amount,0), financeReviewAmount: pending.filter(r => r.stage === 'Finance Review').reduce((s,r)=>s+r.amount,0), missingDocs: pending.filter(r => r.status === 'Needs Documents').length, managerSla: pending.filter(r => r.status === 'Waiting for Manager' && r.waitingHours >= 72).length });
});
app.patch('/api/requests/:id', (req, res) => {
  const r = requests.find(x => x.id === req.params.id); if (!r) return res.status(404).json({ message: 'Request not found' });
  if (req.body.action === 'reject' && !String(req.body.reason || '').trim()) return res.status(400).json({ message: 'A rejection reason is required.' });
  if (!['approve', 'reject', 'assign'].includes(req.body.action)) return res.status(400).json({ message: 'Unknown action.' });
  if (req.body.action === 'assign' && !String(req.body.reviewer || '').trim()) return res.status(400).json({ message: 'A reviewer is required.' });
  if (['approve', 'reject'].includes(req.body.action) && ['Approved', 'Rejected'].includes(r.status)) return res.status(409).json({ message: 'Only pending requests can be approved or rejected.' });
  if (req.body.action === 'approve') r.status = 'Approved';
  if (req.body.action === 'reject') { r.status = 'Rejected'; r.reason = req.body.reason; }
  if (req.body.action === 'assign') r.reviewer = req.body.reviewer;
  res.json(r);
});
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) app.listen(4174, () => console.log('Finflow mock API listening on http://localhost:4174'));
export { app };
