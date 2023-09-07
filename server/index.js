require('dotenv').config();
const express = require('express');
const client = require('../db/index.js');
const cors = require('cors');
const { newFileUpload } = require('./controllers.js');
const app = express();

const { PORT } = process.env;
const CORS_OPTIONS = {
  origin: "http://localhost:3000"
};

app.use(express.static('client/dist'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors(CORS_OPTIONS));

app.post('/api/genome', newFileUpload);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});