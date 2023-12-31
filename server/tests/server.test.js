import express from 'express';
import chai from 'chai';
import chaiHttp from 'chai-http';
import supertest from 'supertest';
import WebSocket from 'ws';
import { app, sockets } from '../index.js';
import { getSocketKey, preprocessFile, deleteFiles, createSession } from '../lib.js';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash, compareHash, createRandom32String } from '../../db/hashutils.js';
import { client } from '../../db/index.js';
import Model from '../../db/models/models.js';
import User from '../../db/models/users.js';
import Genome from '../../db/models/genomes.js';
import Session from '../../db/models/sessions.js';
import Snp from '../../db/models/snps.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const filePath = path.join(__dirname, 'testFile.txt');

const expect = chai.expect;

chai.use(chaiHttp);

before(async () => {
  // Create test database
  await client.query('CREATE TABLE test (id SERIAL PRIMARY KEY, name VARCHAR(255));');
});

// Hash util tests
describe('Hash utils', () => {
  it('should create a random 32 character string', () => {
    const randomString = createRandom32String();
    expect(randomString).to.be.a('string');
    expect(randomString.length).to.equal(32);
  });

  it('should create a hash', async () => {
    const hash = await createHash('test');
    expect(hash).to.be.a('string');
  });

  it('should create the same hash for the same input', async () => {
    const hash1 = await createHash('test');
    const hash2 = await createHash('test');
    expect(hash2).to.equal(hash1);
  });

  it('should compare a hash to a string', async () => {
    const hash = await createHash('test');
    const result = await compareHash('test', hash);
    expect(result).to.equal(true);
  });
});

// Test Model class
describe('Model class', () => {
  let model = new Model('test');

  it('should create a new row in the table', async () => {
    const [ row ] = await model.create({ name: 'test' });
    expect(row.name).to.equal('test');
  });

  it('should retrieve a row from the table', async () => {
    const [ row ] = await model.get({ name: 'test' });
    expect(row.name).to.equal('test');
  });

  it('should retrieve all rows from the table', async () => {
    await model.create({ name: 'test2' });
    await model.create({ name: 'test3' });
    const [ row1, row2, row3 ] = await model.getAll();
    expect(row1.name).to.equal('test');
    expect(row2.name).to.equal('test2');
    expect(row3.name).to.equal('test3');
  });

  it('should update a row in the table', async () => {
    const [ row ] = await model.update({ name: 'test' }, { name: 'updated' });
    expect(row.name).to.equal('updated');
  });

  it('should delete a row from the table', async () => {
    const initialCount = (await model.getAll()).length;
    await model.delete({ name: 'updated' });
    const finalCount = (await model.getAll()).length;
    expect(finalCount).to.equal(initialCount - 1);
  });

  it('should protect against SQL injection', async () => {
    const initialCount = (await model.getAll()).length;
    const rows = await model.get({ name: 'test; DROP TABLE test;' });
    const finalCount = (await model.getAll()).length;
    expect(finalCount).to.equal(initialCount);
  });

  it('should delete all rows from the table', async () => {
    await model.deleteAll();
    const rows = await model.getAll();
    expect(rows.length).to.equal(0);
  });

  after(() => {
    // Drop test database
    client.query('DROP TABLE test');
  });
});

// Test users model
describe('Users model', () => {
  it('should create a new user', async () => {
    const [ user ] = await User.create({ username: 'test', password: 'test' });
    expect(user.username).to.equal('test');
  });

  it('should throw an error if a username is already taken', async () => {
    try {
      await User.create({ username: 'test', password: 'test' });
    } catch (err) {
      expect(err.message).to.contain('duplicate key value violates unique constraint');
    }
  });

  it('should retrieve a user', async () => {
    const [ user ] = await User.get({ username: 'test' });
    expect(user.username).to.equal('test');
  });

  it('should compare a password to a hash', async () => {
    const firstAttempt = 'wrong';
    const secondAttempt = 'test';
    const [ user ] = await User.get({ username: 'test' });
    const result1 = await User.compare(firstAttempt, user.password, user.salt);
    const result2 = await User.compare(secondAttempt, user.password, user.salt);
    expect(result1).to.equal(false);
    expect(result2).to.equal(true);
  });

  it('should delete a user', async () => {
    const initialCount = (await User.getAll()).length;
    await User.delete({ username: 'test' });
    const finalCount = (await User.getAll()).length;
    expect(finalCount).to.equal(initialCount - 1);
  });
});

