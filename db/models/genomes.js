
export async function addGenome (client, user_id) {
  try {
    var { rows } = await client.query(`INSERT INTO genomes(user_id) VALUES (${user_id}) RETURNING id`);
    const genome_id = rows[0].id;
    console.log(`Added genome to database with genome ${genome_id}.`);
    return genome_id;
  } catch (err) {
    throw err;
  }
};