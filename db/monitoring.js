import { connectToDB } from './index.js';
import { exec } from 'child_process';

export async function monitorUploadProgress (socket, size) {
  const client = await connectToDB("Connected to DB for progress monitoring");

  let currentPid;
  const refreshIntervalId = setInterval(async () => {
    try {
      if (currentPid === undefined) {
        const { rows } = await client.query('SELECT * FROM pg_stat_progress_copy');
        if (rows !== undefined && rows.length > 0) {
          currentPid = rows[rows.length - 1].pid;
        }
      } else {
        const { rows } = await client.query(`SELECT * FROM pg_stat_progress_copy WHERE pid = ${currentPid}`);
        if (rows !== undefined && rows.length > 0) {
          const { bytes_processed } = rows[0];
          var progress = Math.floor((bytes_processed / size * 100) * 100) / 100;
          socket.send(progress.toString());
        } else {
          clearInterval(refreshIntervalId);
        }
      }
    } catch (error) {
      console.error('Error querying progress:', error);
      clearInterval(refreshIntervalId);
    }
  }, 250);

  return refreshIntervalId;
};