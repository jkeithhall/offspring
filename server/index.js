require('dotenv').config();
const express = require('express');
const axios = require('axios');
const formidable = require("formidable");
const app = express();

const { PORT } = process.env;
app.use(express.static('client/dist'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/api/genome', (req, res) => {
  const isFileValid = (file) => {
    const type = file.mimetype.split("/").pop();
    const validTypes = ["txt"];
    if (type === "txt") {
      return true;
    }
    return false;
  };

  const form = new formidable.IncomingForm();
  form.multiples = false;
  form.maxFileSize = 50 * 1024 * 1024; // 50MB
  form.parse(req, async (err, fields, files) => {
    console.log("fields", fields);
    console.log("files", files);
    if (err) {
      console.log("Error parsing the files");
      return res.status(400).json({
        status: "Fail",
        message: "There was an error parsing the files",
        error: err,
      });
    }
    if (!files.length) {
      //Single file
      const file = files['files[]'][0];
      // checks if the file is valid
      const isValid = isFileValid(file);

      // creates a valid name by removing spaces

      if (!isValid) {
        // throes error if file isn't valid
        return res.status(400).json({
          status: "Fail",
          message: "The file type is not a valid type",
        });
      }
      const fileName = encodeURIComponent(file.originalFilename.replace(/\s/g, "-"));
      try {
        // stores the fileName in the database
        return res.status(200).json({
          status: "success",
          message: "File created successfully!!",
        });
      } catch (error) {
        res.json({
          error,
        });
      }
    } else {
      // Multiple files
    }
  });
});

app.listen(PORT, () => {
  console.log(`Example app listening on port: ${PORT}`);
});
