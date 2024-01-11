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
      const series = [[]];
      for (const bucket in childPdf) {
        series[0].push({ x: parseFloat(bucket), y: childPdf[bucket] });
      }

      // Determine parent probabilities
      const { parent_1_probability, parent_2_probability } = this.determineParentProbabilities();

      // Return analysis results
      const { publication, trait_efo, variants_number } = this;
      return { publication, trait_efo, variants_number, series, parent_1_probability, parent_2_probability };
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

  determineParentProbabilities() {
    const parent_1_probability = determineProbability(this.parent_1.snps, this.pgsScores, this.intercept);
    const parent_2_probability = determineProbability(this.parent_2.snps, this.pgsScores, this.intercept);
    return { parent_1_probability, parent_2_probability };
  }
}