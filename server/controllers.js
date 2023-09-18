import { IncomingForm } from 'formidable';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { snpFileUpload } from '../db/models/snp.js';
import { monitorUploadProgress } from '../db/models/monitoring.js';
import { preprocessFile, deleteFiles } from './lib.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function newFileUpload (socket, req, res) {
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
    const file = files['files[]'][0];
    const { mimetype, filepath, originalFilename, size } = file;
    console.log(`Receiving file ${originalFilename}...`);
    if (mimetype !== "text/plain") {
      console.log(`Unsupported media type (${mimetype}).`);
      res.status(415).send(`Unsupported media type (${mimetype}). Only .txt files allowed.`);
    }
    preprocessFile(filepath, () => {
      const refreshIntervalId = monitorUploadProgress(socket, size);

      snpFileUpload(filepath, name, (status, message) => {
        console.log(message);
        clearInterval(refreshIntervalId);
        deleteFiles(filepath, () => {
          res.status(status).send(message);
        });
      });
    });
  });
};