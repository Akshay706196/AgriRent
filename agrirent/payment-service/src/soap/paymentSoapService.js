const fs = require('fs');
const path = require('path');
const soap = require('soap');
const paymentService = require('../services/payment.service');
const logger = require('../utils/logger');

const wsdlPath = path.join(__dirname, '../../contracts/payments.wsdl');
const wsdlXml = fs.readFileSync(wsdlPath, 'utf8');

const soapServiceDefinition = {
  PaymentService: {
    PaymentPort: {
      GetPaymentStatus: async function (args) {
        const bookingId = args?.bookingId;

        if (!bookingId) {
          throw {
            Fault: {
              Code: {
                Value: 'soap:Sender',
                Subcode: { value: 'rpc:BadArguments' },
              },
              Reason: { Text: 'bookingId is required.' },
              statusCode: 400,
            },
          };
        }

        try {
          const status = await paymentService.getPaymentStatus(bookingId);
          return {
            bookingId: status.bookingId,
            paymentId: status.paymentId,
            paymentStatus: status.paymentStatus,
            depositStatus: status.depositStatus,
            paid: status.paid,
            totalAmount: status.totalAmount,
            currency: status.currency,
            transactionReference: status.transactionReference || '',
            verifiedAt: status.verifiedAt || '',
          };
        } catch (err) {
          throw {
            Fault: {
              Code: {
                Value: 'soap:Receiver',
                Subcode: { value: err.code || 'PAYMENT_ERROR' },
              },
              Reason: { Text: err.message || 'Error retrieving payment status.' },
              statusCode: err.statusCode || 500,
            },
          };
        }
      },
    },
  },
};

function attachSoapService(server) {
  const soapServer = soap.listen(server, '/soap/payments', soapServiceDefinition, wsdlXml);
  logger.info('[SOAP] Payment SOAP service attached at /soap/payments (WSDL: /soap/payments?wsdl)');
  return soapServer;
}

module.exports = {
  attachSoapService,
  wsdlXml,
  soapServiceDefinition,
};
