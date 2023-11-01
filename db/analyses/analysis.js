import { client } from '../index.js';
import Snp from '../models/snps.js';
import { isHomozygous, determineProbability } from '../utils.js';

class Analysis {
  constructor(name, genome_id_1, genome_id_2) {
    this.name = name;
    this.pgsScores = {};
    this.parent_1 = { genome_id: genome_id_1, histogramWeight: 1, snps: {} };
    this.parent_2 = { genome_id: genome_id_2, histogramWeight: 1, snps: {} };
    this.children = [];
  }

  async fetchPgsScores() {
    try {
      // To do: create a pgs_scores database (maybe change to mongoDB...)
      const rows = await client.query(`SELECT * FROM pgs_scores WHERE analysis = '${this.name}'`);
      rows.forEach(row => {
        const { rsid, effect_allele, effect_weight } = row;
        this.pgsScores[rsid] = { effect_allele, effect_weight };
      });
    } catch (err) {
      throw err;
    }
  }

  async determineSnpWeights() {
    const children = [ { histogramWeight: 1, snps: {} } ];

    try {
      for (const rsid in this.pgsScores) {
        const genome_id_1 = this.parent_1.genome_id;
        const [ snp_1 ] = await Snp.get({ rsid, genome_id: genome_id_1 });
        var genotype_1 = snp_1.genotype;
        this.parent_1[rsid] = genotype_1;

        const genome_id_2 = this.parent_2.genome_id;
        const [ snp_2 ] = await Snp.get({ rsid, genome_id: genome_id_2 });
        var genotype_2 = snp_2.genotype;
        this.parent_2[rsid] = genotype_2;

        // For now, if a genotype is not found in a parent, use the other parent's genotype
        if (genotype_1 === null) {
          genotype_1 = genotype_2;
        }
        if (genotype_2 === null) {
          genotype_2 = genotype_1;
        }

        // If both parents are homozygous for the same allele, all children will be homozygous for that allele
        // and we can use one child that counts for 4x the weight in the histogram
        if (genotype_1 === genotype_2 && isHomozygous(genotype_1) && isHomozygous(genotype_2)) {
          for (const child of children) {
            child['snps'][rsid] = genotype_1;
            child.histogramWeight *= 4;
          }

          // Otherwise, split each child into 4 new children, each containing one possible combination of alleles
        } else {
          for (var i = 0; i < children.length; i += 4) {
            const originalChild = children[i];
            const { histogramWeight, snps } = originalChild;
            children.splice(i, 1);
            for (const allele_1 of genotype_1) {
              for (const allele_2 of genotype_2) {
                const childGenotype = allele_1 + allele_2;
                const newChild = structuredClone(originalChild);
                newChild['snps'][rsid] = childGenotype;
                children.splice(i, 0, newChild);
              }
            }
          }
        }
      }

      this.children = children;

    } catch (err) {
      throw err;
    }
  }

  determineChildProbabilities(bucketSize = 0.005) {
    const probabilityBuckets = {};
    for (var i = 0; i < 1; i += bucketSize) {
      const bucket = i.toFixed(3);
      probabilityBuckets[bucket] = 0;
    }

    for (const child of this.children) {
      const probability = determineProbability(child, this.pgsScores);
      for (const bucket in probabilityBuckets) {
        if (probability >= parseFloat(bucket) && probability < parseFloat(bucket) + bucketSize) {
          probabilityBuckets[bucket] += histogramWeight;
          break;
        }
      }
    }

    return probabilityBuckets;
  }

  determineParentProbabilities() {
    const parent_1_probability = determineProbability(this.parent_1, this.pgsScores);
    const parent_2_probability = determineProbability(this.parent_2, this.pgsScores);
    return { parent_1_probability, parent_2_probability };
  }
}