const fs = require('fs');
const path = require('path');
const soap = require('soap');
const { lateFineService } = require('../services/lateFine.service');
const logger = require('../utils/logger');

const wsdlPath = path.join(__dirname, '../../contracts/handover.wsdl');
const wsdlXml = fs.readFileSync(wsdlPath, 'utf8');

const soapServiceDefinition = {
  HandoverService: {
    HandoverPort: {
      CalculateLateFine: async function (args) {
        const bookingId = args?.bookingId;
        const actualReturnTimestamp = args?.actualReturnTimestamp || null;

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
          const fineResult = await lateFineService.getOrCalculateLateFine(bookingId, actualReturnTimestamp);
          return {
            bookingId: fineResult.bookingId,
            overdueMinutes: fineResult.overdueMinutes,
            overdueDays: fineResult.overdueDays,
            fineAmount: fineResult.fineAmount,
            currency: fineResult.currency,
            dueDate: fineResult.dueDate || '',
            actualReturn: fineResult.actualReturn || '',
            depositCapApplied: Boolean(fineResult.depositCapApplied),
            calculatedAt: fineResult.calculatedAt || '',
          };
        } catch (err) {
          throw {
            Fault: {
              Code: {
                Value: 'soap:Receiver',
                Subcode: { value: err.code || 'CALCULATION_ERROR' },
              },
              Reason: { Text: err.message || 'Error calculating late fine.' },
              statusCode: err.statusCode || 500,
            },
          };
        }
      },
    },
  },
};

function attachSoapService(server) {
  const soapServer = soap.listen(server, '/soap/handover', soapServiceDefinition, wsdlXml);
  logger.info('[SOAP] Handover SOAP service attached at /soap/handover (WSDL: /soap/handover?wsdl)');
  return soapServer;
}

module.exports = {
  attachSoapService,
  wsdlXml,
  soapServiceDefinition,
};
