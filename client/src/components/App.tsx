import DragDropFile from './DragDropFile';
import { uploadFile } from '../api';
import React from 'react';

export default function App() {

  return (
    <>
      <div className="pair-upload-div">
        < DragDropFile handleFile={uploadFile} />
        < DragDropFile handleFile={uploadFile} />
      </div>
    </>
  );
}