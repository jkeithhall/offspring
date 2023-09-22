import chai from 'chai';
import chaiHttp from 'chai-http';
import WebSocket from 'ws';
import { app, sockets } from '../index.js';
import { getSocketKey } from '../lib.js';
import { preprocessFile, deleteFiles } from '../lib.js';
import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

describe('File preprocessing', () => {
  var initialLineCount = 0;
  before(() => {
    fs.copyFileSync('./server/tests/testFile.txt', './server/tests/testFileCopy.txt');
    fs.createReadStream('./server/tests/testFileCopy.txt')
    .on('data', (chunk) => {
      for (let i = 0; i < chunk.length; i++) {
        // 10 is the ASCII code for a newline character
        if (chunk[i] === 10) {
          initialLineCount++;
        }
      }
    }).on('end', () => {
      console.log('Initial line count:', initialLineCount);
    });
  });

  it('should remove the first 20 lines of a file', (done) => {
    const filePath = path.join(__dirname, 'testFileCopy.txt');
    preprocessFile(filePath, () => {
      var lineCount = 0;
      fs.createReadStream(filePath)
      .on('data', (chunk) => {
        for (let i = 0; i < chunk.length; i++) {
          if (chunk[i] === 10) {
            lineCount++;
          }
        }
      });
      expect(lineCount).to.equal(initialLineCount - 20);
      done();
    });
  });

  it('should delete the original file and its preprocessed copy', (done) => {
    const filePath = './server/tests/testFileCopy.txt';
    deleteFiles(filePath, () => {
      expect(fs.existsSync(filePath)).to.equal(false);
      expect(fs.existsSync(`${filePath}.original`)).to.equal(false);
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
