import { createClient } from 'redis';
import { promisify } from 'util';

const redisClient = createClient();

redisClient.on('connect', () => {
  console.log('Connected to Redis DB');
});

redisClient.on('error', err => {
  console.log(`Error connecting to Redis: ${err.message}`);
  throw err;
});

await redisClient.connect();

export default redisClient;