describe('Genomes model', () => {
  let random_user_id;
  it('should create a new genome for a given username', async () => {
    const [ user ] = await User.create({ username: 'test', password: 'test' });
    const [ genome ] = await Genome.create({
      user_id: user.id,
      name: 'test_genome',
      sex: 'M',
    });
    expect(genome.name).to.equal('test_genome');
  });

  it('should create a new genome without a username provided', async () => {
    const [ genome ] = await Genome.create({ name: 'test_genome_2', sex: 'F' });
    random_user_id = genome.user_id;
    expect(genome.name).to.equal('test_genome_2');
  });

  it('should retrieve a genome', async () => {
    const [ genome ] = await Genome.get({ name: 'test_genome' });
    expect(genome.name).to.equal('test_genome');
  });

  it('should delete a genome', async () => {
    const initialCount = (await Genome.getAll()).length;
    await Genome.delete({ name: 'test_genome' });
    await Genome.delete({ name: 'test_genome_2' });
    await User.delete({ username: 'test' });
    await User.delete({ id: random_user_id });
    const finalCount = (await Genome.getAll()).length;
    expect(finalCount).to.equal(initialCount - 2);
  });
});

describe('Sessions model', () => {
  let user_id;
  let username;
  it('should create a new session', async () => {
    const [ user ] = await User.create({ username: 'test', password: 'test' });
    user_id = user.id;
    username = user.username;
    const [ session ] = await Session.create({ user_id });
    expect(session.user_id).to.equal(user_id);
  });

  it('should retrieve a session', async () => {
    const [ session ] = await Session.get({ user_id });
    expect(session.user_id).to.equal(user_id);
  });

  it('should delete a session', async () => {
    const initialCount = (await Session.getAll()).length;
    await Session.delete({ user_id });
    await User.delete({ username });
    const finalCount = (await Session.getAll()).length;
    expect(finalCount).to.equal(initialCount - 1);
  });
});

describe.skip('Middleware', () => {
  const testApp = express();
  const name = 'testName';
  testApp.use(createSession);
  testApp.use(getSocketKey);
  let user_id;
  let sessionCount;
  let sessionId;
  before(async () => {
    const rows = await Session.getAll();
    sessionCount = rows.length;
    console.log('sessionCount: ', sessionCount);
  });


  it('should create a session and create a cookie', (done) => {
    chai.request(testApp).post('/api/genome')
    .end((err, res) => {
      console.log('res', res);
      new Promise((resolve, reject) => {
        return Session.getAll();
      })
      .then((rows) => {
        expect(rows.length).to.equal(sessionCount + 1);
        sessionId = rows[rows.length - 1].id;
        console.log('New sessionCount: ', rows.length);
        expect(res).to.have.cookie('offspring_id');
        done();
      });
    });
  });

  xit('should not create a new session if the same cookie is sent', async () => {
    chai.request(testApp).get('/')
    .end(async (err, res) => {
      const rows = await Session.getAll();
      expect(rows.length).to.equal(sessionCount + 1);
    });
  });

  xit('should generate a valid socket key on the req object', async () => {
    supertest(testApp).post(`/api/genome?name=${name}`)
    .end((err, res) => {
      console.log('user_id 3', res.req.session.user_id);
      expect(res.req.socketKey).to.be.a('string');
      expect(res.req.socketKey.length).to.equal(64);
    });
  });

  xit('should generate the same socket keys for the same inputs', async () => {
    let socketKey1;
    let socketKey2;
    supertest(testApp).post(`/api/genome?name=${name}`)
    .end((err, res) => {
      console.log('user_id 4', res.req.session.user_id);
      socketKey1 = res.req.socketKey;
    });
    supertest(testApp).post(`/api/genome?name=${name}`)
    .end((err, res) => {
      console.log('user_id 5', res.req.session.user_id);
      socketKey2 = res.req.socketKey;
    });
    expect(socketKey1).to.equal(socketKey2);
  });

  after(async () => {
    await Session.delete({ id: sessionId });
    await User.delete({ id: user_id });
    const rows = await User.getAll();
    console.log('rows', rows);
  });
});

describe('Websocket Route', () => {
  it('should connect a socket', (done) => {
    const ws = new WebSocket('ws://localhost:3000/api/genome/');
    ws.onopen = () => {
      expect(ws.readyState).to.equal(1);
      done();
    };
  });

  after(async () => {
    const rows = await User.getAll();
    const user_id = rows[rows.length - 1].id;
    Session.delete({ user_id });
    User.delete({ id: user_id });
  });
});

