import { exec } from 'child_process';
import { unlink } from 'fs';
import crypto from 'crypto-js/sha256.js';

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
  console.log('filepath', filepath);
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
