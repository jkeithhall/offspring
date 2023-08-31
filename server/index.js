require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();

const { PORT } = process.env;
app.use(express.static('client/dist'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.listen(PORT, () => {
  console.log(`Example app listening on port: ${PORT}`);
});
