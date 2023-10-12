import { exec } from 'child_process';
import { unlink, createReadStream } from 'fs';
import crypto from 'crypto-js/sha256.js';
import { createInterface } from 'readline';

export function preprocessFile (filepath, cb) {
  exec(`sed -i'.original' -e '1,20d' ${filepath}`,  (error, stdout, stderr) => {
    if (error) {
      res.status(500).send(`Error: ${error.message}`);
      console.error(`Error: ${error.message}`);
      return;
    }
    if (stderr) {
      res.status(500).send(`Error: ${stderr}`);
      console.error(`Error: ${stderr}`);
      return;
    }
    console.log("File preprocessed");
    cb();
  });
};

export function  deleteFiles (filepath, cb) {
  unlink(filepath, () => {
    unlink(`${filepath}.original`, () => {
      console.log("Files deleted");
      cb();
    });
  });
};

export async function getSocketKey (req, res, next) {
  const { name } = req.query;
  const { origin } = req.headers;
  return await crypto(origin + name).toString();
};

export async function determineSex (filepath) {
  let xCount = 0;
  let yCount = 0;

  try {
    const fileStream = createReadStream(filepath);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      const [rsid, chromosome, position, genotype] = line.split('\t');

      if (chromosome === 'X') {
        xCount++;
      } else if (chromosome === 'Y') {
        yCount++;
      }
    }

    await fileStream.close();

    // Does not account for XXY, XYY, etc.
    if (yCount == 0) {
      console.log('Biological Sex: Female');
      return 'F';
    } else {
      console.log('Biological Sex: Male');
      return 'M';
    }
  } catch (error) {
    throw error;
  }
};
