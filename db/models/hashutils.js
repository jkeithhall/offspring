import crypto from 'crypto';

const createHash = function(data, salt = '') {
  let shasum = crypto.createHash('sha256');
  shasum.update(data + salt);
  return shasum.digest('hex');
};

const compareHash = function(attempted, stored, salt = '') {
  return stored === createHash(attempted, salt);
};

const createRandom32String = function() {
  return crypto.randomBytes(16).toString('hex');
};

export { createHash, compareHash, createRandom32String };