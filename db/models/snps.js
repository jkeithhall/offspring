import fs from 'fs';
import { from } from 'pg-copy-streams';
import { pipeline } from 'node:stream/promises';
import { client } from '../index.js';
import Model from './models.js';
import { Worker, parentPort, isMainThread, workerData } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

const executeCopySnpFileWorker = async function (filePath) {
  try {
    const sourceStream = fs.createReadStream(filePath);
    const query = `COPY snps (rsid, genome_id, chromosome, position, genotype) FROM STDIN WITH (DELIMITER E'\t', NULL '--')`;
    const ingestStream = client.query(from(query));
    await pipeline(sourceStream, ingestStream);
  } catch (err) {
    parentPort.postMessage({ message: err.message });
  }
}

if (!isMainThread) {
  const { filePath } = workerData;
  await executeCopySnpFileWorker(filePath);
  parentPort.postMessage({ message: `File ${filePath} uploaded successfully.` });
}

class SnpModel extends Model {
  constructor() {
    super('snps');
  }

  copySnpFile (filePath) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, { workerData: { filePath } });
      worker.on('message', (message) => {
        if (message.message === `File ${filePath} uploaded successfully.`) {
          resolve();
        } else {
          console.log(message.message);
        }
      });
      worker.on('error', (err) => {
        console.error(err);
        reject(err);
        res.status(500).send(`Error uploading file: ${err.message}`);
      });
      worker.on('exit', (code) => {
        console.log(`Worker stopped with exit code ${code}`);
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
        resolve();
      });
    });
  }
};

const Snp = new SnpModel();
export default Snp;