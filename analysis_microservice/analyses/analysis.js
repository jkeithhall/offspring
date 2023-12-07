import pgClient from '../postgresDB.js';
import PgsScoreModel from '../analysisDB.js';
import { isHomozygous, determineProbability, determineMinAndMaxProbability, fetchSnp } from './utils.js';

export default class Analysis {
  constructor(pgs_id, genome_id_1, genome_id_2) {
    this.pgs_id = pgs_id;
    this.name = '';
    this.pgsScores = {};
    this.publication = {};
    this.trait_efo = [];
    this.variants_number = 0;
    this.intercept = null;
    this.parent_1 = { genome_id: genome_id_1, chip: null, snps: {} };
    this.parent_2 = { genome_id: genome_id_2, chip: null, snps: {} };
    this.childrenProbabilities = [];
  }

  async initializeAndRun() {
    try {
      // Fetch PGS data from MongoDB
      await this.fetchPgsScores();

      // Run Monte Carlo simulation for child probabilities
      const SIMULATION_COUNT = 20000;
      const childPdf = await this.runMonteCarloSimulation(SIMULATION_COUNT);

      // Determine parent probabilities
      const { parent_1_probability, parent_2_probability } = this.determineParentProbabilities();

      // Return analysis results
      const { publication, trait_efo, variants_number } = this;
      return { publication, trait_efo, variants_number, childPdf, parent_1_probability, parent_2_probability };
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async fetchPgsScores() {
    try {
      console.log('Fetching PGS scores');
      // Fetch PGS data from MongoDB
      const doc = await PgsScoreModel.findOne({ id: this.pgs_id });
      const { name, pgsScores, publication, trait_efo, variants_number, intercept } = doc;
      this.name = name;
      this.pgsScores = pgsScores;
      this.publication = publication;
      this.trait_efo = trait_efo;
      this.variants_number = variants_number;
      this.intercept = intercept;

      console.log('Fetching parent chip data');
      // Fetch parent chip versions from PostgreSQL
      var { rows } = await pgClient.query(`SELECT chip FROM genomes WHERE id = $1`, [this.parent_1.genome_id]);
      this.parent_1.chip = rows[0].chip;
      var { rows } = await pgClient.query(`SELECT chip FROM genomes WHERE id = $1`, [this.parent_2.genome_id]);
      this.parent_2.chip = rows[0].chip;

      console.log('Fetching parent SNP data');
      // Fetch parent SNP data from PostgreSQL
      for (const rsid of this.pgsScores.keys()) {
        const genotype_1 = await fetchSnp(this.parent_1.genome_id, rsid, this.parent_1.chip);
        this.parent_1.snps[rsid] = genotype_1;

        const genotype_2 = await fetchSnp(this.parent_2.genome_id, rsid, this.parent_2.chip);
        this.parent_2.snps[rsid] = genotype_2;
      }
    } catch (err) {
      throw err;
    }
  }

  async runMonteCarloSimulation(simulationCount = 10000) {
    try {
      console.log('Running Monte Carlo simulation');
      let minProbability = 1;
      let maxProbability = 0;

      // Run Monte Carlo simulation
      for (var i = 0; i < simulationCount; i++) {
        if (i % 1000 === 0) {
          console.log(`Simulation ${i}/${simulationCount}`);
        }
        const childSnps = {};
        // Randomly select one allele from each parent for each SNP
        for (const rsid of this.pgsScores.keys()) {
          const genotype_1 = this.parent_1.snps[rsid];
          const genotype_2 = this.parent_2.snps[rsid];
          const allele_1 = genotype_1[Math.floor(Math.random() * 2)];
          const allele_2 = genotype_2[Math.floor(Math.random() * 2)];
          childSnps[rsid] = allele_1 + allele_2;
        }

        // Determine child probability
        const probability = determineProbability(childSnps, this.pgsScores, this.intercept);
        this.childrenProbabilities.push(probability);
        if (probability < minProbability) {
          minProbability = probability;
        }
        if (probability > maxProbability) {
          maxProbability = probability;
        }
      }

      console.log('Min probability:', minProbability);
      console.log('Max probability:', maxProbability);
      // Initialize histogram of child probabilities
      const childHistogram = {};
      const bucketSize = ((maxProbability - minProbability) / 20);
      const precision = (maxProbability - minProbability) < 0.001 ? 4 : 3;
      for (var i = minProbability; i <= maxProbability; i += bucketSize) {
        const bucket = i.toFixed(precision);
        childHistogram[bucket] = 0;
      }

      // Populate histogram with child probabilities
      for (const childProbability of this.childrenProbabilities) {
        for (const bucket in childHistogram) {
          if (childProbability >= parseFloat(bucket) && childProbability < parseFloat(bucket) + bucketSize) {
            childHistogram[bucket] += 1;
            break;
          }
        }
      }

      // Convert histogram to probability density function (divide each bucket by simulationCount)
      const childPdf = {};
      for (const bucket in childHistogram) {
        childPdf[bucket] = childHistogram[bucket] / simulationCount;
      }
      return childPdf;
    } catch (err) {
      throw err;
    }
  }

  // DEPRECATED
  async determineSnpWeights() {
    try {
      let count = 0;
      console.log('Determining SNP weights');
      const children = [ { histogramWeight: 1, snps: {}, probability: null } ];

      for (const rsid of this.pgsScores.keys()) {
        const genome_id_1 = this.parent_1.genome_id;
        const genotype_1 = await fetchSnp(genome_id_1, rsid, this.parent_1.chip);
        this.parent_1.snps[rsid] = genotype_1;

        const genome_id_2 = this.parent_2.genome_id;
        const genotype_2 = await fetchSnp(genome_id_2, rsid, this.parent_2.chip);
        this.parent_2.snps[rsid] = genotype_2;

        console.log(`Genotypes: ${genotype_1} ${genotype_2} (${++count}/${this.pgsScores.size})`);
        if (genotype_1 === '--' || genotype_2 === '--') {
          // If one parent is missing the SNP, assign all children null genotype for that SNP
          for (const child of children) {
            child.snps[rsid] = '--';
          }
        }
        // If both parents are homozygous for the same allele, all children will be homozygous for that allele
        // and we can use one child that counts for 4x the weight in the histogram
        else if (genotype_1 === genotype_2 && isHomozygous(genotype_1) && isHomozygous(genotype_2)) {
          for (const child of children) {
            child.snps[rsid] = genotype_1;
            child.histogramWeight *= 4;
          }
        // If one parent is homozygous, split each child into 2 new children with 2x the histogram weight,
        // one with the homozygous genotype and one with the heterozygous genotype
        } else if (isHomozygous(genotype_1) || isHomozygous(genotype_2)) {
          const homozygousGenotype = isHomozygous(genotype_1) ? genotype_1 : genotype_2;
          const heterozygousGenotype = isHomozygous(genotype_1) ? genotype_2 : genotype_1;
          const newGenotype_1 = homozygousGenotype[0] + heterozygousGenotype[0];
          const newGenotype_2 = homozygousGenotype[0] + heterozygousGenotype[1];

          for (var i = 0; i < children.length; i += 2) {
            const originalChild = children[i];
            const { histogramWeight, snps } = originalChild;
            children.splice(i, 1);
            const newChild_1 = structuredClone(originalChild);
            const newChild_2 = structuredClone(originalChild);
            newChild_1.snps[rsid] = newGenotype_1;
            newChild_1.histogramWeight *= 2;
            newChild_2.snps[rsid] = newGenotype_2;
            newChild_2.histogramWeight *= 2;
            children.splice(i, 0, newChild_1, newChild_2);
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
                newChild.snps[rsid] = childGenotype;
                children.splice(i, 0, newChild);
              }
            }
          }
        }
        console.log('Children:', children.length);
      }
      this.children = children;
    } catch (err) {
      throw err;
    }
  }

