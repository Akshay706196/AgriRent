const soap = require('soap');

/**
 * SOAP Client helper for invoking CalculateLateFine operation.
 * @param {string} endpointUrl Full URL to WSDL (e.g. http://localhost:4005/soap/handover?wsdl)
 * @param {Object} args { bookingId, actualReturnTimestamp }
 */
async function callCalculateLateFine(endpointUrl, args) {
  const url = endpointUrl || process.env.SOAP_ENDPOINT || 'http://localhost:4005/soap/handover?wsdl';

  return new Promise((resolve, reject) => {
    soap.createClient(url, (err, client) => {
      if (err) return reject(err);

      // Support dynamic test port overrides
      if (url && !url.includes('localhost:4005')) {
        client.setEndpoint(url.replace('?wsdl', ''));
      }

      client.CalculateLateFine(args, (callErr, result) => {
        if (callErr) return reject(callErr);
        resolve(result);
      });
    });
  });
}

if (require.main === module) {
  const bookingId = process.argv[2] || 'BK-SEED-01';
  const returnTime = process.argv[3] || new Date().toISOString();

  console.log(`Invoking SOAP CalculateLateFine for booking: ${bookingId}...`);
  callCalculateLateFine('http://localhost:4005/soap/handover?wsdl', {
    bookingId,
    actualReturnTimestamp: returnTime,
  })
    .then((res) => {
      console.log('SOAP Response:', JSON.stringify(res, null, 2));
    })
    .catch((err) => {
      console.error('SOAP Error:', err.message || err);
      process.exit(1);
    });
}

module.exports = {
  callCalculateLateFine,
};
