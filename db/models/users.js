
export async function addUser (client, name, sex) {
  try {
    var { rows } = await client.query(`INSERT INTO users(name, sex) VALUES ('${name}', '${sex}') RETURNING id`);
    const user_id = rows[0].id;
    console.log(`Added ${name} to database with user_id ${user_id}.`);
    return user_id;
  } catch (err) {
    throw err;
  }
};