import pg from 'pg';
const { Client } = pg;
import dotenv from 'dotenv';
dotenv.config();

const clientConfig = {
    type: "postgres",
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: `${process.env.DB_PASSWORD}`,
    database: process.env.DB_DATABASE_NAME,
  }

const connectToDB = function(connectMessage) {
  const client = new Client(clientConfig);
  client.connect((err) => {
    if (err) {
      console.log('Error connecting to DB: ', err);
      throw err;
    } else {
      console.log(connectMessage);
    }
  });
  return client;
}

const client = connectToDB("Connected to DB");

export { connectToDB, client }