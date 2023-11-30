import { createHash, compareHash, createRandom32String } from '../hashutils.js';
import Model from './models.js';

class UserModel extends Model {
  constructor() {
    super('users');
  }

  compare(attempted, password, salt) {
    return compareHash(attempted, password, salt);
  }

  create({ username, password }) {
    const salt = createRandom32String();

    const newUser = {
      username,
      password: createHash(password, salt),
      salt,
    };
    return super.create.call(this, newUser);
  }
}

const User = new UserModel();
export default User;
