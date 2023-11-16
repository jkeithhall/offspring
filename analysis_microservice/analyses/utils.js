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

const determineProbability = function(person, pgsScores) {
  const { snps } = person;
  const logOdds = Object.entries(snps).reduce((prevLogOdds, [rsid, genotype]) => {
    const { effect_allele, effect_weight } = pgsScores[rsid];
    const copies = copiesOfEffectAllele(genotype, effect_allele);
    return prevLogOdds + copies * effect_weight;
  }, 0);
  return inverseLogit(logOdds);
}

export { copiesOfEffectAllele, inverseLogit, isHomozygous, determineProbability };