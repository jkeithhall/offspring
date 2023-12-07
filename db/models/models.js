import { client } from '../index.js';

const executeQuery = async function (text, values) {
  try {
    const { rows } = await client.query(text, values);
    return rows;
  } catch (err) {
    console.log('Error executing query:', err.message);
    throw err;
  }
}

const parseOptions = options => {
  return Object.entries(options).reduce((parsed, pair) => {
    const [key, value] = pair;
    parsed.string.push(key);
    parsed.values.push(value);
    return parsed;
  }, { string: [], values: [] });
};

class Model {
  constructor(tablename) {
    this.tablename = tablename;
  }

  getAll(options) {
    if (!options) {
      let queryString = `SELECT * FROM ${this.tablename}`;
      return executeQuery(queryString);
    } else {
      const parsedOptions = parseOptions(options);
      const filterString = parsedOptions.string.map((key, index) => `${key} = $${index + 1}`).join(' AND ');
      let queryString = `SELECT * FROM ${this.tablename} WHERE ${filterString}`;
      return executeQuery(queryString, parsedOptions.values);
    }
  }

  get(options) {
    const parsedOptions = parseOptions(options);
    const filterString = parsedOptions.string.map((key, index) => `${key} = $${index + 1}`).join(' AND ');
    const queryString = `SELECT * FROM ${this.tablename} WHERE ${filterString} LIMIT 1`;
    return executeQuery(queryString, parsedOptions.values);
  }

  create(options) {
    const parsedOptions = parseOptions(options);
    const valuesString = parsedOptions.values.map((value, index) => `$${index + 1}`).join(', ');
    const queryString = `INSERT INTO ${this.tablename}(${parsedOptions.string.join(', ')}) VALUES(${valuesString}) RETURNING *`;
    return executeQuery(queryString, parsedOptions.values);
  }

  update(options, values) {
    const parsedValues = parseOptions(values);
    const parsedOptions = parseOptions(options);
    const valuesString = parsedValues.string.map((key, index) => `${key} = $${index + 1}`).join(', ');
    const filterString = parsedOptions.string.map((key, index) => `${key} = $${index + 1 + parsedValues.values.length}`).join(' AND ');
    const queryString = `UPDATE ${this.tablename} SET ${valuesString} WHERE ${filterString} RETURNING *`;
    return executeQuery(queryString, Array.prototype.concat(parsedValues.values, parsedOptions.values));
  }

  delete(options) {
    const parsedOptions = parseOptions(options);
    const filterString = parsedOptions.string.map((key, index) => `${key} = $${index + 1}`).join(' AND ');
    const queryString = `DELETE FROM ${this.tablename} WHERE ${filterString} RETURNING *`;
    return executeQuery(queryString, parsedOptions.values);
  }

  deleteAll() {
    const queryString = `TRUNCATE TABLE ${this.tablename}`;
    return executeQuery(queryString);
  }
}

export default Model;