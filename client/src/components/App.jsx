import axios from 'axios';

import DragDropFile from './DragDropFile.jsx';

export default function App() {
  function handleFile(file) {
    axios.post('/api/genome', file)
      .then((response) => {
        console.log(response);
      });
  }

  return (
    <DragDropFile handleFile={handleFile}/>
  );
}