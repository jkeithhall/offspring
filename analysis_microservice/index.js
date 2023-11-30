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

app.get('/api/analysis', (req, res) => {
  const { name, genome_id_1, genome_id_2 } = req.query;
  console.log(`Received request for ${name} with genome IDs ${genome_id_1} and ${genome_id_2}`);
  const analysis = new Analysis(name, genome_id_1, genome_id_2);
  analysis.fetchPgsScores()
    .then(() => analysis.determineSnpWeights())
    .then(() => analysis.determineChildProbabilities())
    .then((histogram) => res.status(200).send({ histogram }))
    .catch((err) => {
      console.error(err);
      res.status(500).send(`ERROR: ${err.message}`);
    });
});

app.post('/api/analysis', (req, res) => {
  const { pgs_id } = req.query;
  console.log(`Received request to create analysis for PGS ID ${pgs_id}`);
  axios.get(`https://www.pgscatalog.org/rest/score/${pgs_id}`)
    .then((response) => {
      const { data } = response;
      console.log('data:', data);
      return parsePgsCatalogData(data);
    })
    .then((parsedData) => {
      console.log('Sending data to database');
      console.log('parsedData:', parsedData);
      PgsScoreModel.create(parsedData);
    })
    .then(() => {
      console.log('Finished sending data to database');
      res.status(200).send('Analysis created successfully');
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send(`ERROR: ${err.message}`);
    });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});