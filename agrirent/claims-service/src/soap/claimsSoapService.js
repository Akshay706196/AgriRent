const fs = require('fs');
const path = require('path');
const soap = require('soap');
const jwt = require('jsonwebtoken');
const disputeService = require('../services/dispute.service');
const logger = require('../utils/logger');

const wsdlPath = path.join(__dirname, '../../contracts/claims.wsdl');
const wsdlXml = fs.readFileSync(wsdlPath, 'utf8');
const DEFAULT_JWT_SECRET = process.env.JWT_SECRET || 'agrirent_super_secret_jwt_key_2026_dev';

const soapServiceDefinition = {
  ClaimsService: {
    ClaimsPort: {
      GetDisputeStatus: async function (args, cb, headers, req) {
        const disputeId = args?.disputeId;
        const correlationId = req?.headers?.['x-correlation-id'] || 'soap-req';

        if (!disputeId) {
          throw {
            Fault: {
              Code: {
                Value: 'soap:Sender',
                Subcode: { value: 'rpc:BadArguments' },
              },
              Reason: { Text: 'disputeId is required.' },
              statusCode: 400,
            },
          };
        }

        // Authenticate via HTTP Authorization header
        const authHeader = req?.headers?.authorization;
        let user = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
          try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_PUBLIC_KEY || DEFAULT_JWT_SECRET);
            user = {
              id: decoded.sub || decoded.id || decoded.userId,
              role: decoded.role || 'USER',
              kycStatus: decoded.kycStatus || 'VERIFIED',
            };
          } catch (jwtErr) {
            throw {
              Fault: {
                Code: { Value: 'soap:Sender', Subcode: { value: 'rpc:Authentication' } },
                Reason: { Text: `Invalid authentication token: ${jwtErr.message}` },
                statusCode: 401,
              },
            };
          }
        } else if (process.env.NODE_ENV !== 'production' && req?.headers?.['x-user-id']) {
          user = {
            id: req.headers['x-user-id'],
            role: req.headers['x-user-role'] || 'USER',
          };
        } else {
          throw {
            Fault: {
              Code: { Value: 'soap:Sender', Subcode: { value: 'rpc:Authentication' } },
              Reason: { Text: 'Missing Bearer Authorization header on SOAP request.' },
              statusCode: 401,
            },
          };
        }

        try {
          const dispute = await disputeService.getDispute(disputeId, user, correlationId);
          return {
            disputeId: dispute.disputeId,
            claimId: dispute.claimId,
            status: dispute.status,
            decision: dispute.decision || '',
            reason: dispute.decisionReason || dispute.reason || '',
            resolvedAt: dispute.resolvedAt || '',
          };
        } catch (err) {
          throw {
            Fault: {
              Code: {
                Value: 'soap:Receiver',
                Subcode: { value: err.code || 'DISPUTE_ERROR' },
              },
              Reason: { Text: err.message || 'Error retrieving dispute status.' },
              statusCode: err.statusCode || 500,
            },
          };
        }
      },
    },
  },
};

function attachSoapService(server) {
  const soapServer = soap.listen(server, '/soap/claims', soapServiceDefinition, wsdlXml);
  logger.info('[SOAP] Claims SOAP service attached at /soap/claims (WSDL: /soap/claims?wsdl)');
  return soapServer;
}

module.exports = {
  attachSoapService,
  wsdlXml,
  soapServiceDefinition,
};
