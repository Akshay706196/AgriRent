/**
 * SOAP Client script for AgriRent Payment Service.
 * Reads WSDL from running service or local file and invokes GetPaymentStatus.
 */
const soap = require('soap');
const path = require('path');

async function callGetPaymentStatus(bookingId, endpointUrl = 'http://localhost:4004/soap/payments?wsdl') {
  const wsdlUrl = endpointUrl;

  try {
    const client = await soap.createClientAsync(wsdlUrl);
    if (endpointUrl) {
      const endpoint = endpointUrl.replace('?wsdl', '');
      client.setEndpoint(endpoint);
    }
    const [result] = await client.GetPaymentStatusAsync({ bookingId });
    return result;
  } catch (err) {
    throw err;
  }
}

if (require.main === module) {
  const targetBookingId = process.argv[2] || 'BK-SEED001';
  const url = process.argv[3] || 'http://localhost:4004/soap/payments?wsdl';

  console.log(`[SOAP Client] Invoking GetPaymentStatus for bookingId='${targetBookingId}' via ${url}...`);

  callGetPaymentStatus(targetBookingId, url)
    .then((result) => {
      console.log('[SOAP Client] Success! Response received:');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('[SOAP Client] Failed:', err.message || err);
      process.exit(1);
    });
}

module.exports = {
  callGetPaymentStatus,
};
