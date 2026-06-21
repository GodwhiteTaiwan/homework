import cors from 'cors';
import express from 'express';
import { debtsRouter } from './routes/debts.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const defaultAllowedOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://godwhitetaiwan.github.io'
]);

const allowedOrigins = new Set(
  [...defaultAllowedOrigins, ...(process.env.CORS_ORIGINS?.split(',') ?? [])]
    .map((origin) => origin.trim())
    .filter(Boolean)
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    }
  })
);
app.use(express.json());

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

app.use('/api/debts', debtsRouter);

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
