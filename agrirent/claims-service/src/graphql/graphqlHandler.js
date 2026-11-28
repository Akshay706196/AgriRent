const fs = require('fs');
const path = require('path');
const { parse, validate, execute, specifiedRules, NoSchemaIntrospectionCustomRule } = require('graphql');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const resolvers = require('./resolvers');
const { createDataLoaders } = require('./dataloaders');
const { depthLimit } = require('./depthLimiter');

const schemaString = fs.readFileSync(path.join(__dirname, '../../contracts/schema.graphql'), 'utf8');

const schema = makeExecutableSchema({
  typeDefs: schemaString,
  resolvers,
});

const MAX_DEPTH = parseInt(process.env.GRAPHQL_MAX_DEPTH, 10) || 6;

async function handleGraphQLRequest(req, res) {
  // Deliberate Cache-Control: no-store on /graphql
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const { query, variables, operationName } = req.body || {};

  if (!query || typeof query !== 'string') {
    return res.status(400).json({
      error: {
        code: 'INVALID_GRAPHQL_QUERY',
        message: 'Query string is required in GraphQL request body.',
        correlationId: req.correlationId,
      },
    });
  }

  // 1. Parse document AST
  let documentAST;
  try {
    documentAST = parse(query);
  } catch (syntaxErr) {
    return res.status(400).json({
      error: {
        code: 'GRAPHQL_PARSE_ERROR',
        message: syntaxErr.message,
        correlationId: req.correlationId,
      },
    });
  }

  // 2. Build validation rules (Depth limit + Production Introspection rule)
  const validationRules = [
    ...specifiedRules,
    depthLimit(MAX_DEPTH),
  ];

  if (process.env.NODE_ENV === 'production') {
    validationRules.push(NoSchemaIntrospectionCustomRule);
  }

  // 3. Validate AST against rules
  const validationErrors = validate(schema, documentAST, validationRules);
  if (validationErrors.length > 0) {
    const isDepthError = validationErrors.some((e) => e.extensions?.code === 'QUERY_TOO_DEEP');
    const statusCode = isDepthError ? 400 : 400;

    return res.status(statusCode).json({
      error: {
        code: isDepthError ? 'QUERY_TOO_DEEP' : 'GRAPHQL_VALIDATION_ERROR',
        message: validationErrors[0].message,
        correlationId: req.correlationId,
      },
      errors: validationErrors.map((e) => ({
        message: e.message,
        extensions: {
          code: e.extensions?.code || 'VALIDATION_ERROR',
          correlationId: req.correlationId,
        },
      })),
    });
  }

  // 4. Create request-scoped context & DataLoaders
  const context = {
    user: req.user,
    correlationId: req.correlationId,
    loaders: createDataLoaders(),
  };

  // 5. Execute GraphQL query
  const executionResult = await execute({
    schema,
    document: documentAST,
    rootValue: null,
    contextValue: context,
    variableValues: variables,
    operationName,
  });

  // Transport status: 200 with data and/or errors array
  res.status(200).json(executionResult);
}

module.exports = {
  handleGraphQLRequest,
  schema,
  schemaString,
};
