import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
const { PORT } = process.env;
const app = express();
import PgsScoreModel from './analysisDB.js';
import Analysis from './analyses/analysis.js';
import bodyParser from 'body-parser';
import authenticateAPIKey from './middleware/apiKey.js';
import axios from 'axios';
import parsePgsCatalogData from './utils/parsePgsCatalogData.js';

app.use(bodyParser.json());
app.use(authenticateAPIKey);

app.get('/api/analysis', async (req, res) => {
  try {
    const { pgs_id, genome_id_1, genome_id_2 } = req.query;
    console.log(`Received request for PGS score ${pgs_id} with genome IDs ${genome_id_1} and ${genome_id_2}`);
    const analysis = new Analysis(pgs_id, genome_id_1, genome_id_2);
    const data = await analysis.initializeAndRun();
    res.status(200).send(data);
  } catch (err) {
    console.error(err);
    res.status(500).send(`ERROR: ${err.message}`);
  }
});

app.post('/api/analysis', async (req, res) => {
  try {
    const { pgs_id, prevalence } = req.query;
    console.log(`Received request to create analysis for PGS ID ${pgs_id} with prevalence ${prevalence}`);
    const { data } = await axios.get(`https://www.pgscatalog.org/rest/score/${pgs_id}`);
    const parsedData = await parsePgsCatalogData(data, prevalence);
    await PgsScoreModel.create(parsedData);
    res.status(200).send('Analysis created successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send(`ERROR: ${err.message}`);
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});