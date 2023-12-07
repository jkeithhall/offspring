import dotenv from 'dotenv';
import express from 'express';
import expressWS from 'express-ws';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { uploadFile, getUploadedGenomes, getAnalysis, getAllAnalyses, createSocket } from './controllers.js';
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

app.ws('/api/genome/', createSocket);

app.post('/api/genome', uploadFile);

app.get('/api/genomes', getUploadedGenomes);

app.get('api/analyses/:pgs_id', getAnalysis);

app.get('api/analyses', getAllAnalyses);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});