import { inverseLogit, copiesOfEffectAllele, isHomozygous, determineProbabilityBuckets } from './utils.js';
import Snp from '../models/snp.js';

//  Currently hardcoding the pgsScores object, but this may be replaced with a database query
const pgsScores = {
  rs2101521: {
    effect_allele: 'T',
    effect_weight: 0.13976194237515863
  },
  rs1438673: {
    effect_allele: 'G',
    effect_weight: 0.11332868530700327
  },
  rs2155219: {
    effect_allele: 'T',
    effect_weight: 0.10436001532424286
  },
  rs6906021: {
    effect_allele: 'C',
    effect_weight: 0.09531017980432493
  },
  rs10440635: {
    effect_allele: 'A',
    effect_weight: 0.0769610411361284
  },
  rs6738825: {
    effect_allele: 'A',
    effect_weight: 0.0769610411361284
  },
  rs1342326: {
    effect_allele: 'G',
    effect_weight: 0.11332868530700327
  },
  rs7216389: {
    effect_allele: 'T',
    effect_weight: 0.06765864847381486
  },
  rs17293632: {
    effect_allele: 'T',
    effect_weight: 0.0769610411361284
  },
  rs17388568: {
    effect_allele: 'A',
    effect_weight: 0.0769610411361284
  },
};

export async function determinePediatricAllergyHistogram(genome_id_1, genome_id_2) {
  const children = [];

  try {
    for (const rsid in pgsScores) {
      var rows = await Snp.get({ rsid, genome_id: genome_id_1 });
      var genotype_1 = rows[0].genotype;
      rows = await Snp.get({ rsid, genome_id: genome_id_2 });
      var genotype_2 = rows[0].genotype;

      // if (genotype_1 === null || genotype_2 === null) {
      //   throw new Error('Genotype not found in parent');
      // }

      if (genotype_1 === null) {
        genotype_1 = genotype_2;
      }
      if (genotype_2 === null) {
        genotype_2 = genotype_1;
      }

      if (genotype_1 === genotype_2 && isHomozygous(genotype_1) && isHomozygous(genotype_2)) {
        if (children.length === 0) {
          const child = { histogramWeight: 4, snps: {} };
          child['snps'][rsid] = genotype_1;
          children.push(child);
        } else {
          for (const child of children) {
            child['snps'][rsid] = genotype_1;
            child.histogramWeight *= 4;
          }
        }
      } else {
        if (children.length === 0) {
          for (const allele_1 of genotype_1) {
            for (const allele_2 of genotype_2) {
              const child = { histogramWeight: 1, snps: {} };
              const childGenotype = allele_1 + allele_2;
              child['snps'][rsid] = childGenotype;
              children.push(child);
            }
          }
        } else {
          for (var i = 0; i < children.length; i += 4) {
            const originalChild = children[i];
            const { histogramWeight, snps } = originalChild;
            children.splice(i, 1);
            for (const allele_1 of genotype_1) {
              for (const allele_2 of genotype_2) {
                const childGenotype = allele_1 + allele_2;
                const newChild = JSON.parse(JSON.stringify(originalChild));
                newChild['snps'][rsid] = childGenotype;
                children.splice(i, 0, newChild);
              }
            }
          }
        }
      }
    }

    const bucketSize = 0.005;
    const probabilityBuckets = determineProbabilityBuckets(children, bucketSize, pgsScores);
    return probabilityBuckets;
  } catch (err) {
    throw err;
  }
}