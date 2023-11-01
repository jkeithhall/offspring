import express from 'express';
import chai from 'chai';
import chaiHttp from 'chai-http';
import supertest from 'supertest';
import WebSocket from 'ws';
import { app, sockets } from '../index.js';
import { getSocketKey, determineSex, preprocessFile, deleteFiles, createSession } from '../lib.js';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash, compareHash, createRandom32String } from '../../db/models/hashutils.js';
import { copiesOfEffectAllele, inverseLogit, isHomozygous, determineProbability } from '../../db/analyses/utils.js';
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

describe('Middleware', () => {
  const testApp = express();
  const name = 'testName';
  testApp.use(createSession);
  testApp.use(getSocketKey);
  let user_id;

  it('should create a session', async () => {
    supertest(testApp).post(`/api/genome?name=${name}`)
    .end((err, res) => {
      expect(res.req.session).to.be.an('object');
      user_id = res.req.session.user_id;
      expect(res.req.session.user_id).to.be.a('number');
    });
  });

  it('should return the same session for the same inputs', async () => {
    supertest(testApp).post(`/api/genome?name=${name}`)
    .end((err, res) => {
      expect(res.req.session.user_id).to.equal(user_id);
    });
  });

  it('should generate a valid socket key on the req object', async () => {
    supertest(testApp).post(`/api/genome?name=${name}`)
    .end((err, res) => {
      expect(res.req.socketKey).to.be.a('string');
      expect(res.req.socketKey.length).to.equal(64);
    });
  });

  it('should generate the same socket keys for the same inputs', async () => {
    let socketKey1;
    let socketKey2;
    supertest(testApp).post(`/api/genome?name=${name}`)
    .end((err, res) => {
      socketKey1 = res.req.socketKey;
    });
    supertest(testApp).post(`/api/genome?name=${name}`)
    .end((err, res) => {
      socketKey2 = res.req.socketKey;
    });
    expect(socketKey1).to.equal(socketKey2);
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
});

describe('Sex determination', () => {
  it('should determine sex from a file', async () => {
    const sex = await determineSex(filePath);
    expect(sex).to.equal('M');
  });
});

describe('File processing', function () {
  this.timeout(5000);
  var initialLineCount = 0;
  let user_id;
  let genome_id;
  const copyPath = path.join(__dirname, 'testFileCopy.txt');
  before(async () => {
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
      sex: 'M',
    });
    genome_id = genome.id;
  });

  it('should remove the first 20 lines of a file', (done) => {
    var lineCount = 0;
    preprocessFile(copyPath, () => {
      fs.createReadStream(copyPath)
      .on('data', (chunk) => {
        for (let i = 0; i < chunk.length; i++) {
          if (chunk[i] === 10) {
            lineCount++;
          }
        }
      }).on('end', () => {
        expect(lineCount).to.equal(initialLineCount - 20);
        done();
      });
    });
  });

  xit('should copy a file to the snps table', async () => {
    const initialCount = (await Snp.getAll()).length;
    console.log('initialCount: ', initialCount);
    await Snp.copySnpFile(filePath, genome_id);
    const finalCount = (await Snp.getAll()).length;
    console.log('finalCount: ', finalCount);
    expect(finalCount).to.equal(initialCount + 1128280);
  });

  it('should delete the original file and its preprocessed copy', (done) => {
    deleteFiles(copyPath, () => {
      expect(fs.existsSync(copyPath)).to.equal(false);
      expect(fs.existsSync(`${copyPath}.original`)).to.equal(false);
      done();
    });
  });

  after(async () => {
    Snp.delete({ genome_id });
    Genome.delete({ id: genome_id });
    User.delete({ id: user_id });
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

describe('Analysis utils', () => {
  it('should determine the number of copies of the effect allele', () => {
    const effectAllele = 'A';
    const genotype_1 = 'AA';
    const genotype_2 = 'AG';
    const genotype_3 = 'GG';
    const copies_1 = copiesOfEffectAllele(genotype_1, effectAllele);
    const copies_2 = copiesOfEffectAllele(genotype_2, effectAllele);
    const copies_3 = copiesOfEffectAllele(genotype_3, effectAllele);
    expect(copies_1).to.equal(2);
    expect(copies_2).to.equal(1);
    expect(copies_3).to.equal(0);
  });

  it('should determine the inverse logit', () => {
    const logit = function (p) {
      return Math.log(p / (1 - p));
    }
    const error = 0.000000000000001;
    const values = [];
    for (let i = 0; i < 100; i++) {
      values.push(Math.random());
    }
    values.forEach((value) => {
      const result = inverseLogit(logit(value));
      expect(result).to.be.within(value - error, value + error);
    });
  });

  it('should determine if a genotype is homozygous', () => {
    const genotype_1 = 'AA';
    const genotype_2 = 'AG';
    const genotype_3 = 'GG';
    const result_1 = isHomozygous(genotype_1);
    const result_2 = isHomozygous(genotype_2);
    const result_3 = isHomozygous(genotype_3);
    expect(result_1).to.equal(true);
    expect(result_2).to.equal(false);
    expect(result_3).to.equal(true);
  });

  it('should determine an individual\'s probability of having a trait', () => {
    const pgsScores = {
      rs21: {
        effect_allele: 'T',
        effect_weight: 0.1
      },
      rs14: {
        effect_allele: 'G',
        effect_weight: 0.2
      },
    };
    const person_1 = {
      snps: {
        rs21: 'TT',
        rs14: 'GG',
      }
    };
    const person_2 = {
      snps: {
        rs21: 'TG',
        rs14: 'GG',
      }
    };
    const person_3 = {
      snps: {
        rs21: 'GG',
        rs14: 'GT',
      }
    };
    const probability_1 = determineProbability(person_1, pgsScores);
    const probability_2 = determineProbability(person_2, pgsScores);
    const probability_3 = determineProbability(person_3, pgsScores);

    const error = 0.000000000000001;
    expect(probability_1).to.be.within(0.6456563062257955 - error, 0.6456563062257955 + error);
    expect(probability_2).to.be.within(0.6224593312018546 - error, 0.6224593312018546 + error);
    expect(probability_3).to.be.within(0.549833997312478 - error, 0.549833997312478 + error);
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
