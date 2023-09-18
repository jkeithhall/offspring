import pk from 'pg';
const { Client } = pk;
import { clientConfig } from '../index.js';

export async function monitorUploadProgress (socket, size) {
  const client = new Client(clientConfig);
  await client.connect((err) => {
    if (err) {
      throw err;
    } else {
      console.log('DB connected for querying progress');
    }
  });
  const refreshIntervalId = setInterval(async () => {
    try {
      const { rows } = await client.query('SELECT * FROM pg_stat_progress_copy');
      var { bytes_processed } = rows[0];
      var progress = Math.floor((bytes_processed / size * 100) * 100) / 100;
      socket.send(progress.toString());
    } catch (error) {
      console.error('Error querying progress:', error);
      clearInterval(refreshIntervalId);
    }
  }, 250);
  return refreshIntervalId;
};