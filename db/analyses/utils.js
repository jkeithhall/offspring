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

const determineProbabilityBuckets = function(children, bucketSize, pgsScores) {
  const probabilityBuckets = {};
  for (var i = 0; i < 1; i += bucketSize) {
    const bucket = i.toFixed(3);
    probabilityBuckets[bucket] = 0;
  }

  for (const child of children) {
    const { histogramWeight, snps } = child;
    const logOdds = Object.entries(snps).reduce((prevLogOdds, [rsid, genotype]) => {
      const { effect_allele, effect_weight } = pgsScores[rsid];
      const copies = copiesOfEffectAllele(genotype, effect_allele);
      return prevLogOdds + copies * effect_weight;
    }, 0);
    const probability = inverseLogit(logOdds);
    for (const bucket in probabilityBuckets) {
      if (probability >= parseFloat(bucket) && probability < parseFloat(bucket) + bucketSize) {
        probabilityBuckets[bucket] += histogramWeight;
        break;
      }
    }
  }

  return probabilityBuckets;
}

export { copiesOfEffectAllele, inverseLogit, isHomozygous, determineProbabilityBuckets };