  // DEPRECATED
  determineChildProbabilities() {
    console.log('Determining child probabilities');
    // Determine min and max probabilities
    const maxLogOdds = [...this.PgsScores.entries()].reduce((prevLogOdds, [rsid, { effect_allele, effect_weight, allelefrequency_effect }]) => {
      return prevLogOdds + 2 * effect_weight;
    }, 0);
    const maxProbability = inverseLogit(maxLogOdds + this.intercept);
    const minLogOdds = [...this.PgsScores.entries()].reduce((prevLogOdds, [rsid, { effect_allele, effect_weight, allelefrequency_effect }]) => {
      return effect_weight < 0 ? prevLogOdds + 2 * effect_weight : prevLogOdds;
    }, 0);
    const minProbability = inverseLogOdds(minLogOdds + this.intercept);

    for (const child of this.children) {
      const probability = determineProbability(child, this.pgsScores, this.intercept);
      child.probability = probability;
    }

    const bucketSize = (maxProbability - minProbability) / 20;
    const precision = (maxProbability - minProbability) < 0.01 ? 3 : 2;
    const probabilityBuckets = {};
    for (var i = Math.floor(minProbability); i < Math.ceil(maxProbability); i += bucketSize) {
      const bucket = i.toFixed(precision);
      probabilityBuckets[bucket] = 0;
    }

    for (const child of this.children) {
      for (const bucket in probabilityBuckets) {
        if (child.probability >= parseFloat(bucket) && child.probability < parseFloat(bucket) + bucketSize) {
          probabilityBuckets[bucket] += child.histogramWeight;
          break;
        }
      }
    }

    return probabilityBuckets;
  }

  determineParentProbabilities() {
    const parent_1_probability = determineProbability(this.parent_1.snps, this.pgsScores, this.intercept);
    const parent_2_probability = determineProbability(this.parent_2.snps, this.pgsScores, this.intercept);
    return { parent_1_probability, parent_2_probability };
  }
}