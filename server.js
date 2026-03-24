import express from 'express';
const app = express();
const PORT = 5000;

app.get('/api/data', (req, res) => {
  res.json({ message: 'Hello from the API!' });
});

app.listen(PORT, () => {
  console.log(`API Server listening on http://localhost:${PORT}`);
});
