import dotenv from 'dotenv';
import express from 'express';
import expressWS from 'express-ws';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { uploadFile } from './controllers.js';
import { getSocketKey, createSession } from './lib.js';

dotenv.config();
const { PORT, ANALYSIS_API_KEY, ANALYSIS_URL } = process.env;

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
    uploadFile(sockets[socketKey], req, res);
  } catch (err) {
    console.error(err);
    res.status(500).send(`ERROR: ${err.message}`);
  }
});

app.get('api/analysis', (req, res) => {
  const { pgs_id } = req.query;
  axios.get(`${ANALYSIS_URL}/api/analysis?pgs_id=${pgs_id}`, {
    headers: {
      Authorization: `Bearer ${ANALYSIS_API_KEY}`
    }
  })
    .then((response) => {
      const { histogram } = response.data;
      res.status(200).send({ histogram });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send(`ERROR: ${err.message}`);
    });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});