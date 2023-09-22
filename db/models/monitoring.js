import { connectToDB } from '../index.js';
import { exec } from 'child_process';

export async function monitorUploadProgress (socket, size) {
  const client = await connectToDB("Connected to DB for progress monitoring");
  const refreshIntervalId = setInterval(async () => {
    try {
      const { rows } = await client.query('SELECT * FROM pg_stat_progress_copy');
      if (rows !== undefined && rows.length > 0) {
        var { bytes_processed } = rows[0];
        var progress = Math.floor((bytes_processed / size * 100) * 100) / 100;
        socket.send(progress.toString());
      }
    } catch (error) {
      console.error('Error querying progress:', error);
      clearInterval(refreshIntervalId);
    }
  }, 250);
  return refreshIntervalId;
};