import { useState, useRef } from "react";
import LinearWithValueLabel from "./LinearProgressBar.jsx";

export default function DragDropFile({handleFile}) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [name, setName] = useState("");
  const inputRef = useRef(null);

  const handleDrag = function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = function(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    let name = "Keith Hall";
    let sex = "M";
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      console.log("File dropped");
      handleFile(name, sex, e.dataTransfer.files, (msg) => {
        const { data } = msg;
        console.log("Progress: ", data);
        setUploadProgress(parseFloat(data));
      });
    }
  };

  const handleChange = function(e) {
    let name = "Keith Hall";
    let sex = "M";
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      console.log("File selected for upload");
      handleFile(name, sex, e.dataTransfer.files, (msg) => {
        const { data } = msg;
        console.log("Progress: ", data);
        setUploadProgress(parseFloat(data));
      });
    }
  };

// triggers the input when the button is clicked
  const onButtonClick = () => {
    inputRef.current.click();
  };

  return (
    <>
      < LinearWithValueLabel progress={uploadProgress} />
      <form id="form-file-upload" onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()}>
        <input ref={inputRef} type="file" id="input-file-upload" multiple={true} onChange={handleChange} />
        <label id="label-file-upload" htmlFor="input-file-upload" className={dragActive ? "drag-active" : "" }>
          <div>
            <p>Drag and drop your file here or</p>
            <button className="upload-button" onClick={onButtonClick}>Upload a file</button>
          </div>
        </label>
        { dragActive && <div id="drag-file-element" onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}></div> }
      </form>
    </>
  );
};