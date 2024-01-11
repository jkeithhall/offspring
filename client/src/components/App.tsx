import DragDropFile from './DragDropFile';
import { uploadFile, getGenomes } from '../api';
import React, { useState, useEffect } from 'react';

export default function App() {
  const [ genomeUploadCount, setGenomeUploadCount ] = useState(0);
  const [ availableGenomes, setAvailableGenomes ] = useState([]);
  const [ selectedGeomes, setSelectedGenomes ] = useState([]);

  useEffect(() => {
    getGenomes()
      .then((genomes) => {
        setAvailableGenomes(genomes);
      })
      .catch((err) => {
        console.log(err);
      });
  }, []);

  return (
    <>
      {genomeUploadCount < 2 && <div className="pair-upload-div">
        < DragDropFile handleFile={uploadFile} setUploadCount={setGenomeUploadCount}/>
        < DragDropFile handleFile={uploadFile} setUploadCount={setGenomeUploadCount}/>
      </div>}
      {availableGenomes.length > 0 && <div className="genome-drop-down">
        <select>
          {availableGenomes.map((genome) => {
            const { name, chip } = genome;
            return <option value={name} key={name}>{`${name} (${chip} chip)`}</option>
          })}
        </select>
      </div>}
      {availableGenomes.length > 0 && <div className="genome-drop-down">
        <select>
          {availableGenomes.map((genome) => {
            const { name, chip } = genome;
            return <option value={name} key={name}>{`${name} (${chip} chip)`}</option>
          })}
        </select>
      </div>}
    </>
  );
}