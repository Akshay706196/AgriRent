const soap = require('soap');

/**
 * SOAP Client helper for invoking GetDisputeStatus operation.
 * @param {string} endpointUrl Full URL to WSDL (e.g. http://localhost:4006/soap/claims?wsdl)
 * @param {Object} args { disputeId }
 * @param {string} token Bearer JWT token
 */
async function callGetDisputeStatus(endpointUrl, args, token = null) {
  const url = endpointUrl || process.env.SOAP_ENDPOINT || 'http://localhost:4006/soap/claims?wsdl';

  return new Promise((resolve, reject) => {
    soap.createClient(url, (err, client) => {
      if (err) return reject(err);

      // Support dynamic test port overrides
      if (url && !url.includes('localhost:4006')) {
        client.setEndpoint(url.replace('?wsdl', ''));
      }

      if (token) {
        client.setSecurity(new soap.BearerSecurity(token));
      }

      client.GetDisputeStatus(args, (callErr, result) => {
        if (callErr) return reject(callErr);
        resolve(result);
      });
    });
  });
}

if (require.main === module) {
  const disputeId = process.argv[2] || 'DSP-TEST-01';
  const token = process.argv[3] || '';

  console.log(`Invoking SOAP GetDisputeStatus for dispute: ${disputeId}...`);
  callGetDisputeStatus('http://localhost:4006/soap/claims?wsdl', { disputeId }, token)
    .then((res) => {
      console.log('SOAP Response:', JSON.stringify(res, null, 2));
    })
    .catch((err) => {
      console.error('SOAP Error:', err.message || err);
      process.exit(1);
    });
}

module.exports = {
  callGetDisputeStatus,
};
