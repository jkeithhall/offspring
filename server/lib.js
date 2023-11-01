import { exec } from 'child_process';
import { unlink, createReadStream } from 'fs';
import crypto from 'crypto-js/sha256.js';
import { createInterface } from 'readline';
import Session from '../db/models/sessions.js'

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
    cb();
  });
};

export function  deleteFiles (filepath, cb) {
  unlink(filepath, () => {
    unlink(`${filepath}.original`, () => {
      cb();
    });
  });
};

export async function getSocketKey (req, res, next) {
  const { name } = req.query;
  const { offspring_id } = req.cookies;
  req.socketKey = await crypto(offspring_id + name).toString();
  next();
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

    var sex = 'F';
    for await (const line of rl) {
      const [ rsid, chromosome ] = line.split('\t');

      if (chromosome === 'Y') {
        sex = 'M';
        break;
      }
    }
    await fileStream.close();
    return sex;

  } catch (error) {
    throw error;
  }
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