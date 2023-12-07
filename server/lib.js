import { unlink, createReadStream, createWriteStream, stat } from 'fs';
import crypto from 'crypto-js/sha256.js';
import { createInterface } from 'readline';
import Session from '../db/models/sessions.js';
import Genome from '../db/models/genomes.js';

// This function preprocesses the file by removing commented lines, adding the genome_id to each line,
// determining the sex of the genome, and returning the genome_id and sex.
export function preprocessFile (filepath, genome_id) {
  return new Promise((resolve, reject) => {

    let sex;
    let chip = 'v4'; // Default to v4

    const input = createReadStream(filepath);
    const output = createWriteStream(`${filepath}.preprocessed`);
    const rl = createInterface({
      input,
      output,
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      if (!line.startsWith('#')) {
        const columns = line.split('\t');
        const [ rsid, chromosome ] = columns;
        if (sex === undefined && chromosome === 'Y') {
          sex = 'M';
        }
        if (rsid = 'rs10440635') {
          chip = 'v5';
        }
        columns.splice(1, 0, genome_id);
        const modifiedLine = columns.join('\t') + '\n';
        output.write(modifiedLine);
      }
    });

    rl.on('close', async () => {
      // Update genome with sex
      if (sex === undefined) { sex = 'F'; }
      await Genome.update({ id: genome_id }, { sex });

      // Get new file size
      const size = await getFileSize(`${filepath}.preprocessed`);
      resolve({ sex, size, chip });
    });

    rl.on('error', error => {
      console.log(`Error preprocessing file: ${error.message}`);
      reject(error);
    });
  });
};

export function deleteFiles (filepath, cb) {
  unlink(filepath, () => {
    unlink(`${filepath}.preprocessed`, () => {
      unlink(`${filepath}.original`, cb);
    });
  });
};

export function getFileSize (filepath) {
  return new Promise((resolve, reject) => {
    stat(filepath, (err, stats) => {
      if (err) {
        console.log(`Error getting file size: ${err.message}`);
        reject(err);
      }
      resolve(stats.size);
    });
  });
}

export async function getSocketKey (req, res, next) {
  const { name } = req.query;
  const { offspring_id } = req.cookies;
  req.socketKey = await crypto(offspring_id + name).toString();
  next();
};

export async function createSession (req, res, next) {
  try {
    const { offspring_id } = req.cookies;
    if (!offspring_id) {
      throw offspring_id;
    }
    const [ session ] = await Session.get({ hash: offspring_id });
    if (!session) {
      throw session;
    }
    req.session = session;
    next();
  } catch (err) {
    const [ session ] = await Session.create();
    const options = {
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      httpOnly: true
    };
    res.cookie('offspring_id', session.hash, options);
    req.session = session;
    next();
  }
};