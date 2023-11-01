import { client, connectToDB } from '../db/index.js';
import User from '../db/models/users.js';
import Genome from '../db/models/genomes.js';
import Snp from '../db/models/snps.js';
import { IncomingForm } from 'formidable';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { monitorUploadProgress } from '../db/models/monitoring.js';
import { preprocessFile, deleteFiles, determineSex } from './lib.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function newFileUpload (socket, req, res) {
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
      return;
    }

    const [ file ] = files['files[]'];
    const { mimetype, filepath, originalFilename, size } = file;
    if (mimetype !== "text/plain") {
      console.log(`Unsupported media type (${mimetype}).`);
      res.status(415).send(`Unsupported media type (${mimetype}). Only .txt files allowed.`);
    }

    const refreshIntervalId = monitorUploadProgress(socket, size);

    preprocessFile(filepath, async () => {
      try {
        const sex = await determineSex(filepath);

        await client.query('BEGIN');
        const rows = await Genome.create({ user_id, name, sex });
        await Snp.copySnpFile(filepath, rows[0].id);
        clearInterval(refreshIntervalId);
        client.query('COMMIT');

        res.status(200).send(`File ${originalFilename} uploaded successfully.`);
      } catch (error) {
        clearInterval(refreshIntervalId);
        client.query('ROLLBACK');
        console.error('Error uploading file: ', error);
        res.status(500).send(`Error uploading file: ${error.message}`);
      } finally {
        socket.close();
        deleteFiles(filepath, () => {});
      }
    });
  });
};