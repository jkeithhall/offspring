import React, { useState, useRef } from "react";
import LinearWithValueLabel from "./LinearProgressBar";

export default function DragDropFile({handleFile, setUploadCount}) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      console.log("File dropped");
      handleFile(name, e.dataTransfer.files, (msg) => {
        const { data } = msg;
        if (data === "100") {
          setUploadCount((prev) => prev + 1);
          setUploadProgress(0);
        }
        setUploadProgress(parseFloat(data));
      });
    }
  };

  const handleChange = function(e) {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      console.log("File selected for upload");
      handleFile(name, e.dataTransfer.files, (msg) => {
        const { data } = msg;
        if (data === "100") {
          setUploadCount((prev) => prev + 1);
          setUploadProgress(0);
        }
        setUploadProgress(parseFloat(data));
      });
    }
  };

  const onButtonClick = () => {
    if (inputRef.current) {
      inputRef.current.click();
    }
  };

  return (
    <div className="upload-div">
      { uploadProgress > 0  && <LinearWithValueLabel progress={uploadProgress} />}
      <form className="form-file-upload" onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()}>
        <input type="text" className="input-name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input ref={inputRef} type="file" className="input-file-upload" multiple={true} onChange={handleChange} />
        <label className={`label-file-upload ${dragActive ? "drag-active" : ""}`} htmlFor="input-file-upload">
          <div>
            <p>Drag and drop your file here or</p>
            <button className="upload-button" onClick={onButtonClick}>Upload a file</button>
          </div>
        </label>
        { dragActive && <div className="drag-file-element" onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}></div> }
      </form>
    </div>
  );
};