describe('File preprocessing', function () {
  this.timeout(5000);
  let initialLineCount = 0;
  let initialSize;
  let user_id;
  let genome_id;
  let returnedSex;
  let returnedSize;
  const copyPath = path.join(__dirname, 'testFileCopy.txt');
  const preprocessedPath = `${copyPath}.preprocessed`;

  before(async () => {
    const stats = fs.statSync(filePath);
    initialSize = stats.size;
    fs.copyFileSync(filePath, copyPath);
    fs.createReadStream(copyPath)
    .on('data', (chunk) => {
      for (let i = 0; i < chunk.length; i++) {
        // 10 is the ASCII code for a newline character
        if (chunk[i] === 10) {
          initialLineCount++;
        }
      }
    });
    const [ user ] = await User.create({ username: 'upload_user', password: 'test' });
    user_id = user.id;
    const [ genome ] = await Genome.create({
      user_id,
      name: 'test_genome',
    });
    genome_id = genome.id;
    const { sex, size } = await preprocessFile(copyPath, genome_id);
    returnedSex = sex;
    returnedSize = size;
  });

  it('should remove the first 20 lines of a file', (done) => {
    var lineCount = 0;

    fs.createReadStream(preprocessedPath)
    .on('data', (chunk) => {
      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] === 10) {
          lineCount++;
        }
      }
    }).on('end', () => {
      expect(lineCount).to.equal(initialLineCount - 20);
      expect(returnedSize).to.equal(32799324);
      done();
    });
  });

  it('should add the genome_id to each line of the file', (done) => {
    let count = 0;
    const randomLine = Math.floor(Math.random() * (initialLineCount - 20)) + 1;
    fs.createReadStream(preprocessedPath)
    .on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      lines.forEach((line) => {
        count++;
        const columns = line.split('\t');
        if (count === randomLine) {
          expect(columns[1]).to.equal(`${genome_id}`);
        }
      });
    }).on('end', () => {
      done();
    });
  });

  it('should update the sex of the genome', async () => {
    const [ genome ] = await Genome.get({ id: genome_id });
    expect(genome.sex).to.equal('M');
  });

  after(async () => {
    Snp.delete({ genome_id });
    Genome.delete({ id: genome_id });
    User.delete({ id: user_id });
  });
});

describe('File delete', () => {
  it('should delete the original file and its copies', () => {
    const copyPath = path.join(__dirname, 'testFileCopy.txt');
    deleteFiles(copyPath, () => {
      expect(fs.existsSync(copyPath)).to.equal(false);
      expect(fs.existsSync(`${copyPath}.preprocessed`)).to.equal(false);
    });
  });
});

describe.skip('Snps model', () => {
  let genome_id;
  const copyPath = path.join(__dirname, 'testFileCopy.txt');
  before(async () => {
    await fs.copyFileSync(filePath, copyPath);
    const [ user ] = await User.create({ username: 'test', password: 'test' });
    const [ genome ] = await Genome.create({
      user_id: user.id,
      name: 'test_genome',
    });
    genome_id = genome.id;
    await preprocessFile(filePath, genome_id);
  });

  it('should create a new snp', async () => {
    const [ snp ] = await Snp.create({ rsid: 'test', genome_id, genotype: 'AA' });
    expect(snp.rsid).to.equal('test');
  });

  it('should copy a snp file', async () => {
    await Snp.copySnpFile(`${copyPath}.preprocessed`);
    const [ snp ] = await Snp.get({ rsid: 'rs21', genome_id });
    const { rsid, chromosome, position, genotype } = snp;
    expect(rsid).to.equal('rs21');
    expect(chromosome).to.equal('7');
    expect(position).to.equal(11182783);
    expect(genotype).to.equal('AG');
  });

  after(async () => {
    Snp.delete({ genome_id });
    Genome.delete({ id: genome_id });
    User.delete({ username: 'test' });
    deleteFiles(copyPath, () => {});
  });
});

describe.skip('File Upload Route', function () {
  before(() => {
    const ws = new WebSocket('ws://localhost:3000/api/genome/');
  });
  this.timeout(20000);

  it('should upload a file', (done) => {
    const name = 'testName';
    chai.request(app)
      .post(`/api/genome?name=${name}`)
      .attach('file', './server/tests/testFile.txt')
      .end((err, res) => {
        if (err) {
          console.error(err);
        }
        expect(res.status).to.equal(200);
        expect(res.text).to.equal('File uploaded to database!');
        done();
      });
  });
});

after(() => {
  // Clean up sockets after tests
  Object.keys(sockets).forEach((key) => {
    sockets[key].close();
    delete sockets[key];
  });
  client.query('DROP TABLE test');
});
