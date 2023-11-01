import { createHash, createRandom32String } from './hashutils.js';
import Model from './models.js';
import User from './users.js';
import { faker } from '@faker-js/faker';

class SessionModel extends Model {
  constructor() {
    super('sessions');
  }

  async create(options) {
    if (!options || !options.user_id) {
      const newUser = {
        username: faker.internet.userName(),
        password: createRandom32String(),
      }
      const [ user ] = await User.create(newUser);
      options = { user_id: user.id };
    }

    const hash = createHash(createRandom32String());
    options.hash = hash;

    return super.create.call(this, options);
  }
}

const Session = new SessionModel();
export default Session;