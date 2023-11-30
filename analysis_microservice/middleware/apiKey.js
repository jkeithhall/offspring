import dotenv from 'dotenv';
dotenv.config();
const { API_KEY } = process.env;

export default function authenticateAPIKey(req, res, next) {
  const { authorization } = req.headers;
  if (!authorization) {
    res.status(401).json({ error: 'No authorization header sent' });
    return;
  }
  const [ bearer, key ] = authorization.split(' ');
  if (bearer !== 'Bearer') {
    res.status(401).json({ error: 'Invalid authorization header' });
    return;
  }
  if (key !== API_KEY) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }
  next();
}