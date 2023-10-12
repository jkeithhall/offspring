import fs from 'fs';
import { from } from 'pg-copy-streams';
import { pipeline } from 'node:stream/promises';

export async function getSnpAtRsid (client, rsid, genome_id) {
  try {
    var { rows } = await client.query(`SELECT genotype FROM snps WHERE genome = ${genome_id} AND rsid = '${rsid}'`);
    const genotype = rows[0].genotype;
    return genotype;
  } catch (err) {
    console.log(`ERROR thrown for ${rsid} on ${genome_id}: err`);
    return null;
  }
};

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