const { client } = require('../index.js');
const fs = require('fs');
const { from } = require('pg-copy-streams');
const { pipeline } = require('node:stream/promises');

module.exports = {
  snpFileUpload: async (filePath, userName, cb) => {
    await client.connect((err) => {
      if (err) {
        throw err;
      } else {
        console.log('DB connected');
      }
    });
    try {
      await client.query('BEGIN');
      var { rows } = await client.query(`INSERT INTO users(name, sex) VALUES ('${userName}', 'M') RETURNING id`);
      const user_id = rows[0].id;
      var { rows } = await client.query(`INSERT INTO genomes(user_id) VALUES (${user_id}) RETURNING id`);
      const genome_id = rows[0].id;
      console.log(`Added ${userName} to database with user_id ${user_id} and genome_id ${genome_id}`);
      console.log(filePath);
      await client.query(`ALTER TABLE snps ALTER COLUMN genome SET DEFAULT ${genome_id}`);
      const query = `COPY snps (rsid, chromosome, position, genotype) FROM STDIN WITH (DELIMITER E'\t', NULL '--')`;
      const ingestStream = client.query(from(query));
      const sourceStream = fs.createReadStream(filePath);
      console.log('Starting data import');
      await pipeline(sourceStream, ingestStream);
      await client.query('ALTER TABLE snps ALTER COLUMN genome DROP DEFAULT');
      await client.query('COMMIT');
      console.log('Data imported successfully');
      cb(200, 'File uploaded to database!');
      // await client.query(`COPY snps FROM '${filePath}' WITH (DELIMITER E'\t', NULL '--')`);
    } catch (err) {
      cb(500, `Error: ${err.message}`);
      client.query('ROLLBACK');
    } finally {
      client.end();
    }
  }
}