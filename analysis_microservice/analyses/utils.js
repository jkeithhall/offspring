import pgClient from '../postgresDB.js';
import redisClient from '../redisDB.js';

const copiesOfEffectAllele = function(genotype, effectAllele) {
  if (genotype === effectAllele + effectAllele) {
    return 2;
  } else if (genotype.includes(effectAllele)) {
    return 1;
  } else {
    return 0;
  }
};

const inverseLogit = function(logOdds) {
  return Math.exp(logOdds) / (1 + Math.exp(logOdds));
};

const isHomozygous = function(genotype) {
  return genotype[0] === genotype[1];
}

const determineProbability = function(snps, pgsScores, intercept = 0) {
  const logOdds = Object.entries(snps).reduce((prevLogOdds, [rsid, genotype]) => {
    const { effect_allele, effect_weight, allelefrequency_effect } = pgsScores.get(rsid);
    if (genotype.includes('-')) {
      return prevLogOdds + 2 * effect_weight * allelefrequency_effect;
    } else {
      const copies = copiesOfEffectAllele(genotype, effect_allele);
      return prevLogOdds + copies * effect_weight;
    }
  }, 0);
  return inverseLogit(logOdds + intercept);
}

const determineMinAndMaxProbability = function(pgsScores, intercept = 0) {
  const maxLogOdds = [...pgsScores.entries()].reduce((prevLogOdds, [rsid, { effect_weight }]) => {
    return prevLogOdds + 2 * effect_weight;
  }, 0);
  const maxProbability = inverseLogit(maxLogOdds + intercept);

  const minLogOdds = [...pgsScores.entries()].reduce((prevLogOdds, [rsid, { effect_weight, allelefrequency_effect }]) => {
    return effect_weight < 0 ? prevLogOdds + 2 * effect_weight : prevLogOdds;
  }, 0);
  const minProbability = inverseLogit(minLogOdds + intercept);
  console.log('minProbability: ', minProbability, 'maxProbability: ', maxProbability);

  return { minProbability, maxProbability };
}

const fetchSnp = async function (genome_id, rsid, chip) {
  const cacheKey = `${chip}:${rsid}`;
  const cachedSnp = await redisClient.get(cacheKey);

  // If snp is cached as non-existent, return null
  if (cachedSnp) {
    // Return cached SNP data
    return cachedSnp;
  } else {
    // SNP data not found in cache of non-existent SNPs, fetch from the database
    const query = `SELECT * FROM snps WHERE genome_id = $1 AND rsid = $2 LIMIT 1`;
    const { rows } = await pgClient.query(query, [genome_id, rsid]);

    if (rows.length) {
      // SNP data found in the database
      return rows[0].genotype;;
    } else {
      // SNP data not found in the database, cache as non-existent
      const placeholder = '--';
      await redisClient.set(cacheKey, placeholder);

      return placeholder;
    }
  }
}


export { copiesOfEffectAllele, inverseLogit, isHomozygous, determineProbability, determineMinAndMaxProbability, fetchSnp };