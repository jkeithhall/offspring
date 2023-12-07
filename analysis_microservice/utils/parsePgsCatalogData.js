import { createGunzip } from 'zlib';
import axios from 'axios';
import { createInterface } from 'readline';
import { createReadStream, createWriteStream, unlink } from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const determineIntercept = function(pgsScores, populationPrevalence) {
  const populationLogOdds = Math.log(populationPrevalence / (1 - populationPrevalence));
  const pgsLogOdds = Array.from(pgsScores.values()).reduce((prevLogOdds, { effect_weight, allelefrequency_effect }) => {
    // Unsure about this part of the calculation...
    return prevLogOdds + 2 * effect_weight * allelefrequency_effect;
  }, 0);
  return populationLogOdds - pgsLogOdds;
}

export default function parsePgsCatalogData(data, populationPrevalence) {
  const { id, name, ftp_scoring_file, publication, trait_efo, variants_number } = data;
  var pgsScores = new Map();
  let rsidIdx, effectAlleleIdx, effectWeightIdx, alleleFreqIdx;
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
      if (!line.startsWith('#')) {
        const columns = line.split('\t');
        if (line.startsWith('rsID')) {
          rsidIdx = columns.indexOf('rsID');
          effectAlleleIdx = columns.indexOf('effect_allele');
          effectWeightIdx = columns.indexOf('effect_weight');
          alleleFreqIdx = columns.indexOf('allelefrequency_effect');
        } else {
          const rsid = columns[rsidIdx];
          const effect_allele = columns[effectAlleleIdx];
          const effect_weight = columns[effectWeightIdx];
          const allelefrequency_effect = columns[alleleFreqIdx];
          pgsScores.set(rsid, { effect_allele, effect_weight, allelefrequency_effect });
        }
      }
    });

    return new Promise((resolve, reject) => {
      rl.on('close', () => {
        // Sort pgsScores by descending effect_weight
        pgsScores = new Map([...pgsScores.entries()].sort((a, b) => Math.abs(b[1].effect_weight) - Math.abs(a[1].effect_weight)));

        // Determine intercept
        const intercept = determineIntercept(pgsScores, populationPrevalence);
        console.log('Intercept:', intercept);
        console.log('Finished parsing PGS Catalog data');
        resolve({ id, name, pgsScores, publication, trait_efo, variants_number, intercept });
      });
      rl.on('error', error => {
        console.log(`Error reading lines of file: ${error.message}`);
        reject(error);
      });
    });
  }).catch(error => {
    console.log(`Error parsing PGS Catalog data: ${error.message}`);
    throw error;
  }).finally(() => {
    unlink(filename, () => {});
  });
};