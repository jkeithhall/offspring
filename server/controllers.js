import { client, connectToDB } from '../db/index.js';
import { IncomingForm } from 'formidable';
import Genome from '../db/models/genomes.js';
import Snp from '../db/models/snps.js';
import { monitorUploadProgress } from '../db/monitoring.js';
import { preprocessFile, deleteFiles } from './lib.js';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function uploadFile (socket, req, res) {
  const { session } = req;
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

      // Preprocess file (remove comments, add genome_id, determine sex and file size)
      const { sex, size } = await preprocessFile(filepath, genome_id);

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