import { createGunzip } from 'zlib';
import axios from 'axios';
import { createInterface } from 'readline';
import { createReadStream, createWriteStream, unlink } from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default function parsePgsCatalogData(data) {
  const { id, name, ftp_scoring_file, publication, trait_efo, variants_number} = data;
  const pgsScores = new Map();
  let analysis;
  const filename = path.join(__dirname, '../temp', `${id}.txt.gz`);
  return axios.get(ftp_scoring_file, { responseType: 'stream' })
    .then(({ data }) => {
    const writeStream = createWriteStream(filename);
    console.log(`Receiving ftp_scoring_file and unzipping to ${filename}`);
    data.pipe(createGunzip()).pipe(writeStream);

    return new Promise((resolve, reject) => {
      writeStream.on('error', error => {
        console.log(`Error unzipping and writing file: ${error.message}`);
        reject(error);
      });
      writeStream.on('finish', () => {
        console.log('Finished unzipping ftp_scoring_file');
        resolve();
      })
    });
  }).then(() => {
    const input = createReadStream(filename);
    const rl = createInterface({
      input,
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      if (!(line.startsWith('#') || line.startsWith('rsID'))) {
        const columns = line.split('\t');
        const [ rsid, effect_allele, effect_weight ] = columns;
        pgsScores.set(rsid, { effect_allele, effect_weight });
      }
    });

    return new Promise((resolve, reject) => {
      rl.on('close', () => {
        analysis = { id, name, pgsScores, publication, trait_efo, variants_number };
        console.log('Finished parsing PGS Catalog data');
        resolve(analysis);
      });
      rl.on('error', error => {
        console.log(`Error reading lines of file: ${error.message}`);
        reject(error);
      });
    });
  }).catch(error => {
    console.log(`Error parsing PGS Catalog data: ${error.message}`);
    res.status(500).send(`Error parsing PGS Catalog data: ${error.message}`);
  }).finally(() => {
    unlink(filename, () => {});
  });
};