import chai from 'chai';
import { expect } from 'chai';
import { copiesOfEffectAllele, inverseLogit, isHomozygous, determineProbability } from '../analyses/utils.js';

describe('Analysis utils', () => {
  it('should determine the number of copies of the effect allele', () => {
    const effectAllele = 'A';
    const genotype_1 = 'AA';
    const genotype_2 = 'AG';
    const genotype_3 = 'GG';
    const copies_1 = copiesOfEffectAllele(genotype_1, effectAllele);
    const copies_2 = copiesOfEffectAllele(genotype_2, effectAllele);
    const copies_3 = copiesOfEffectAllele(genotype_3, effectAllele);
    expect(copies_1).to.equal(2);
    expect(copies_2).to.equal(1);
    expect(copies_3).to.equal(0);
  });

  it('should determine the inverse logit', () => {
    const logit = function (p) {
      return Math.log(p / (1 - p));
    }
    const error = 0.000000000000001;
    const values = [];
    for (let i = 0; i < 100; i++) {
      values.push(Math.random());
    }
    values.forEach((value) => {
      const result = inverseLogit(logit(value));
      expect(result).to.be.within(value - error, value + error);
    });
  });

  it('should determine if a genotype is homozygous', () => {
    const genotype_1 = 'AA';
    const genotype_2 = 'AG';
    const genotype_3 = 'GG';
    const result_1 = isHomozygous(genotype_1);
    const result_2 = isHomozygous(genotype_2);
    const result_3 = isHomozygous(genotype_3);
    expect(result_1).to.equal(true);
    expect(result_2).to.equal(false);
    expect(result_3).to.equal(true);
  });

  it('should determine an individual\'s probability of having a trait', () => {
    const pgsScores = {
      rs21: {
        effect_allele: 'T',
        effect_weight: 0.1
      },
      rs14: {
        effect_allele: 'G',
        effect_weight: 0.2
      },
    };
    const person_1 = {
      snps: {
        rs21: 'TT',
        rs14: 'GG',
      }
    };
    const person_2 = {
      snps: {
        rs21: 'TG',
        rs14: 'GG',
      }
    };
    const person_3 = {
      snps: {
        rs21: 'GG',
        rs14: 'GT',
      }
    };
    const probability_1 = determineProbability(person_1, pgsScores);
    const probability_2 = determineProbability(person_2, pgsScores);
    const probability_3 = determineProbability(person_3, pgsScores);

    const error = 0.000000000000001;
    expect(probability_1).to.be.within(0.6456563062257955 - error, 0.6456563062257955 + error);
    expect(probability_2).to.be.within(0.6224593312018546 - error, 0.6224593312018546 + error);
    expect(probability_3).to.be.within(0.549833997312478 - error, 0.549833997312478 + error);
  });
});