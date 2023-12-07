import dotenv from 'dotenv';
import { client, connectToDB } from '../db/index.js';
import { IncomingForm } from 'formidable';
import Genome from '../db/models/genomes.js';
import Snp from '../db/models/snps.js';
import { monitorUploadProgress } from '../db/monitoring.js';
import { preprocessFile, deleteFiles } from './lib.js';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import PgsScoreModel from '../db/analysisDB.js';
import { sockets } from './index.js';

dotenv.config();

const { ANALYSIS_API_KEY, ANALYSIS_URL } = process.env;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function uploadFile (req, res) {
  const { socketKey, session } = req;
  const socket = sockets[socketKey];
  const { user_id } = session;
  const { name } = req.query;

  const form = new IncomingForm({
    uploadDir: path.join(__dirname, 'temp'),
    keepExtensions: true,
    maxFiles: 1,
    maxFileSize: 50 * 1024 * 1024, // 50MB
    multiples: false,
  });
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.log(`Error parsing files: ${err.message}`);
      res.status(400).send("There was an error parsing the files");
    }
    // Determine if file is valid
    const [ file ] = files['files[]'];
    const { mimetype, filepath, originalFilename } = file;
    if (mimetype !== "text/plain") {
      console.log(`Unsupported media type (${mimetype}).`);
      res.status(415).send(`Unsupported media type (${mimetype}). Only .txt files allowed.`);
    }

    let refreshIntervalId;
    try {
      // Create new genome in database
      const [ genome ] = await Genome.create({ user_id, name });
      const genome_id = genome.id;

      // Preprocess file (remove comments; add genome_id; determine sex, file size, and chip version)
      const { size } = await preprocessFile(filepath, genome_id);

      // Upload preprocessed file and monitor upload progress
      refreshIntervalId = await monitorUploadProgress(socket, size);
      await Snp.copySnpFile(`${filepath}.preprocessed`);
      clearInterval(refreshIntervalId);

      res.status(200).send(`File ${originalFilename} uploaded successfully.`);
    } catch (err) {
      if (refreshIntervalId !== undefined) {
        clearInterval(refreshIntervalId);
      }
      console.error('Error uploading file: ', err.message);
      res.status(500).send(`Error uploading file: ${err.message}`);
    } finally {
      socket.close();
      deleteFiles(filepath, () => {});
    }
  });
};

export async function getUploadedGenomes (req, res) {
  try {
    const { session } = req;
    const { user_id } = session;
    const genomes = await Genome.getAll({ user_id });
    const availableGenomes = [];
    for (const genome of genomes) {
      const { name, sex, chip } = genome;
      availableGenomes.push({ name, sex, chip });
    }
    res.status(200).send({ availableGenomes });
  } catch (err) {
    console.error(err);
    res.status(500).send(`ERROR: ${err.message}`);
  }
}

export async function getAnalysis (req, res) {
  try {
    const { pgs_id } = req.params;
    const { name_1, name_2 } = req.query;
    const user_id = req.session.user_id;
    const [ genome_1 ] = await Genome.get({ user_id, name: name_1 });
    const [ genome_2 ] = await Genome.get({ user_id, name: name_2 });
    const { data } = await axios.get(`${ANALYSIS_URL}/api/analysis?pgs_id=${pgs_id}&genome_id_1=${genome_1.id}&genome_id_2=${genome_2.id}`, {
      headers: {
        Authorization: `Bearer ${ANALYSIS_API_KEY}`
      }
    });
    res.status(200).send(data);
  } catch (err) {
    console.error(err);
    res.status(500).send(`ERROR: ${err.message}`);
  }
}

export async function getAllAnalyses (req, res) {
  try {
    const docs = await PgsScoreModel.find({}, 'id name');
    const analyses = docs.map(doc => ({ pgs_id: doc.id, name: doc.name }));
    res.status(200).send(analyses);
  } catch (err) {
    console.error(err);
    res.status(500).send(`ERROR: ${err.message}`);
  }
}

export async function createSocket(socket, req) {
  try {
    const { socketKey } = req;
    sockets[socketKey] = socket;

    socket.on('close', () => {
      delete sockets[socketKey];
    });
  } catch (err) {
    console.error(err);
  }
}