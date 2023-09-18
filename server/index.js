import dotenv from 'dotenv';
dotenv.config();
const { PORT } = process.env;

import express from 'express';
import expressWS from 'express-ws';
import cors from 'cors';
import { newFileUpload } from './controllers.js';
import { getSocketKey } from './lib.js';

const app = express();
expressWS(app);

export const sockets = {};

const CORS_OPTIONS = {
  origin: `http://localhost:${PORT}`
};

app.use(express.static('client/dist'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors(CORS_OPTIONS));

app.ws('/api/genome/', (socket, req) => {
  try {
    const key = getSocketKey(req);
    sockets[key] = socket;
    console.log(`Socket ${key} connected`);

    socket.on('close', () => {
      delete sockets[key];
    });
  } catch (err) {
    console.error(err);
  }
});

app.post('/api/genome', (req, res) => {
  try {
    const key = getSocketKey(req);
    newFileUpload(sockets[key], req, res);
  } catch (err) {
    console.error(err);
    res.status(500).send(`ERROR: ${err.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});