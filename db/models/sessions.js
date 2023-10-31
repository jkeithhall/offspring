import { createHash, compareHash, createRandom32String } from './hashutils.js';
import Model from './models.js';
import User from './users.js';

class SessionModel extends Model {
  constructor() {
    super('sessions');
  }

  create({ user_id }) {
    let data = createRandom32String();
    let hash = createHash(data);
    return super.create.call(this, { hash, user_id });
  }

  get(options) {
    return new Promise(resolve => {
      resolve(super.get.call(this, options));
    })
    .then(rows => {
      const [ session ] = rows;
      if (!session || !session.user_id) {
        return session;
      }
      return User.get({ id: session.user_id })
        .then(rows => {
          const [ user ] = rows;
          session.user = user;
          return session;
        });
    })
  }
}

const Session = new SessionModel();
export default Session;