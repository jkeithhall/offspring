import chai from 'chai';
import chaiHttp from 'chai-http';
import WebSocket from 'ws';
import { app, sockets } from '../index.js';
import { getSocketKey, determineSex } from '../lib.js';
import { preprocessFile, deleteFiles } from '../lib.js';
import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const filePath = path.join(__dirname, 'testFile.txt');

const expect = chai.expect;

chai.use(chaiHttp);

describe('Server Routes', () => {
  describe('Websocket Route', () => {
    it('should connect a socket', (done) => {
      const ws = new WebSocket('ws://localhost:3000/api/genome/');
      ws.onopen = () => {
        expect(ws.readyState).to.equal(1);
        done();
      };
    });
  });

  describe('getSocketKey Function', () => {
    it('should generate a valid socket key', async () => {
      const req = {
        query: { name: 'testName' },
        headers: { origin: 'http://example.com' }
      };
      const key = await getSocketKey(req);
      expect(key).to.be.a('string');
    });
    it('should generate the same socket keys for the same inputs', async () => {
      const req = {
        query: { name: 'testName' },
        headers: { origin: 'http://example.com' }
      };
      const key1 = await getSocketKey(req);
      const key2 = await getSocketKey(req);
      expect(key2).to.equal(key1);
      // Add more assertions as needed
    });
  });
});

describe('Sex determination', () => {
  it('should determine sex from a file', async () => {
    const sex = await determineSex(filePath);
    expect(sex).to.equal('M');
  });
});

describe('File preprocessing', function () {
  this.timeout(5000);
  var initialLineCount = 0;
  const copyPath = path.join(__dirname, 'testFileCopy.txt');
  before(() => {
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

  it('should delete the original file and its preprocessed copy', (done) => {
    deleteFiles(copyPath, () => {
      expect(fs.existsSync(copyPath)).to.equal(false);
      expect(fs.existsSync(`${copyPath}.original`)).to.equal(false);
      done();
    });
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
});
