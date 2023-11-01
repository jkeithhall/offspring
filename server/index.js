import dotenv from 'dotenv';
dotenv.config();
const { PORT } = process.env;

import express from 'express';
import expressWS from 'express-ws';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { newFileUpload } from './controllers.js';
import { getSocketKey, createSession } from './lib.js';

export const app = express();
expressWS(app);

export const sockets = {};

const CORS_OPTIONS = {
  origin: `http://localhost:${PORT}`
};

app.use(cors(CORS_OPTIONS));
app.use(cookieParser())
app.use(createSession);
app.use(getSocketKey);
app.use(express.static('client/dist'));

app.ws('/api/genome/', async (socket, req) => {
  try {
    const { socketKey } = req;
    sockets[socketKey] = socket;

    socket.on('close', () => {
      delete sockets[socketKey];
    });
  } catch (err) {
    console.error(err);
  }
});

app.post('/api/genome', async (req, res) => {
  try {
    const { socketKey } = req;
    newFileUpload(sockets[socketKey], req, res);
  } catch (err) {
    console.error(err);
    res.status(500).send(`ERROR: ${err.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});