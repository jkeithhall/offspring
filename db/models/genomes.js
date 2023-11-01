import Model from './models.js';
import User from './users.js';
import { createHash, createRandom32String } from './hashutils.js';
import { faker } from '@faker-js/faker';

class GenomeModel extends Model {
  constructor() {
    super('genomes');
  }

  async create(options) {
    const { user_id } = options;
    if (!user_id) {
      const newUser = {
        username: faker.internet.userName(),
        password: createRandom32String(),
      }
      const [ user ] = await User.create(newUser);
      options.user_id = user.id;
    }
    return super.create.call(this, options);
  }
}

const Genome = new GenomeModel();
export default Genome;
