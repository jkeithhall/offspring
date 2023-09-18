import { client } from '../index.js';
import fs from 'fs';
import { from } from 'pg-copy-streams';
import { pipeline } from 'node:stream/promises';
import sockets from '../../server/index.js';
import pg from 'pg';
const { Client } = pg;
import { clientConfig } from '../index.js';

export async function snpFileUpload (filePath, name, cb) {
  const client = new Client(clientConfig);
  await client.connect((err) => {
    if (err) {
      throw err;
      console.log(err);
    } else {
      console.log('DB connected for file upload');
    }
  });
  try {
    await client.query('BEGIN');
    var { rows } = await client.query(`INSERT INTO users(name, sex) VALUES ('${name}', 'M') RETURNING id`);
    const user_id = rows[0].id;
    var { rows } = await client.query(`INSERT INTO genomes(user_id) VALUES (${user_id}) RETURNING id`);
    const genome_id = rows[0].id;
    console.log(`Added ${name} to database with user_id ${user_id} and genome_id ${genome_id}`);
    await client.query(`ALTER TABLE snps ALTER COLUMN genome SET DEFAULT ${genome_id}`);
    const query = `COPY snps (rsid, chromosome, position, genotype) FROM STDIN WITH (DELIMITER E'\t', NULL '--')`;
    const ingestStream = client.query(from(query));
    const sourceStream = fs.createReadStream(filePath);
    console.log('Starting data import');
    pipeline(sourceStream, ingestStream);
    await client.query('ALTER TABLE snps ALTER COLUMN genome DROP DEFAULT');
    await client.query('COMMIT');
    console.log('Data imported successfully');
    client.end();
    cb(200, 'File uploaded to database!');
  } catch (err) {
    cb(500, `Error: ${err.message}`);
    client.query('ROLLBACK');
  }
};