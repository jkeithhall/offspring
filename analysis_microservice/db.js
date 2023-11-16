const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const { Schema } = mongoose;

const analysisSchema = new Schema(
  {
    _id: { type: Number, require: true },
    name: { type: String, require: true },
    pgsScores: {
      type: Map,
      of: {
        effect_allele: { type: String, require: true },
        effect_weight: { type: Number, require: true }
      }
    }
  }
);
const AnalysisModel = mongoose.model('AnalysisModel', analysisSchema, 'analysis');

mongoose.connect(process.env.MONGODB_URI);
const con = mongoose.connection;
con.on('connected', () => console.log('MongoDB connected'));
con.on('error', (err) => console.log('MongoDB connection error:', err));

module.exports = AnalysisModel;
