import cors from 'cors';
import express from 'express';
import { debtsRouter } from './routes/debts.js';

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

app.use('/api/debts', debtsRouter);

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
