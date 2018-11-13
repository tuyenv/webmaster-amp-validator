
const validator = require('amp-site-validator');
const fs = require('fs');
const CsvReadableStream = require('csv-reader');
const validUrl = require('valid-url');
const ExcelWriter = require('node-excel-stream').ExcelWriter;


var exports = module.exports = {};
exports.processAMPValidator = function(imFile, exFile) {
    var arrUrl = [];
    var countTotalRow = 0;

    if (!exFile) {
        exFile = 'validator_' + imFile;
    }

    const inputStream = fs.createReadStream(imFile, 'utf8');
    inputStream
        .pipe(CsvReadableStream({ parseNumbers: true, parseBooleans: true, trim: true }))
        .on('data', function (row) {
            countTotalRow ++;
            if (countTotalRow != 1) {
                row.forEach(function(url) {
                    if (validUrl.isUri(url)) {
                        arrUrl.push(url);
                    }
                });
            }

        })
        .on('end', function () {
            ampSiteValidator(arrUrl, exFile);
        });

}

function ampSiteValidator(arrUrl, exFile) {
    var arrFailUrl = [];
    const urlGenerator = function* () {
        for (var i = 0, len = arrUrl.length; i < len; i++) {
            yield arrUrl[i];
        }
    }
    async function run() {
        // This will fetch and validate 10 pages at the same time
        const results = await validator(urlGenerator, 10);

        results.forEach(function(data) {
            if (data.status === 'FAIL') {
                arrFailUrl.push({'url': data.url});
            }
        });

        console.log('Valid pages : '+ results.filter( result => result.status === 'PASS').length)
        console.log('Invalid pages : '+ results.filter( result => result.status !== 'PASS').length)
        exportFailedUrl(arrFailUrl, exFile);
    }
    run();
}

function exportFailedUrl(arrUrl, filePath) {
    let writer = new ExcelWriter({
        sheets: [{
            name: 'AMP',
            key: 'sheetAmp',
            headers: [{
                name: 'URL',
                key: 'url'
            }]
        }]
    });

    let dataPromises = arrUrl.map((input) => {
        writer.addData('sheetAmp', input);
    });
    Promise.all(dataPromises)
        .then(() => {
        return writer.save();
    })
    .then((stream) => {
            stream.pipe(fs.createWriteStream(filePath));
    });
}
