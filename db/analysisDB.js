import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
const { Schema } = mongoose;

const publicationSchema = new Schema({
  id: String,
  title: String,
  doi: String,
  PMID: Number,
  journal: String,
  firstauthor: String,
  date_publication: String,
});

const traitEfoSchema = new Schema({
  id: String,
  label: String,
  description: String,
  url: String,
});

const pgsScoreSchema = new Schema({
    id: { type: String, require: true },
    name: { type: String, require: true },
    pgsScores: {
      type: Map,
      of: {
        effect_allele: { type: String, require: true },
        effect_weight: { type: Number, require: true },
        allelefrequency_effect: { type: Number, require: false },
      }
    },
    publication: publicationSchema,
    trait_efo: [traitEfoSchema],
    variants_number: { type: Number, require: true },
    intercept: { type: Number, require: true },
  });

const PgsScoreModel = mongoose.model('PgsScoreModel', pgsScoreSchema, 'pgs_scores');

mongoose.connect(process.env.MONGODB_URI);
const con = mongoose.connection;
con.on('connected', () => console.log('MongoDB connected'));
con.on('error', (err) => console.log('MongoDB connection error:', err));

export default PgsScoreModel;