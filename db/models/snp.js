import fs from 'fs';
import { from } from 'pg-copy-streams';
import { pipeline } from 'node:stream/promises';

export async function copySnpFile (client, filePath, genome_id) {
  try {
    await client.query(`ALTER TABLE snps ALTER COLUMN genome SET DEFAULT ${genome_id}`);
    const query = `COPY snps (rsid, chromosome, position, genotype) FROM STDIN WITH (DELIMITER E'\t', NULL '--')`;
    const ingestStream = client.query(from(query));
    const sourceStream = fs.createReadStream(filePath);
    console.log('Starting data import');
    pipeline(sourceStream, ingestStream);
    await client.query('ALTER TABLE snps ALTER COLUMN genome DROP DEFAULT');
    console.log('Data import complete');
  } catch (err) {
    throw err;
  }
};