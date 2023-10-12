import { getSnpAtRsid } from '../models/snp.js';

export async function determineEyeColor (client, genome_id_1, genome_id_2) {
  const rsid = 'rs12913832';
  const colors = {
    'AA': {
            'brown': 0.85,
            'blue': 0.01,
            'green': 0.14
          },
    'AG': {
            'brown': 0.56,
            'blue': 0.07,
            'green': 0.37
          },
    'GG': {
            'brown': 0.01,
            'blue': 0.72,
            'green': 0.27
          }
  };

  try {
    var genotype_1 = await getSnpAtRsid(client, rsid, genome_id_1);
    var genotype_2 = await getSnpAtRsid(client, rsid, genome_id_2);

    // if (genotype_1 === null || genotype_2 === null) {
    //   throw new Error('Genotype not found in parent');
    // }

    if (genotype_1 === null) {
      genotype_1 = genotype_2;
    }
    if (genotype_2 === null) {
      genotype_2 = genotype_1;
    }

    var probabilities = {
      'brown': 0,
      'blue': 0,
      'green': 0
    };

    for (const allele_1 of genotype_1) {
      for (const allele_2 of genotype_2) {
        const genotype = allele_1 + allele_2;
        probabilities['brown'] += colors[genotype]['brown'];
        probabilities['blue'] += colors[genotype]['blue'];
        probabilities['green'] += colors[genotype]['green'];
      }
    }
    for (const color in probabilities) {
      probabilities[color] /= 4;
    }
    return probabilities;
  } catch (err) {
    throw err;
  }
}