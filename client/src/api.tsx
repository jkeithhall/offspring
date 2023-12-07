import axios from 'axios';

export async function uploadFile (name, file, cb) {
  const ws = await new WebSocket(`ws://localhost:3000/api/genome?name=${name}`);
  ws.onopen = () => { console.log('Connected to websocket server'); };
  ws.onclose = () => { console.log('Disconnected from websocket server'); };
  ws.onmessage = (message) => { cb(message); };

  axios.post(`http://localhost:3000/api/genome?name=${name}`, file)
    .then((res) => { console.log(res.data); })
    .catch((err) => { console.log(err); });
};

export async function getGenomes () {
  const { data } = await axios.get('http://localhost:3000/api/genomes');
  const { availableGenomes } = data;
  return availableGenomes;
}