const { IncomingForm } = require('formidable');
const { client } = require('../db/index.js');
const fs = require('fs');
const path = require('path');
const { snpFileUpload } = require('../db/models/snp.js');
const { exec } = require('child_process');

module.exports = {
  newFileUpload: async (req, res) => {
    const form = new IncomingForm({
      uploadDir: path.join(__dirname, 'temp'),
      keepExtensions: true,
      maxFiles: 1,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      multiples: false,
    });
    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.log("Error parsing the files");
        res.status(400).send("There was an error parsing the files");
        return;
      }
      if (files.length > 1) {
        //Multiple files
      } else {
        const file = files['files[]'][0];
        const { mimetype, filepath, originalFilename } = file;
        console.log(`Receiving file ${originalFilename}...`);
        var userName = originalFilename.split("_").slice(1,3).join(" ");
        if (mimetype !== "text/plain") {
          console.log(`Unsupported media type (${mimetype}).`);
          res.status(415).send(`Unsupported media type (${mimetype}). Only .txt files allowed.`);
        } else {
          // Preprocess file
          exec(`sed -i'.original' -e '1,20d' ${filepath}`,  (error, stdout, stderr) => {
            if (error) {
              res.status(500).send(`Error: ${error.message}`);
              console.error(`Error: ${error.message}`);
              return;
            }
            if (stderr) {
              res.status(500).send(`Error: ${stderr}`);
              console.error(`Error: ${stderr}`);
              return;
            }
            console.log("File preprocessed");
            snpFileUpload(filepath, userName, (status, message) => {
              console.log(message);
              // fs.unlink(filepath);
              res.status(status).send(message);
            });
          });
        }
      }
    });
  }
}