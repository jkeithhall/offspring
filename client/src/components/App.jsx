import axios from 'axios';
import DragDropFile from './DragDropFile.jsx';
import { uploadFile } from '../api.jsx';

export default function App() {

  return (
    < DragDropFile handleFile={uploadFile} />
  );
}